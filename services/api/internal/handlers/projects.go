package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/auth"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CreateProjectRequest struct {
	Name     string  `json:"name"`
	Domain   *string `json:"domain,omitempty"`
	Timezone string  `json:"timezone,omitempty"`
}

type UpdateProjectRequest struct {
	Name     *string `json:"name,omitempty"`
	Domain   *string `json:"domain,omitempty"`
	Timezone *string `json:"timezone,omitempty"`
	IsActive *bool   `json:"is_active,omitempty"`
}

type ProjectConfigResponse struct {
	Autotrack     models.AutotrackConfig `json:"autotrack"`
	MaskSelectors []string               `json:"mask_selectors"`
	SampleRate    float64                `json:"sample_rate"`
	SessionTimeout int                   `json:"session_timeout"`
	Banners       []BannerConfigItem     `json:"banners"`
}

type BannerConfigItem struct {
	ID        string          `json:"id"`
	Targeting json.RawMessage `json:"targeting"`
	Variants  []BannerVariantConfig `json:"variants"`
	FrequencyCap int           `json:"frequency_cap"`
	FrequencyDays int          `json:"frequency_days"`
}

type BannerVariantConfig struct {
	ID      string  `json:"id"`
	Weight  int     `json:"weight"`
	HTML    string  `json:"html"`
	CSS     string  `json:"css"`
	CTAURL  *string `json:"cta_url,omitempty"`
	CTAText *string `json:"cta_text,omitempty"`
}

func (h *Handlers) ListProjects(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	rows, err := h.pg.Query(r.Context(),
		`SELECT id, workspace_id, name, public_key, domain, timezone, is_active, created_at, updated_at
		 FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC`,
		workspaceID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch projects")
		return
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.PublicKey, &p.Domain,
			&p.Timezone, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}

	if projects == nil {
		projects = []models.Project{}
	}

	respondJSON(w, http.StatusOK, projects)
}

func (h *Handlers) CreateProject(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	var req CreateProjectRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
		return
	}

	if req.Timezone == "" {
		req.Timezone = "UTC"
	}

	projectID := uuid.New()
	publicKey := auth.GeneratePublicKey()
	secretKey := auth.GenerateSecretKey()

	var project models.Project
	err := h.pg.QueryRow(r.Context(),
		`INSERT INTO projects (id, workspace_id, name, public_key, secret_key, domain, timezone)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, workspace_id, name, public_key, domain, timezone, is_active, created_at, updated_at`,
		projectID, workspaceID, req.Name, publicKey, secretKey, req.Domain, req.Timezone,
	).Scan(&project.ID, &project.WorkspaceID, &project.Name, &project.PublicKey, &project.Domain,
		&project.Timezone, &project.IsActive, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create project")
		return
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO project_settings (project_id) VALUES ($1)`,
		projectID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create project settings")
		return
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO dashboards (project_id, name, is_default, created_by) VALUES ($1, 'Overview', true, $2)`,
		projectID, claims.UserID,
	)
	if err != nil {
	}

	respondJSON(w, http.StatusCreated, project)
}

func (h *Handlers) GetProject(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var project models.Project
	err = h.pg.QueryRow(r.Context(),
		`SELECT id, workspace_id, name, public_key, domain, timezone, is_active, created_at, updated_at
		 FROM projects WHERE id = $1 AND workspace_id = $2`,
		projectID, workspaceID,
	).Scan(&project.ID, &project.WorkspaceID, &project.Name, &project.PublicKey, &project.Domain,
		&project.Timezone, &project.IsActive, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}

	respondJSON(w, http.StatusOK, project)
}

func (h *Handlers) UpdateProject(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var req UpdateProjectRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		h.pg.Exec(r.Context(), `UPDATE projects SET name = $1 WHERE id = $2 AND workspace_id = $3`,
			*req.Name, projectID, workspaceID)
	}
	if req.Domain != nil {
		h.pg.Exec(r.Context(), `UPDATE projects SET domain = $1 WHERE id = $2 AND workspace_id = $3`,
			*req.Domain, projectID, workspaceID)
	}
	if req.Timezone != nil {
		h.pg.Exec(r.Context(), `UPDATE projects SET timezone = $1 WHERE id = $2 AND workspace_id = $3`,
			*req.Timezone, projectID, workspaceID)
	}
	if req.IsActive != nil {
		h.pg.Exec(r.Context(), `UPDATE projects SET is_active = $1 WHERE id = $2 AND workspace_id = $3`,
			*req.IsActive, projectID, workspaceID)
	}

	var project models.Project
	err = h.pg.QueryRow(r.Context(),
		`SELECT id, workspace_id, name, public_key, domain, timezone, is_active, created_at, updated_at
		 FROM projects WHERE id = $1 AND workspace_id = $2`,
		projectID, workspaceID,
	).Scan(&project.ID, &project.WorkspaceID, &project.Name, &project.PublicKey, &project.Domain,
		&project.Timezone, &project.IsActive, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}

	respondJSON(w, http.StatusOK, project)
}

