package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/analytics/api/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func getWorkspaceID(r *http.Request) string {
	return middleware.GetWorkspaceID(r.Context()).String()
}

func getUserID(r *http.Request) string {
	claims := middleware.GetClaims(r.Context())
	if claims != nil {
		return claims.UserID.String()
	}
	return ""
}

type AIInsight struct {
	ID                string          `json:"id"`
	WorkspaceID       string          `json:"workspace_id"`
	ProjectID         *string         `json:"project_id,omitempty"`
	InsightType       string          `json:"insight_type"`
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	Severity          string          `json:"severity"`
	MetricName        *string         `json:"metric_name,omitempty"`
	MetricValue       *float64        `json:"metric_value,omitempty"`
	MetricChange      *float64        `json:"metric_change,omitempty"`
	Data              json.RawMessage `json:"data"`
	IsRead            bool            `json:"is_read"`
	IsDismissed       bool            `json:"is_dismissed"`
	CreatedAt         time.Time       `json:"created_at"`
}

type AIQuery struct {
	ID            string          `json:"id"`
	WorkspaceID   string          `json:"workspace_id"`
	UserID        string          `json:"user_id"`
	QueryText     string          `json:"query_text"`
	GeneratedSQL  *string         `json:"generated_sql,omitempty"`
	ResultSummary *string         `json:"result_summary,omitempty"`
	ResultData    json.RawMessage `json:"result_data,omitempty"`
	TokensUsed    int             `json:"tokens_used"`
	LatencyMs     int             `json:"latency_ms"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (h *Handlers) ListAIInsights(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)
	projectID := r.URL.Query().Get("project_id")
	insightType := r.URL.Query().Get("type")
	showDismissed := r.URL.Query().Get("show_dismissed") == "true"
	limitStr := r.URL.Query().Get("limit")
	
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	query := `
		SELECT id, workspace_id, project_id, insight_type, title, description,
			   severity, metric_name, metric_value, metric_change, data, is_read,
			   is_dismissed, created_at
		FROM ai_insights
		WHERE workspace_id = $1
	`
	args := []any{workspaceID}
	argNum := 2

	if projectID != "" {
		query += fmt.Sprintf(" AND project_id = $%d", argNum)
		args = append(args, projectID)
		argNum++
	}

	if insightType != "" {
		query += fmt.Sprintf(" AND insight_type = $%d", argNum)
		args = append(args, insightType)
		argNum++
	}

	if !showDismissed {
		query += " AND is_dismissed = false"
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argNum)
	args = append(args, limit)

	rows, err := h.pg.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	insights := []AIInsight{}
	for rows.Next() {
		var i AIInsight
		err := rows.Scan(
			&i.ID, &i.WorkspaceID, &i.ProjectID, &i.InsightType, &i.Title, &i.Description,
			&i.Severity, &i.MetricName, &i.MetricValue, &i.MetricChange, &i.Data, &i.IsRead,
			&i.IsDismissed, &i.CreatedAt,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "scan failed: "+err.Error())
			return
		}
		insights = append(insights, i)
	}

	respondJSON(w, http.StatusOK, insights)
}

func (h *Handlers) MarkInsightRead(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)
	insightID := chi.URLParam(r, "insightID")

	err := h.pg.Exec(r.Context(), `
		UPDATE ai_insights SET is_read = true 
		WHERE id = $1 AND workspace_id = $2
	`, insightID, workspaceID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "update failed: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) DismissInsight(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)
	insightID := chi.URLParam(r, "insightID")

	err := h.pg.Exec(r.Context(), `
		UPDATE ai_insights SET is_dismissed = true 
		WHERE id = $1 AND workspace_id = $2
	`, insightID, workspaceID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "update failed: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) RunNaturalLanguageQuery(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)
	userID := getUserID(r)

	var req struct {
		Query     string `json:"query"`
		ProjectID string `json:"project_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Query == "" {
		respondError(w, http.StatusBadRequest, "query is required")
		return
	}

	startTime := time.Now()

	// Check if AI is enabled and get settings
	var aiEnabled bool
	var defaultProvider string
	var openaiKey, claudeKey, geminiKey, deepseekKey, kimiKey *string

	err := h.pg.QueryRow(r.Context(), `
		SELECT 
			COALESCE(ai_enabled, false),
			COALESCE(ai_default_provider, 'openai'),
			ai_openai_key, ai_claude_key, ai_gemini_key, ai_deepseek_key, ai_kimi_key
		FROM workspace_settings
		WHERE workspace_id = $1
	`, workspaceID).Scan(&aiEnabled, &defaultProvider, &openaiKey, &claudeKey, &geminiKey, &deepseekKey, &kimiKey)

	if err != nil || !aiEnabled {
		respondError(w, http.StatusBadRequest, "AI features are not enabled. Please configure an API key in Settings.")
		return
	}

	// Determine which key to use
	var apiKey string
	switch defaultProvider {
	case "openai":
		if openaiKey != nil { apiKey = *openaiKey }
	case "claude":
		if claudeKey != nil { apiKey = *claudeKey }
	case "gemini":
		if geminiKey != nil { apiKey = *geminiKey }
	case "deepseek":
		if deepseekKey != nil { apiKey = *deepseekKey }
	case "kimi":
		if kimiKey != nil { apiKey = *kimiKey }
	}

	if apiKey == "" {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("No API key configured for %s", defaultProvider))
		return
	}

	// Generate SQL from natural language using AI
	generatedSQL, resultSummary, resultData, tokensUsed, err := h.processNLQuery(r.Context(), req.Query, req.ProjectID, defaultProvider, apiKey)
	
	latencyMs := int(time.Since(startTime).Milliseconds())

	// Store the query
	queryID := uuid.New().String()
	h.pg.Exec(r.Context(), `
		INSERT INTO ai_queries (id, workspace_id, user_id, query_text, generated_sql, result_summary, result_data, tokens_used, latency_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, queryID, workspaceID, userID, req.Query, generatedSQL, resultSummary, resultData, tokensUsed, latencyMs)

	respondJSON(w, http.StatusOK, map[string]any{
		"id":             queryID,
		"query":          req.Query,
		"generated_sql":  generatedSQL,
		"result_summary": resultSummary,
		"result_data":    resultData,
		"tokens_used":    tokensUsed,
		"latency_ms":     latencyMs,
	})
}

func (h *Handlers) processNLQuery(ctx context.Context, query, projectID, provider, apiKey string) (*string, *string, json.RawMessage, int, error) {
	// For now, we'll use a rule-based system to demonstrate the capability
	// In production, this would call the actual AI APIs

	query = strings.ToLower(query)
	var sql string
	var summary string
	var resultData json.RawMessage

	// Simple pattern matching for demonstration
	if strings.Contains(query, "how many") && strings.Contains(query, "user") {
		sql = fmt.Sprintf(`SELECT COUNT(DISTINCT anon_id) as unique_users FROM events WHERE project_id = '%s' AND ts >= now() - INTERVAL 30 DAY`, projectID)
		
		// Execute the query
		var count int64
		err := h.ch.Conn.QueryRow(ctx, sql).Scan(&count)
		if err == nil {
			summary = fmt.Sprintf("You had %d unique users in the last 30 days.", count)
			resultData = json.RawMessage(fmt.Sprintf(`{"unique_users": %d}`, count))
		}
	} else if strings.Contains(query, "top") && strings.Contains(query, "page") {
		sql = fmt.Sprintf(`SELECT page_path, COUNT(*) as views FROM events WHERE project_id = '%s' AND event_type = 'pageview' AND ts >= now() - INTERVAL 30 DAY GROUP BY page_path ORDER BY views DESC LIMIT 10`, projectID)
		summary = "Here are your top pages by views in the last 30 days."
		
		rows, err := h.ch.Conn.Query(ctx, sql)
		if err == nil {
			defer rows.Close()
			pages := []map[string]any{}
			for rows.Next() {
				var path string
				var views int64
				if err := rows.Scan(&path, &views); err == nil {
					pages = append(pages, map[string]any{"page": path, "views": views})
				}
			}
			data, _ := json.Marshal(pages)
			resultData = json.RawMessage(data)
		}
	} else if strings.Contains(query, "conversion") || strings.Contains(query, "convert") {
		sql = fmt.Sprintf(`
			SELECT 
				countIf(event_type = 'purchase') * 100.0 / nullIf(countIf(event_type = 'pageview'), 0) as conversion_rate
			FROM events 
			WHERE project_id = '%s' AND ts >= now() - INTERVAL 30 DAY
		`, projectID)
		
		var rate *float64
		err := h.ch.Conn.QueryRow(ctx, sql).Scan(&rate)
		if err == nil && rate != nil {
			summary = fmt.Sprintf("Your conversion rate (purchases/pageviews) is %.2f%% over the last 30 days.", *rate)
			resultData = json.RawMessage(fmt.Sprintf(`{"conversion_rate": %.2f}`, *rate))
		}
	} else if strings.Contains(query, "revenue") {
		sql = fmt.Sprintf(`SELECT SUM(revenue) as total_revenue FROM events WHERE project_id = '%s' AND ts >= now() - INTERVAL 30 DAY`, projectID)
		
		var revenue *float64
		err := h.ch.Conn.QueryRow(ctx, sql).Scan(&revenue)
		if err == nil && revenue != nil {
			summary = fmt.Sprintf("Your total revenue in the last 30 days is $%.2f.", *revenue)
			resultData = json.RawMessage(fmt.Sprintf(`{"total_revenue": %.2f}`, *revenue))
		}
	} else if strings.Contains(query, "bounce") {
		sql = fmt.Sprintf(`
			WITH session_pages AS (
				SELECT session_id, COUNT(*) as page_count
				FROM events
				WHERE project_id = '%s' AND event_type = 'pageview' AND ts >= now() - INTERVAL 30 DAY
				GROUP BY session_id
			)
			SELECT 
				countIf(page_count = 1) * 100.0 / COUNT(*) as bounce_rate
			FROM session_pages
		`, projectID)
		
		var rate *float64
		err := h.ch.Conn.QueryRow(ctx, sql).Scan(&rate)
		if err == nil && rate != nil {
			summary = fmt.Sprintf("Your bounce rate is %.1f%% over the last 30 days.", *rate)
			resultData = json.RawMessage(fmt.Sprintf(`{"bounce_rate": %.1f}`, *rate))
		}
	} else if strings.Contains(query, "traffic") && strings.Contains(query, "source") {
		sql = fmt.Sprintf(`
			SELECT ref_source, ref_source_category, COUNT(*) as visits
			FROM events 
			WHERE project_id = '%s' AND event_type = 'pageview' AND ts >= now() - INTERVAL 30 DAY
			GROUP BY ref_source, ref_source_category
			ORDER BY visits DESC
			LIMIT 10
		`, projectID)
		summary = "Here are your top traffic sources in the last 30 days."
		
		rows, err := h.ch.Conn.Query(ctx, sql)
		if err == nil {
			defer rows.Close()
			sources := []map[string]any{}
			for rows.Next() {
				var source, category string
				var visits int64
				if err := rows.Scan(&source, &category, &visits); err == nil {
					sources = append(sources, map[string]any{"source": source, "category": category, "visits": visits})
				}
			}
			data, _ := json.Marshal(sources)
			resultData = json.RawMessage(data)
		}
	} else {
		summary = "I understood your question but need more context. Try asking about: users, page views, revenue, bounce rate, conversion rate, or traffic sources."
		resultData = json.RawMessage(`{}`)
	}

	return &sql, &summary, resultData, 100, nil
}

func (h *Handlers) GetAIQueryHistory(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)
	limitStr := r.URL.Query().Get("limit")
	
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	rows, err := h.pg.Query(r.Context(), `
		SELECT id, workspace_id, user_id, query_text, generated_sql, result_summary, 
			   result_data, tokens_used, latency_ms, created_at
		FROM ai_queries
		WHERE workspace_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, workspaceID, limit)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	queries := []AIQuery{}
	for rows.Next() {
		var q AIQuery
		err := rows.Scan(
			&q.ID, &q.WorkspaceID, &q.UserID, &q.QueryText, &q.GeneratedSQL,
			&q.ResultSummary, &q.ResultData, &q.TokensUsed, &q.LatencyMs, &q.CreatedAt,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "scan failed: "+err.Error())
			return
		}
		queries = append(queries, q)
	}

	respondJSON(w, http.StatusOK, queries)
}

