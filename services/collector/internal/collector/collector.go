package collector

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/analytics/gocommon/models"
	"github.com/analytics/gocommon/referrer"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mssola/useragent"
	"github.com/rs/zerolog"
)

type ProjectCache struct {
	ID             uuid.UUID
	WorkspaceID    uuid.UUID
	IsActive       bool
	AllowedOrigins []string
	UpdatedAt      time.Time
}

type Collector struct {
	pg       *database.Postgres
	rdb      *database.Redis
	cfg      *config.Config
	log      zerolog.Logger
	projects sync.Map
}

func New(pg *database.Postgres, rdb *database.Redis, cfg *config.Config, log zerolog.Logger) *Collector {
	return &Collector{
		pg:  pg,
		rdb: rdb,
		cfg: cfg,
		log: log,
	}
}

func (c *Collector) LoadProjectsCache(ctx context.Context) error {
	rows, err := c.pg.Query(ctx,
		`SELECT p.id, p.workspace_id, p.public_key, p.is_active, p.domain, 
		        COALESCE(ps.allowed_origins, '{}') as allowed_origins
		 FROM projects p
		 LEFT JOIN project_settings ps ON ps.project_id = p.id`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, workspaceID uuid.UUID
		var publicKey string
		var isActive bool
		var domain *string
		var allowedOrigins []string
		if err := rows.Scan(&id, &workspaceID, &publicKey, &isActive, &domain, &allowedOrigins); err != nil {
			continue
		}
		
		// If domain is set, add it to allowed origins
		origins := allowedOrigins
		if domain != nil && *domain != "" {
			origins = append(origins, *domain, "https://"+*domain, "http://"+*domain)
		}
		
		c.projects.Store(publicKey, ProjectCache{
			ID:             id,
			WorkspaceID:    workspaceID,
			IsActive:       isActive,
			AllowedOrigins: origins,
			UpdatedAt:      time.Now(),
		})
		count++
	}

	c.log.Info().Int("count", count).Msg("Loaded projects cache")
	return nil
}

func (c *Collector) GetProject(ctx context.Context, publicKey string) (*ProjectCache, bool) {
	if cached, ok := c.projects.Load(publicKey); ok {
		project := cached.(ProjectCache)
		if time.Since(project.UpdatedAt) < 5*time.Minute {
			return &project, true
		}
	}

	var id, workspaceID uuid.UUID
	var isActive bool
	var domain *string
	var allowedOrigins []string
	err := c.pg.QueryRow(ctx,
		`SELECT p.id, p.workspace_id, p.is_active, p.domain, 
		        COALESCE(ps.allowed_origins, '{}') as allowed_origins
		 FROM projects p
		 LEFT JOIN project_settings ps ON ps.project_id = p.id
		 WHERE p.public_key = $1`,
		publicKey,
	).Scan(&id, &workspaceID, &isActive, &domain, &allowedOrigins)

	if err != nil {
		return nil, false
	}

	// If domain is set, add it to allowed origins
	origins := allowedOrigins
	if domain != nil && *domain != "" {
		origins = append(origins, *domain, "https://"+*domain, "http://"+*domain)
	}

	project := ProjectCache{
		ID:             id,
		WorkspaceID:    workspaceID,
		IsActive:       isActive,
		AllowedOrigins: origins,
		UpdatedAt:      time.Now(),
	}
	c.projects.Store(publicKey, project)
	return &project, true
}

// validateOrigin checks if the request origin is allowed for the project
func (c *Collector) validateOrigin(r *http.Request, project *ProjectCache) bool {
	// If no origins configured, allow all (for backwards compatibility or development)
	if len(project.AllowedOrigins) == 0 {
		return true
	}

	// Get origin from header (for CORS requests) or referer
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = r.Header.Get("Referer")
	}

	if origin == "" || origin == "null" {
		// No origin header or null origin (sendBeacon, privacy mode) - allow
		return true
	}

	// Check against allowed origins
	for _, allowed := range project.AllowedOrigins {
		if allowed == "*" {
			return true
		}
		// Exact match
		if strings.EqualFold(origin, allowed) {
			return true
		}
		// Check if origin starts with allowed (for full URLs in referer)
		if strings.HasPrefix(strings.ToLower(origin), strings.ToLower(allowed)) {
			return true
		}
		// Check domain match (e.g., "example.com" matches "https://example.com/page")
		if strings.Contains(strings.ToLower(origin), strings.ToLower(allowed)) {
			return true
		}
	}

	c.log.Warn().
		Str("origin", origin).
		Strs("allowed", project.AllowedOrigins).
		Msg("Rejected request from unauthorized origin")

	return false
}