func (h *Handlers) DeleteProject(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	err = h.pg.Exec(r.Context(),
		`DELETE FROM projects WHERE id = $1 AND workspace_id = $2`,
		projectID, workspaceID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "project deleted successfully"})
}

func (h *Handlers) RotateProjectKeys(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	newPublicKey := auth.GeneratePublicKey()
	newSecretKey := auth.GenerateSecretKey()

	err = h.pg.Exec(r.Context(),
		`UPDATE projects SET public_key = $1, secret_key = $2 WHERE id = $3 AND workspace_id = $4`,
		newPublicKey, newSecretKey, projectID, workspaceID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to rotate keys")
		return
	}

	h.rdb.Del(r.Context(), "project:"+projectIDStr)

	respondJSON(w, http.StatusOK, map[string]string{
		"public_key": newPublicKey,
		"message":    "keys rotated successfully",
	})
}

func (h *Handlers) GetSnippet(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var publicKey string
	err = h.pg.QueryRow(r.Context(),
		`SELECT public_key FROM projects WHERE id = $1 AND workspace_id = $2`,
		projectID, workspaceID,
	).Scan(&publicKey)

	if err != nil {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}

	collectorURL := "http://localhost:8081"
	if h.cfg.CollectorURL != "" {
		collectorURL = h.cfg.CollectorURL
	}

	snippet := `<!-- Analytics Tracking Code -->
<script async src="` + collectorURL + `/t.js?k=` + publicKey + `"></script>`

	respondJSON(w, http.StatusOK, map[string]string{
		"snippet":    snippet,
		"public_key": publicKey,
	})
}

func (h *Handlers) GetProjectConfig(w http.ResponseWriter, r *http.Request) {
	publicKey := chi.URLParam(r, "publicKey")

	var projectID uuid.UUID
	var workspaceID uuid.UUID
	var isActive bool

	err := h.pg.QueryRow(r.Context(),
		`SELECT id, workspace_id, is_active FROM projects WHERE public_key = $1`,
		publicKey,
	).Scan(&projectID, &workspaceID, &isActive)

	if err != nil || !isActive {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}

	var settings models.ProjectSettings
	var autotrackJSON []byte

	err = h.pg.QueryRow(r.Context(),
		`SELECT autotrack, mask_selectors, sample_rate, session_timeout_minutes
		 FROM project_settings WHERE project_id = $1`,
		projectID,
	).Scan(&autotrackJSON, &settings.MaskSelectors, &settings.SampleRate, &settings.SessionTimeoutMinutes)

	if err != nil {
		settings.SampleRate = 1.0
		settings.SessionTimeoutMinutes = 30
		settings.MaskSelectors = []string{}
	}

	var autotrack models.AutotrackConfig
	if len(autotrackJSON) > 0 {
		json.Unmarshal(autotrackJSON, &autotrack)
	} else {
		autotrack = models.AutotrackConfig{
			PageViews:     true,
			Clicks:        true,
			Forms:         true,
			ScrollDepth:   true,
			OutboundLinks: true,
			WebVitals:     true,
			SPANavigation: true,
		}
	}

	rows, err := h.pg.Query(r.Context(),
		`SELECT b.id, b.targeting, b.frequency_cap_per_user, b.frequency_cap_days
		 FROM banners b
		 WHERE b.project_id = $1 AND b.status = 'active'
		   AND (b.start_at IS NULL OR b.start_at <= NOW())
		   AND (b.end_at IS NULL OR b.end_at >= NOW())`,
		projectID)

	var banners []BannerConfigItem
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var b BannerConfigItem
			if err := rows.Scan(&b.ID, &b.Targeting, &b.FrequencyCap, &b.FrequencyDays); err != nil {
				continue
			}

			variantRows, _ := h.pg.Query(r.Context(),
				`SELECT id, weight, html, css, cta_url, cta_text FROM banner_variants WHERE banner_id = $1`,
				b.ID)
			if variantRows != nil {
				for variantRows.Next() {
					var v BannerVariantConfig
					variantRows.Scan(&v.ID, &v.Weight, &v.HTML, &v.CSS, &v.CTAURL, &v.CTAText)
					b.Variants = append(b.Variants, v)
				}
				variantRows.Close()
			}

			if len(b.Variants) > 0 {
				banners = append(banners, b)
			}
		}
	}

	if banners == nil {
		banners = []BannerConfigItem{}
	}
	if settings.MaskSelectors == nil {
		settings.MaskSelectors = []string{}
	}

	response := ProjectConfigResponse{
		Autotrack:      autotrack,
		MaskSelectors:  settings.MaskSelectors,
		SampleRate:     settings.SampleRate,
		SessionTimeout: settings.SessionTimeoutMinutes,
		Banners:        banners,
	}

	w.Header().Set("Cache-Control", "public, max-age=60")
	respondJSON(w, http.StatusOK, response)
}