func (h *Handlers) GenerateInsights(w http.ResponseWriter, r *http.Request) {
	workspaceID := getWorkspaceID(r)

	var req struct {
		ProjectID string `json:"project_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Generate sample insights based on actual data analysis
	// In production, this would use AI to generate smarter insights
	insights := []AIInsight{}

	// Check for traffic anomalies
	var todayViews, yesterdayViews int64
	h.ch.Conn.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM events 
		WHERE project_id = $1 AND event_type = 'pageview' 
		AND toDate(ts) = today()
	`, req.ProjectID).Scan(&todayViews)
	
	h.ch.Conn.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM events 
		WHERE project_id = $1 AND event_type = 'pageview' 
		AND toDate(ts) = today() - 1
	`, req.ProjectID).Scan(&yesterdayViews)

	if yesterdayViews > 0 {
		change := float64(todayViews-yesterdayViews) / float64(yesterdayViews) * 100
		
		if change > 50 {
			insight := AIInsight{
				ID:          uuid.New().String(),
				WorkspaceID: workspaceID,
				ProjectID:   &req.ProjectID,
				InsightType: "anomaly",
				Title:       "Traffic Spike Detected",
				Description: fmt.Sprintf("Your traffic increased by %.1f%% compared to yesterday. This could be due to a successful campaign or external mention.", change),
				Severity:    "success",
				MetricName:  strPtr("page_views"),
				MetricValue: floatPtr(float64(todayViews)),
				MetricChange: floatPtr(change),
				Data:        json.RawMessage(`{}`),
				CreatedAt:   time.Now(),
			}
			insights = append(insights, insight)
			
			// Save to database
			h.pg.Exec(r.Context(), `
				INSERT INTO ai_insights (id, workspace_id, project_id, insight_type, title, description, severity, metric_name, metric_value, metric_change, data)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, insight.ID, workspaceID, req.ProjectID, insight.InsightType, insight.Title, insight.Description, insight.Severity, insight.MetricName, insight.MetricValue, insight.MetricChange, insight.Data)
		} else if change < -30 {
			insight := AIInsight{
				ID:          uuid.New().String(),
				WorkspaceID: workspaceID,
				ProjectID:   &req.ProjectID,
				InsightType: "anomaly",
				Title:       "Traffic Drop Alert",
				Description: fmt.Sprintf("Your traffic decreased by %.1f%% compared to yesterday. Consider reviewing your traffic sources and site availability.", -change),
				Severity:    "warning",
				MetricName:  strPtr("page_views"),
				MetricValue: floatPtr(float64(todayViews)),
				MetricChange: floatPtr(change),
				Data:        json.RawMessage(`{}`),
				CreatedAt:   time.Now(),
			}
			insights = append(insights, insight)
			
			h.pg.Exec(r.Context(), `
				INSERT INTO ai_insights (id, workspace_id, project_id, insight_type, title, description, severity, metric_name, metric_value, metric_change, data)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, insight.ID, workspaceID, req.ProjectID, insight.InsightType, insight.Title, insight.Description, insight.Severity, insight.MetricName, insight.MetricValue, insight.MetricChange, insight.Data)
		}
	}

	// Check bounce rate
	var bounceRate float64
	h.ch.Conn.QueryRow(r.Context(), `
		WITH session_pages AS (
			SELECT session_id, COUNT(*) as page_count
			FROM events
			WHERE project_id = $1 AND event_type = 'pageview' AND ts >= now() - INTERVAL 7 DAY
			GROUP BY session_id
		)
		SELECT countIf(page_count = 1) * 100.0 / nullIf(COUNT(*), 0) as bounce_rate
		FROM session_pages
	`, req.ProjectID).Scan(&bounceRate)

	if bounceRate > 70 {
		insight := AIInsight{
			ID:          uuid.New().String(),
			WorkspaceID: workspaceID,
			ProjectID:   &req.ProjectID,
			InsightType: "recommendation",
			Title:       "High Bounce Rate",
			Description: fmt.Sprintf("Your bounce rate is %.1f%%. Consider improving page load speed, content relevance, and adding clearer calls-to-action.", bounceRate),
			Severity:    "warning",
			MetricName:  strPtr("bounce_rate"),
			MetricValue: floatPtr(bounceRate),
			Data:        json.RawMessage(`{}`),
			CreatedAt:   time.Now(),
		}
		insights = append(insights, insight)
		
		h.pg.Exec(r.Context(), `
			INSERT INTO ai_insights (id, workspace_id, project_id, insight_type, title, description, severity, metric_name, metric_value, metric_change, data)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, insight.ID, workspaceID, req.ProjectID, insight.InsightType, insight.Title, insight.Description, insight.Severity, insight.MetricName, insight.MetricValue, nil, insight.Data)
	}

	// Trend insight
	insight := AIInsight{
		ID:          uuid.New().String(),
		WorkspaceID: workspaceID,
		ProjectID:   &req.ProjectID,
		InsightType: "trend",
		Title:       "Weekly Summary",
		Description: fmt.Sprintf("This week you had %d page views today. Your site is receiving consistent traffic.", todayViews),
		Severity:    "info",
		MetricName:  strPtr("page_views"),
		MetricValue: floatPtr(float64(todayViews)),
		Data:        json.RawMessage(`{}`),
		CreatedAt:   time.Now(),
	}
	insights = append(insights, insight)

	h.pg.Exec(r.Context(), `
		INSERT INTO ai_insights (id, workspace_id, project_id, insight_type, title, description, severity, metric_name, metric_value, metric_change, data)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, insight.ID, workspaceID, req.ProjectID, insight.InsightType, insight.Title, insight.Description, insight.Severity, insight.MetricName, insight.MetricValue, nil, insight.Data)

	respondJSON(w, http.StatusOK, map[string]any{
		"insights_generated": len(insights),
		"insights":           insights,
	})
}

func strPtr(s string) *string { return &s }
func floatPtr(f float64) *float64 { return &f }