func (c *Collector) HandleCollect(w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > 256*1024 {
		http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
		return
	}

	var req models.CollectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if len(req.Events) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if len(req.Events) > 100 {
		req.Events = req.Events[:100]
	}

	project, ok := c.GetProject(r.Context(), req.PublicKey)
	if !ok || !project.IsActive {
		http.Error(w, "invalid project key", http.StatusUnauthorized)
		return
	}

	// Validate origin/domain
	if !c.validateOrigin(r, project) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	clientIP := c.getClientIP(r)
	ua := useragent.New(r.UserAgent())
	browserName, browserVersion := ua.Browser()

	receivedAt := time.Now()

	for _, incoming := range req.Events {
		event := c.enrichEvent(incoming, project, clientIP, ua, browserName, browserVersion, receivedAt)
		c.publishEvent(r.Context(), event)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (c *Collector) HandleCollectGET(w http.ResponseWriter, r *http.Request) {
	publicKey := r.URL.Query().Get("k")
	eventName := r.URL.Query().Get("e")
	if publicKey == "" || eventName == "" {
		w.Header().Set("Content-Type", "image/gif")
		w.Write(transparentGIF)
		return
	}

	project, ok := c.GetProject(r.Context(), publicKey)
	if !ok || !project.IsActive {
		w.Header().Set("Content-Type", "image/gif")
		w.Write(transparentGIF)
		return
	}

	// Validate origin/domain
	if !c.validateOrigin(r, project) {
		w.Header().Set("Content-Type", "image/gif")
		w.Write(transparentGIF)
		return
	}

	clientIP := c.getClientIP(r)
	ua := useragent.New(r.UserAgent())
	browserName, browserVersion := ua.Browser()
	receivedAt := time.Now()

	incoming := models.IncomingEvent{
		EventName: eventName,
		EventType: "custom",
		Timestamp: time.Now().UnixMilli(),
		AnonID:    r.URL.Query().Get("aid"),
		SessionID: r.URL.Query().Get("sid"),
		URL:       r.URL.Query().Get("url"),
		Path:      r.URL.Query().Get("path"),
		Referrer:  r.URL.Query().Get("ref"),
		Title:     r.URL.Query().Get("title"),
	}

	if incoming.AnonID == "" {
		incoming.AnonID = "anon_" + uuid.New().String()[:12]
	}
	if incoming.SessionID == "" {
		incoming.SessionID = "sess_" + uuid.New().String()[:12]
	}

	event := c.enrichEvent(incoming, project, clientIP, ua, browserName, browserVersion, receivedAt)
	c.publishEvent(r.Context(), event)

	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write(transparentGIF)
}

func (c *Collector) enrichEvent(
	incoming models.IncomingEvent,
	project *ProjectCache,
	clientIP net.IP,
	ua *useragent.UserAgent,
	browserName, browserVersion string,
	receivedAt time.Time,
) models.Event {
	event := models.Event{
		WorkspaceID:  project.WorkspaceID,
		ProjectID:    project.ID,
		EventID:      uuid.New(),
		EventName:    incoming.EventName,
		EventType:    incoming.EventType,
		ReceivedAt:   receivedAt,
		AnonID:       incoming.AnonID,
		UserID:       incoming.UserID,
		SessionID:    incoming.SessionID,
		IsNewSession: incoming.IsNewSession,
		URL:          incoming.URL,
		Path:         incoming.Path,
		Referrer:     incoming.Referrer,
		Title:        incoming.Title,
		Hash:         incoming.Hash,
		Search:       incoming.Search,
		UTM:          incoming.UTM,
		Locale:       incoming.Locale,
		ScreenWidth:  incoming.ScreenWidth,
		ScreenHeight: incoming.ScreenHeight,
		Revenue:      incoming.Revenue,
		Currency:     incoming.Currency,
		OrderID:      incoming.OrderID,
		ProductID:    incoming.ProductID,
		ProductName:  incoming.ProductName,
		ProductCategory: incoming.ProductCategory,
		Quantity:     incoming.Quantity,
		BannerID:     incoming.BannerID,
		BannerVariant: incoming.BannerVariant,
		UserProps:    incoming.UserProps,
		LCP:          incoming.LCP,
		FID:          incoming.FID,
		CLS:          incoming.CLS,
		TTFB:         incoming.TTFB,
		FCP:          incoming.FCP,
		ScrollDepth:  incoming.ScrollDepth,
	}

	if incoming.Timestamp > 0 {
		event.Timestamp = time.UnixMilli(incoming.Timestamp)
	} else {
		event.Timestamp = receivedAt
	}

	if event.EventType == "" {
		event.EventType = "custom"
		switch event.EventName {
		case "page_view":
			event.EventType = "page"
		case "click", "form_submit", "scroll_depth":
			event.EventType = "interaction"
		case "add_to_cart", "begin_checkout", "purchase":
			event.EventType = "ecommerce"
		case "sign_up", "login", "logout":
			event.EventType = "auth"
		case "banner_impression", "banner_click", "banner_dismiss":
			event.EventType = "banner"
		}
	}

	event.IP = clientIP
	event.UABrowser = browserName
	event.UABrowserVer = browserVersion
	event.UAOS = ua.OS()
	event.UADevice = ua.Model()

	if ua.Mobile() {
		event.UADeviceType = "mobile"
	} else if ua.Bot() {
		event.UADeviceType = "bot"
	} else {
		event.UADeviceType = "desktop"
	}

	// Categorize referrer source
	refSource := referrer.Parse(incoming.Referrer)
	// Override with UTM if available
	refSource = referrer.DetectFromUTM(incoming.UTM, refSource)
	event.RefSource = refSource.Name
	event.RefSourceCategory = refSource.Category
	event.RefMedium = refSource.Medium

	if incoming.Props != nil {
		event.PropsString = make(map[string]string)
		event.PropsNumber = make(map[string]float64)
		event.PropsBool = make(map[string]bool)

		for k, v := range incoming.Props {
			switch val := v.(type) {
			case string:
				event.PropsString[k] = val
			case float64:
				event.PropsNumber[k] = val
			case int:
				event.PropsNumber[k] = float64(val)
			case bool:
				event.PropsBool[k] = val
			default:
				event.PropsString[k] = toString(val)
			}
		}
	}

	return event
}

func (c *Collector) publishEvent(ctx context.Context, event models.Event) {
	data, err := json.Marshal(event)
	if err != nil {
		c.log.Error().Err(err).Msg("Failed to marshal event")
		return
	}

	_, err = c.rdb.XAdd(ctx, "events:ingest", map[string]any{
		"data": string(data),
	})
	if err != nil {
		c.log.Error().Err(err).Msg("Failed to publish event to stream")
	}
}

func (c *Collector) getClientIP(r *http.Request) net.IP {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if parsed := net.ParseIP(ip); parsed != nil {
				return parsed
			}
		}
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if parsed := net.ParseIP(xri); parsed != nil {
			return parsed
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return net.ParseIP("0.0.0.0")
	}
	return net.ParseIP(host)
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	data, _ := json.Marshal(v)
	return string(data)
}

// HandleConfig returns project configuration for the tracker SDK
func (c *Collector) HandleConfig(w http.ResponseWriter, r *http.Request) {
	publicKey := chi.URLParam(r, "publicKey")
	if publicKey == "" {
		publicKey = r.URL.Query().Get("k")
	}

	project, ok := c.GetProject(r.Context(), publicKey)
	if !ok || !project.IsActive {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=60")
		w.Write([]byte(`{"autotrack":{"page_views":true,"clicks":true,"forms":true,"scroll_depth":true,"outbound_links":true,"web_vitals":true,"spa_navigation":true},"mask_selectors":[],"sample_rate":1.0,"session_timeout":30,"banners":[]}`))
		return
	}

	// Query project settings
	var sampleRate float64
	var sessionTimeout int
	var autotrackJSON []byte
	err := c.pg.QueryRow(r.Context(),
		`SELECT COALESCE(autotrack, '{}'), COALESCE(sample_rate, 1.0), COALESCE(session_timeout_minutes, 30)
		 FROM project_settings WHERE project_id = $1`, project.ID,
	).Scan(&autotrackJSON, &sampleRate, &sessionTimeout)

	if err != nil {
		sampleRate = 1.0
		sessionTimeout = 30
	}

	type autotrackCfg struct {
		PageViews     bool `json:"page_views"`
		Clicks        bool `json:"clicks"`
		Forms         bool `json:"forms"`
		ScrollDepth   bool `json:"scroll_depth"`
		OutboundLinks bool `json:"outbound_links"`
		WebVitals     bool `json:"web_vitals"`
		SPANavigation bool `json:"spa_navigation"`
	}

	autotrack := autotrackCfg{
		PageViews: true, Clicks: true, Forms: true,
		ScrollDepth: true, OutboundLinks: true, WebVitals: true, SPANavigation: true,
	}
	if len(autotrackJSON) > 2 {
		json.Unmarshal(autotrackJSON, &autotrack)
	}

	resp := map[string]interface{}{
		"autotrack":      autotrack,
		"mask_selectors": []string{},
		"sample_rate":    sampleRate,
		"session_timeout": sessionTimeout,
		"banners":        []interface{}{},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=60")
	json.NewEncoder(w).Encode(resp)
}

var transparentGIF = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
	0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
	0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
	0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
	0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
	0x01, 0x00, 0x3b,
}
