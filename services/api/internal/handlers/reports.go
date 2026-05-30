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
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handlers) ReportEvents(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	var req models.EventsReportRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	allProjects := req.ProjectID.String() == "00000000-0000-0000-0000-000000000000" || req.ProjectIDStr == "all"

	if !allProjects {
		var projectWorkspaceID uuid.UUID
		err := h.pg.QueryRow(r.Context(),
			`SELECT workspace_id FROM projects WHERE id = $1`,
			req.ProjectID,
		).Scan(&projectWorkspaceID)

		if err != nil || projectWorkspaceID != workspaceID {
			respondError(w, http.StatusForbidden, "project not found or access denied")
			return
		}
	}

	if req.Interval == "" {
		req.Interval = "1 day"
	}

	interval := "1 day"
	switch req.Interval {
	case "hour", "1 hour":
		interval = "1 hour"
	case "day", "1 day":
		interval = "1 day"
	case "week", "1 week":
		interval = "1 week"
	case "month", "1 month":
		interval = "1 month"
	}

	startTime := time.Now().AddDate(0, 0, -30)
	endTime := time.Now()
	if !req.TimeRange.Start.IsZero() {
		startTime = req.TimeRange.Start
	}
	if !req.TimeRange.End.IsZero() {
		endTime = req.TimeRange.End
	}

	var whereClause string
	var args []interface{}
	var argIdx int

	if allProjects {
		whereClause = "workspace_id = $1 AND ts >= $2 AND ts <= $3"
		args = []interface{}{workspaceID, startTime, endTime}
		argIdx = 4
	} else {
		whereClause = "project_id = $1 AND ts >= $2 AND ts <= $3"
		args = []interface{}{req.ProjectID, startTime, endTime}
		argIdx = 4
	}

	if req.EventName != "" {
		whereClause += fmt.Sprintf(" AND event_name = $%d", argIdx)
		args = append(args, req.EventName)
		argIdx++
	}

	for _, f := range req.Filters {
		switch f.Operator {
		case "eq", "=":
			whereClause += fmt.Sprintf(" AND props_string['%s'] = $%d", f.Property, argIdx)
			args = append(args, f.Value)
			argIdx++
		case "neq", "!=":
			whereClause += fmt.Sprintf(" AND props_string['%s'] != $%d", f.Property, argIdx)
			args = append(args, f.Value)
			argIdx++
		case "contains":
			whereClause += fmt.Sprintf(" AND props_string['%s'] LIKE $%d", f.Property, argIdx)
			args = append(args, "%"+fmt.Sprint(f.Value)+"%")
			argIdx++
		}
	}

	query := fmt.Sprintf(`
		SELECT
			toStartOfInterval(ts, INTERVAL %s) AS bucket,
			count() AS count,
			COUNT(DISTINCT anon_id) AS unique_users
		FROM events
		WHERE %s
		GROUP BY bucket
		ORDER BY bucket
	`, interval, whereClause)

	start := time.Now()
	rows, err := h.ch.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	var data []models.TimeSeriesPoint
	var totalCount, totalUsers int64

	for rows.Next() {
		var point models.TimeSeriesPoint
		var count, users uint64
		if err := rows.Scan(&point.Timestamp, &count, &users); err != nil {
			continue
		}
		point.Count = int64(count)
		point.UniqueUsers = int64(users)
		totalCount += point.Count
		totalUsers += point.UniqueUsers
		data = append(data, point)
	}

	if data == nil {
		data = []models.TimeSeriesPoint{}
	}

	respondJSON(w, http.StatusOK, models.EventsReportResponse{
		Data: data,
		Meta: models.ReportMeta{
			TotalCount:       totalCount,
			TotalUniqueUsers: totalUsers,
			QueryTimeMS:      time.Since(start).Milliseconds(),
		},
	})
}

func (h *Handlers) ReportFunnel(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	var req models.FunnelReportRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var projectWorkspaceID uuid.UUID
	err := h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		req.ProjectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	if len(req.Steps) < 2 {
		respondError(w, http.StatusBadRequest, "funnel must have at least 2 steps")
		return
	}

	if req.ConversionWindow == 0 {
		req.ConversionWindow = 168
	}

	startTime := time.Now().AddDate(0, 0, -30)
	endTime := time.Now()
	if !req.TimeRange.Start.IsZero() {
		startTime = req.TimeRange.Start
	}
	if !req.TimeRange.End.IsZero() {
		endTime = req.TimeRange.End
	}

	var conditions []string
	for _, step := range req.Steps {
		conditions = append(conditions, fmt.Sprintf("event_name = '%s'", step.EventName))
	}

	query := fmt.Sprintf(`
		SELECT
			windowFunnel(%d * 3600)(toDateTime(ts), %s) AS funnel_level,
			count() AS users
		FROM events
		WHERE project_id = $1 AND ts >= $2 AND ts <= $3
		GROUP BY anon_id
	`, req.ConversionWindow, strings.Join(conditions, ", "))

	start := time.Now()
	rows, err := h.ch.Query(r.Context(), query, req.ProjectID, startTime, endTime)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	stepCounts := make([]int64, len(req.Steps)+1)
	for rows.Next() {
		var level uint8
		var count uint64
		if err := rows.Scan(&level, &count); err != nil {
			continue
		}
		for i := 0; i <= int(level) && i < len(stepCounts); i++ {
			stepCounts[i] += int64(count)
		}
	}

	var steps []models.FunnelStepResult
	for i, step := range req.Steps {
		result := models.FunnelStepResult{
			StepNumber: i + 1,
			EventName:  step.EventName,
			Count:      stepCounts[i],
		}

		if i == 0 {
			result.ConversionRate = 100.0
			result.DropoffRate = 0
		} else if stepCounts[i-1] > 0 {
			result.ConversionRate = float64(stepCounts[i]) / float64(stepCounts[i-1]) * 100
			result.DropoffRate = 100 - result.ConversionRate
		}

		steps = append(steps, result)
	}

	overallConversion := 0.0
	if len(stepCounts) > 0 && stepCounts[0] > 0 {
		overallConversion = float64(stepCounts[len(req.Steps)-1]) / float64(stepCounts[0]) * 100
	}

	respondJSON(w, http.StatusOK, models.FunnelReportResponse{
		Steps:             steps,
		OverallConversion: overallConversion,
		Meta: models.ReportMeta{
			TotalCount:  stepCounts[0],
			QueryTimeMS: time.Since(start).Milliseconds(),
		},
	})
}

func (h *Handlers) ReportRetention(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	var req models.RetentionReportRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var projectWorkspaceID uuid.UUID
	err := h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		req.ProjectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	if req.Periods == 0 {
		req.Periods = 8
	}
	if req.RetentionPeriod == "" {
		req.RetentionPeriod = "day"
	}
	if req.StartEvent == "" {
		req.StartEvent = "page_view"
	}
	if req.ReturnEvent == "" {
		req.ReturnEvent = req.StartEvent
	}

	startTime := time.Now().AddDate(0, 0, -30)
	endTime := time.Now()
	if !req.TimeRange.Start.IsZero() {
		startTime = req.TimeRange.Start
	}
	if !req.TimeRange.End.IsZero() {
		endTime = req.TimeRange.End
	}

	dateTrunc := "toDate"
	if req.RetentionPeriod == "week" {
		dateTrunc = "toStartOfWeek"
	} else if req.RetentionPeriod == "month" {
		dateTrunc = "toStartOfMonth"
	}

	query := fmt.Sprintf(`
		WITH cohort_users AS (
			SELECT anon_id, %s(min(ts)) AS cohort_date
			FROM events
			WHERE project_id = $1 AND event_name = $2 AND ts >= $3 AND ts <= $4
			GROUP BY anon_id
		),
		retention_data AS (
			SELECT
				cu.cohort_date,
				dateDiff('%s', cu.cohort_date, %s(e.ts)) AS period,
				COUNT(DISTINCT e.anon_id) AS users
			FROM events e
			JOIN cohort_users cu ON e.anon_id = cu.anon_id
			WHERE e.project_id = $1 AND e.event_name = $5 AND e.ts >= cu.cohort_date
			GROUP BY cu.cohort_date, period
		)
		SELECT cohort_date, period, users
		FROM retention_data
		WHERE period >= 0 AND period < $6
		ORDER BY cohort_date, period
	`, dateTrunc, req.RetentionPeriod, dateTrunc)

	start := time.Now()
	rows, err := h.ch.Query(r.Context(), query, req.ProjectID, req.StartEvent, startTime, endTime, req.ReturnEvent, req.Periods)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	cohortMap := make(map[string]*models.RetentionCohort)
	for rows.Next() {
		var cohortDate time.Time
		var period int32
		var users uint64
		if err := rows.Scan(&cohortDate, &period, &users); err != nil {
			continue
		}

		key := cohortDate.Format("2006-01-02")
		if _, exists := cohortMap[key]; !exists {
			cohortMap[key] = &models.RetentionCohort{
				CohortDate:    cohortDate,
				RetentionData: make([]float64, req.Periods),
			}
		}

		cohort := cohortMap[key]
		if period == 0 {
			cohort.CohortSize = int64(users)
		}
		if int(period) < len(cohort.RetentionData) && cohort.CohortSize > 0 {
			cohort.RetentionData[period] = float64(users) / float64(cohort.CohortSize) * 100
		}
	}

	var cohorts []models.RetentionCohort
	for _, c := range cohortMap {
		cohorts = append(cohorts, *c)
	}

	average := make([]float64, req.Periods)
	for i := 0; i < req.Periods; i++ {
		var sum float64
		var count int
		for _, c := range cohorts {
			if i < len(c.RetentionData) && c.RetentionData[i] > 0 {
				sum += c.RetentionData[i]
				count++
			}
		}
		if count > 0 {
			average[i] = sum / float64(count)
		}
	}

	respondJSON(w, http.StatusOK, models.RetentionReportResponse{
		Cohorts: cohorts,
		Average: average,
		Meta: models.ReportMeta{
			QueryTimeMS: time.Since(start).Milliseconds(),
		},
	})
}

func (h *Handlers) ReportPaths(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	var req models.PathsReportRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var projectWorkspaceID uuid.UUID
	err := h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		req.ProjectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	if req.MaxSteps == 0 {
		req.MaxSteps = 5
	}
	if req.MinCount == 0 {
		req.MinCount = 10
	}

	startTime := time.Now().AddDate(0, 0, -30)
	endTime := time.Now()
	if !req.TimeRange.Start.IsZero() {
		startTime = req.TimeRange.Start
	}
	if !req.TimeRange.End.IsZero() {
		endTime = req.TimeRange.End
	}

	query := `
		SELECT path, count() AS count
		FROM events
		WHERE project_id = $1 AND ts >= $2 AND ts <= $3 AND event_name = 'page_view'
		GROUP BY path
		HAVING count >= $4
		ORDER BY count DESC
		LIMIT 20
	`

	start := time.Now()
	rows, err := h.ch.Query(r.Context(), query, req.ProjectID, startTime, endTime, req.MinCount)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	var nodes []models.PathNode
	for rows.Next() {
		var node models.PathNode
		var count uint64
		if err := rows.Scan(&node.Event, &count); err != nil {
			continue
		}
		node.Count = int64(count)
		nodes = append(nodes, node)
	}

	edgeQuery := `
		WITH ordered_events AS (
			SELECT
				anon_id,
				path,
				lagInFrame(path) OVER (PARTITION BY anon_id ORDER BY ts) AS prev_path
			FROM events
			WHERE project_id = $1 AND ts >= $2 AND ts <= $3 AND event_name = 'page_view'
		)
		SELECT prev_path, path, count() AS count
		FROM ordered_events
		WHERE prev_path != '' AND prev_path != path
		GROUP BY prev_path, path
		HAVING count >= $4
		ORDER BY count DESC
		LIMIT 50
	`

	edgeRows, err := h.ch.Query(r.Context(), edgeQuery, req.ProjectID, startTime, endTime, req.MinCount/2)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "edge query failed")
		return
	}
	defer edgeRows.Close()

	var edges []models.PathEdge
	for edgeRows.Next() {
		var edge models.PathEdge
		var count uint64
		if err := edgeRows.Scan(&edge.Source, &edge.Target, &count); err != nil {
			continue
		}
		edge.Count = int64(count)
		edges = append(edges, edge)
	}

	if nodes == nil {
		nodes = []models.PathNode{}
	}
	if edges == nil {
		edges = []models.PathEdge{}
	}

	respondJSON(w, http.StatusOK, models.PathsReportResponse{
		Nodes: nodes,
		Edges: edges,
		Meta: models.ReportMeta{
			QueryTimeMS: time.Since(start).Milliseconds(),
		},
	})
}

func (h *Handlers) ReportLive(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := r.URL.Query().Get("project_id")

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		projectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		respondError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			since := time.Now().Add(-30 * time.Second)
			rows, err := h.ch.Query(ctx, `
				SELECT event_id, event_name, event_type, ts, anon_id, user_id, url, country, city, ua_browser, ua_os, ua_device_type
				FROM events
				WHERE project_id = $1 AND ts >= $2
				ORDER BY ts DESC
				LIMIT 20
			`, projectID, since)

			if err != nil {
				continue
			}

			var events []models.LiveEvent
			for rows.Next() {
				var e models.LiveEvent
				rows.Scan(&e.EventID, &e.EventName, &e.EventType, &e.Timestamp, &e.AnonID,
					&e.UserID, &e.URL, &e.Country, &e.City, &e.Browser, &e.OS, &e.DeviceType)
				events = append(events, e)
			}
			rows.Close()

			var activeUsers uint64
			h.ch.QueryRow(ctx, `
				SELECT COUNT(DISTINCT anon_id)
				FROM events
				WHERE project_id = $1 AND ts >= now() - INTERVAL 5 MINUTE
			`, projectID).Scan(&activeUsers)

			response := models.LiveReportResponse{
				Events:          events,
				ActiveUsers:     int64(activeUsers),
				EventsPerMinute: float64(len(events)) * 2,
			}

			data, _ := json.Marshal(response)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (h *Handlers) GetUserTimeline(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	anonID := chi.URLParam(r, "anonID")
	projectIDStr := r.URL.Query().Get("project_id")

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		projectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	limit := 100
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	var user models.UserState
	h.ch.QueryRow(r.Context(), `
		SELECT
			project_id, anon_id, anyIf(user_id, user_id IS NOT NULL),
			min(ts), max(ts), COUNT(DISTINCT session_id), count(), countIf(event_name = 'page_view'),
			sum(ifNull(revenue, 0))
		FROM events
		WHERE project_id = $1 AND anon_id = $2
		GROUP BY project_id, anon_id
	`, projectID, anonID).Scan(
		&user.ProjectID, &user.AnonID, &user.UserID,
		&user.FirstSeen, &user.LastSeen, &user.TotalSessions,
		&user.TotalEvents, &user.TotalPageViews, &user.TotalRevenue,
	)
	user.WorkspaceID = workspaceID

	rows, err := h.ch.Query(r.Context(), `
		SELECT
			event_id, event_name, event_type, ts, session_id, url, path, referrer,
			country, city, ua_browser, ua_os, ua_device_type,
			revenue, props_string, user_props
		FROM events
		WHERE project_id = $1 AND anon_id = $2
		ORDER BY ts DESC
		LIMIT $3 OFFSET $4
	`, projectID, anonID, limit, offset)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		rows.Scan(&e.EventID, &e.EventName, &e.EventType, &e.Timestamp, &e.SessionID,
			&e.URL, &e.Path, &e.Referrer, &e.Country, &e.City, &e.UABrowser, &e.UAOS,
			&e.UADeviceType, &e.Revenue, &e.PropsString, &e.UserProps)
		e.WorkspaceID = workspaceID
		e.ProjectID = projectID
		e.AnonID = anonID
		events = append(events, e)
	}

	if events == nil {
		events = []models.Event{}
	}

	var total uint64
	h.ch.QueryRow(r.Context(), `
		SELECT count() FROM events WHERE project_id = $1 AND anon_id = $2
	`, projectID, anonID).Scan(&total)

	respondJSON(w, http.StatusOK, models.UserTimelineResponse{
		User:   user,
		Events: events,
		Total:  int64(total),
	})
}

func (h *Handlers) GetSession(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	sessionID := chi.URLParam(r, "sessionID")
	projectIDStr := r.URL.Query().Get("project_id")

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid project ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM projects WHERE id = $1`,
		projectID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusForbidden, "project not found or access denied")
		return
	}

	var session models.Session
	h.ch.QueryRow(r.Context(), `
		SELECT
			session_id, any(anon_id), anyIf(user_id, user_id IS NOT NULL),
			min(ts), max(ts), dateDiff('second', min(ts), max(ts)),
			argMin(url, ts), argMin(path, ts), argMax(url, ts), argMax(path, ts),
			countIf(event_name = 'page_view'), count(),
			if(countIf(event_name = 'page_view') <= 1, 1, 0),
			argMin(referrer, ts),
			any(country), any(region), any(city),
			any(ua_browser), any(ua_os), any(ua_device_type),
			sum(ifNull(revenue, 0)), if(countIf(event_name = 'purchase') > 0, 1, 0)
		FROM events
		WHERE project_id = $1 AND session_id = $2
		GROUP BY session_id
	`, projectID, sessionID).Scan(
		&session.SessionID, &session.AnonID, &session.UserID,
		&session.StartedAt, &session.EndedAt, &session.DurationSeconds,
		&session.EntryURL, &session.EntryPath, &session.ExitURL, &session.ExitPath,
		&session.PageViews, &session.EventsCount, &session.IsBounce,
		&session.Referrer,
		&session.Country, &session.Region, &session.City,
		&session.UABrowser, &session.UAOS, &session.UADeviceType,
		&session.Revenue, &session.HasPurchase,
	)
	session.WorkspaceID = workspaceID
	session.ProjectID = projectID

	rows, err := h.ch.Query(r.Context(), `
		SELECT
			event_id, event_name, event_type, ts, url, path, referrer,
			props_string, revenue
		FROM events
		WHERE project_id = $1 AND session_id = $2
		ORDER BY ts
	`, projectID, sessionID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed")
		return
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		rows.Scan(&e.EventID, &e.EventName, &e.EventType, &e.Timestamp,
			&e.URL, &e.Path, &e.Referrer, &e.PropsString, &e.Revenue)
		e.WorkspaceID = workspaceID
		e.ProjectID = projectID
		e.SessionID = sessionID
		events = append(events, e)
	}

	if events == nil {
		events = []models.Event{}
	}

	respondJSON(w, http.StatusOK, models.SessionDetailResponse{
		Session: session,
		Events:  events,
	})
}

// GetSummary returns comprehensive analytics summary with bounce rate, time on page, sessions, etc.
func (h *Handlers) GetSummary(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := r.URL.Query().Get("project_id")
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	var projectID uuid.UUID
	var allProjects bool
	if projectIDStr == "all" || projectIDStr == "" {
		allProjects = true
	} else {
		var err error
		projectID, err = uuid.Parse(projectIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid project ID")
			return
		}
	}

	startTime := time.Now().AddDate(0, 0, -30)
	endTime := time.Now()

	if startStr != "" {
		if t, err := time.Parse(time.RFC3339Nano, startStr); err == nil {
			startTime = t
		} else if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = t
		} else if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startTime = t
		}
	}
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339Nano, endStr); err == nil {
			endTime = t
		} else if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = t
		} else if t, err := time.Parse("2006-01-02", endStr); err == nil {
			endTime = t.Add(24*time.Hour - time.Second)
		}
	}

	type SourceEntry struct {
		Source   string  `json:"source"`
		Category string  `json:"category"`
		Count    int64   `json:"count"`
		Percent  float64 `json:"percent"`
	}
	type PageEntry struct {
		Path        string  `json:"path"`
		Views       int64   `json:"views"`
		UniqueViews int64   `json:"unique_views"`
		AvgTime     float64 `json:"avg_time_seconds"`
		BounceRate  float64 `json:"bounce_rate"`
	}
	type ParamEntry struct {
		Parameter string `json:"parameter"`
		Value     string `json:"value"`
		Count     int64  `json:"count"`
	}
	type DeviceEntry struct {
		DeviceType string  `json:"device_type"`
		Count      int64   `json:"count"`
		Percent    float64 `json:"percent"`
	}
	type CountryEntry struct {
		Country string  `json:"country"`
		Count   int64   `json:"count"`
		Percent float64 `json:"percent"`
	}
	type BrowserEntry struct {
		Browser string  `json:"browser"`
		Count   int64   `json:"count"`
		Percent float64 `json:"percent"`
	}
	type SummaryResponse struct {
		TotalEvents        int64          `json:"total_events"`
		TotalPageViews     int64          `json:"total_page_views"`
		TotalSessions      int64          `json:"total_sessions"`
		TotalUniqueUsers   int64          `json:"total_unique_users"`
		TotalRevenue       float64        `json:"total_revenue"`
		BounceRate         float64        `json:"bounce_rate"`
		AvgSessionDuration float64        `json:"avg_session_duration_seconds"`
		AvgTimeOnPage      float64        `json:"avg_time_on_page_seconds"`
		AvgPageViews       float64        `json:"avg_page_views_per_session"`
		NewUsersPercent    float64        `json:"new_users_percent"`
		TopSources         []SourceEntry  `json:"top_sources"`
		TopPages           []PageEntry    `json:"top_pages"`
		TopParameters      []ParamEntry   `json:"top_parameters"`
		ByDevice           []DeviceEntry  `json:"by_device"`
		ByCountry          []CountryEntry `json:"by_country"`
		ByBrowser          []BrowserEntry `json:"by_browser"`
	}

	response := SummaryResponse{
		TopSources:    []SourceEntry{},
		TopPages:      []PageEntry{},
		TopParameters: []ParamEntry{},
		ByDevice:      []DeviceEntry{},
		ByCountry:     []CountryEntry{},
		ByBrowser:     []BrowserEntry{},
	}

	var whereClause string
	var args []interface{}

	if allProjects {
		whereClause = "workspace_id = $1 AND ts >= $2 AND ts <= $3"
		args = []interface{}{workspaceID, startTime, endTime}
	} else {
		var projectWorkspaceID uuid.UUID
		err := h.pg.QueryRow(r.Context(),
			`SELECT workspace_id FROM projects WHERE id = $1`,
			projectID,
		).Scan(&projectWorkspaceID)
		if err != nil || projectWorkspaceID != workspaceID {
			respondError(w, http.StatusForbidden, "project not found or access denied")
			return
		}
		whereClause = "project_id = $1 AND ts >= $2 AND ts <= $3"
		args = []interface{}{projectID, startTime, endTime}
	}

	h.log.Info().Str("where", whereClause).Str("start", startTime.String()).Str("end", endTime.String()).Msg("Summary query params")

	// Main stats query
	if err := h.ch.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT
			count() AS total_events,
			countIf(event_name = 'page_view') AS total_page_views,
			uniqExact(session_id) AS total_sessions,
			uniqExact(anon_id) AS total_unique_users,
			sum(revenue) AS total_revenue
		FROM events
		WHERE %s
	`, whereClause), args...).Scan(
		&response.TotalEvents, &response.TotalPageViews,
		&response.TotalSessions, &response.TotalUniqueUsers, &response.TotalRevenue,
	); err != nil {
		h.log.Error().Err(err).Msg("Summary: main stats query failed")
	} else {
		h.log.Info().Int64("events", response.TotalEvents).Int64("pvs", response.TotalPageViews).Int64("sessions", response.TotalSessions).Int64("users", response.TotalUniqueUsers).Msg("Summary: main stats")
	}

	// Session metrics with bounce rate and avg duration
	var bounceSessions, totalSessionsForBounce uint64
	var avgDuration float64
	if err := h.ch.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT
			countIf(pv_count <= 1) AS bounce_sessions,
			count() AS total_sessions,
			avg(duration_sec) AS avg_duration
		FROM (
			SELECT
				session_id,
				countIf(event_name = 'page_view') AS pv_count,
				dateDiff('second', min(ts), max(ts)) AS duration_sec
			FROM events
			WHERE %s
			GROUP BY session_id
		)
	`, whereClause), args...).Scan(&bounceSessions, &totalSessionsForBounce, &avgDuration); err != nil {
		h.log.Error().Err(err).Msg("Summary: session metrics query failed")
	}

	if totalSessionsForBounce > 0 {
		response.BounceRate = float64(bounceSessions) / float64(totalSessionsForBounce) * 100
	}
	response.AvgSessionDuration = avgDuration
	if response.TotalSessions > 0 {
		response.AvgPageViews = float64(response.TotalPageViews) / float64(response.TotalSessions)
	}
	if response.TotalSessions > 0 && response.AvgPageViews > 0 {
		response.AvgTimeOnPage = response.AvgSessionDuration / response.AvgPageViews
	}

	// New users percentage
	var newUsers uint64
	if err := h.ch.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT countIf(is_new_session = 1)
		FROM events
		WHERE %s AND event_name = 'page_view'
	`, whereClause), args...).Scan(&newUsers); err != nil {
		h.log.Error().Err(err).Msg("Summary: new users query failed")
	}
	if response.TotalUniqueUsers > 0 {
		response.NewUsersPercent = float64(newUsers) / float64(response.TotalUniqueUsers) * 100
	}

	// Top traffic sources
	sourceRows, sourceErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT source, category, cnt FROM (
			SELECT
				if(ref_source = '', 'Direct', ref_source) AS source,
				if(ref_source_category = '', 'direct', ref_source_category) AS category,
				count() AS cnt
			FROM events
			WHERE %s AND event_name = 'page_view'
			GROUP BY ref_source, ref_source_category
		)
		ORDER BY cnt DESC
		LIMIT 10
	`, whereClause), args...)
	if sourceErr != nil {
		h.log.Error().Err(sourceErr).Msg("Summary: sources query failed")
	}
	if sourceRows != nil {
		defer sourceRows.Close()
		for sourceRows.Next() {
			var source, category string
			var count uint64
			if err := sourceRows.Scan(&source, &category, &count); err != nil {
				h.log.Error().Err(err).Msg("Summary: sources scan failed")
				continue
			}
			pct := 0.0
			if response.TotalPageViews > 0 {
				pct = float64(count) / float64(response.TotalPageViews) * 100
			}
			response.TopSources = append(response.TopSources, SourceEntry{source, category, int64(count), pct})
		}
	}

	// Top pages
	pageRows, pageErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT
			path,
			count() AS views,
			uniqExact(session_id) AS unique_views,
			avg(dateDiff('second', ts, ts)) AS avg_time
		FROM events
		WHERE %s AND event_name = 'page_view'
		GROUP BY path
		ORDER BY views DESC
		LIMIT 10
	`, whereClause), args...)
	if pageErr != nil {
		h.log.Error().Err(pageErr).Msg("Summary: pages query failed")
	}
	if pageRows != nil {
		defer pageRows.Close()
		for pageRows.Next() {
			var path string
			var views, uniqueViews uint64
			var avgTime float64
			if err := pageRows.Scan(&path, &views, &uniqueViews, &avgTime); err != nil {
				h.log.Error().Err(err).Msg("Summary: pages scan failed")
				continue
			}
			response.TopPages = append(response.TopPages, PageEntry{path, int64(views), int64(uniqueViews), avgTime, 0})
		}
	}

	// Top URL parameters from utm Map column using ARRAY JOIN
	paramRows, paramErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT
			k AS param,
			v AS value,
			count() AS cnt
		FROM events
		ARRAY JOIN
			mapKeys(utm) AS k,
			mapValues(utm) AS v
		WHERE %s AND length(mapKeys(utm)) > 0 AND k != '' AND v != ''
		GROUP BY k, v
		ORDER BY cnt DESC
		LIMIT 20
	`, whereClause), args...)
	if paramErr != nil {
		h.log.Error().Err(paramErr).Msg("Summary: UTM ARRAY JOIN query failed, trying fallback")
		paramRows, paramErr = h.ch.Query(r.Context(), fmt.Sprintf(`
			SELECT param, value, cnt FROM (
				SELECT 'utm_source' AS param, utm['utm_source'] AS value, count() AS cnt
				FROM events WHERE %s AND utm['utm_source'] != '' GROUP BY value
				UNION ALL
				SELECT 'utm_medium', utm['utm_medium'], count()
				FROM events WHERE %s AND utm['utm_medium'] != '' GROUP BY utm['utm_medium']
				UNION ALL
				SELECT 'utm_campaign', utm['utm_campaign'], count()
				FROM events WHERE %s AND utm['utm_campaign'] != '' GROUP BY utm['utm_campaign']
			) ORDER BY cnt DESC LIMIT 20
		`, whereClause, whereClause, whereClause),
			append(append(args, args...), args...)...)
		if paramErr != nil {
			h.log.Error().Err(paramErr).Msg("Summary: UTM fallback query also failed")
		}
	}
	if paramRows != nil {
		defer paramRows.Close()
		for paramRows.Next() {
			var param, value string
			var count uint64
			if err := paramRows.Scan(&param, &value, &count); err != nil {
				h.log.Error().Err(err).Msg("Summary: params scan failed")
				continue
			}
			response.TopParameters = append(response.TopParameters, ParamEntry{param, value, int64(count)})
		}
	}

	// By device type
	deviceRows, deviceErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT if(ua_device_type = '', 'unknown', ua_device_type) AS dt, count() AS cnt
		FROM events
		WHERE %s AND event_name = 'page_view'
		GROUP BY ua_device_type
		ORDER BY cnt DESC
	`, whereClause), args...)
	if deviceErr != nil {
		h.log.Error().Err(deviceErr).Msg("Summary: device query failed")
	}
	if deviceRows != nil {
		defer deviceRows.Close()
		for deviceRows.Next() {
			var device string
			var count uint64
			if err := deviceRows.Scan(&device, &count); err != nil {
				h.log.Error().Err(err).Msg("Summary: device scan failed")
				continue
			}
			pct := 0.0
			if response.TotalPageViews > 0 {
				pct = float64(count) / float64(response.TotalPageViews) * 100
			}
			response.ByDevice = append(response.ByDevice, DeviceEntry{device, int64(count), pct})
		}
	}

	// By country
	countryRows, countryErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT if(country = '', 'Unknown', country) AS c, count() AS cnt
		FROM events
		WHERE %s AND event_name = 'page_view'
		GROUP BY country
		ORDER BY cnt DESC
		LIMIT 10
	`, whereClause), args...)
	if countryErr != nil {
		h.log.Error().Err(countryErr).Msg("Summary: country query failed")
	}
	if countryRows != nil {
		defer countryRows.Close()
		for countryRows.Next() {
			var country string
			var count uint64
			if err := countryRows.Scan(&country, &count); err != nil {
				h.log.Error().Err(err).Msg("Summary: country scan failed")
				continue
			}
			pct := 0.0
			if response.TotalPageViews > 0 {
				pct = float64(count) / float64(response.TotalPageViews) * 100
			}
			response.ByCountry = append(response.ByCountry, CountryEntry{country, int64(count), pct})
		}
	}

	// By browser
	browserRows, browserErr := h.ch.Query(r.Context(), fmt.Sprintf(`
		SELECT if(ua_browser = '', 'Unknown', ua_browser) AS b, count() AS cnt
		FROM events
		WHERE %s AND event_name = 'page_view'
		GROUP BY ua_browser
		ORDER BY cnt DESC
		LIMIT 10
	`, whereClause), args...)
	if browserErr != nil {
		h.log.Error().Err(browserErr).Msg("Summary: browser query failed")
	}
	if browserRows != nil {
		defer browserRows.Close()
		for browserRows.Next() {
			var browser string
			var count uint64
			if err := browserRows.Scan(&browser, &count); err != nil {
				h.log.Error().Err(err).Msg("Summary: browser scan failed")
				continue
			}
			pct := 0.0
			if response.TotalPageViews > 0 {
				pct = float64(count) / float64(response.TotalPageViews) * 100
			}
			response.ByBrowser = append(response.ByBrowser, BrowserEntry{browser, int64(count), pct})
		}
	}

	h.log.Info().
		Int("sources", len(response.TopSources)).
		Int("pages", len(response.TopPages)).
		Int("params", len(response.TopParameters)).
		Int("devices", len(response.ByDevice)).
		Int("countries", len(response.ByCountry)).
		Int("browsers", len(response.ByBrowser)).
		Msg("Summary response counts")

	respondJSON(w, http.StatusOK, response)
}

func (h *Handlers) GetRawEvents(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := r.URL.Query().Get("project_id")
	eventName := r.URL.Query().Get("event_name")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	allProjects := projectIDStr == "all" || projectIDStr == ""

	if !allProjects {
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid project ID")
			return
		}

		var projectWorkspaceID uuid.UUID
		err = h.pg.QueryRow(r.Context(),
			`SELECT workspace_id FROM projects WHERE id = $1`,
			projectID,
		).Scan(&projectWorkspaceID)

		if err != nil || projectWorkspaceID != workspaceID {
			respondError(w, http.StatusForbidden, "project not found or access denied")
			return
		}
		_ = projectID
	}

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	offset := 0
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	var whereClause string
	var args []interface{}
	var argIdx int

	if allProjects {
		whereClause = "workspace_id = $1"
		args = []interface{}{workspaceID}
		argIdx = 2
	} else {
		projectID, _ := uuid.Parse(projectIDStr)
		whereClause = "project_id = $1"
		args = []interface{}{projectID}
		argIdx = 2
	}

	if eventName != "" {
		whereClause += fmt.Sprintf(" AND event_name = $%d", argIdx)
		args = append(args, eventName)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT
			event_id, event_name, event_type, ts, received_at,
			anon_id, user_id, session_id,
			url, path, title, referrer, search, utm,
			ref_source, ref_source_category, ref_medium,
			country, city, ua_browser, ua_os, ua_device_type,
			revenue, order_id, product_id, product_name,
			props_string
		FROM events
		WHERE %s
		ORDER BY ts DESC
		LIMIT %d OFFSET %d
	`, whereClause, limit, offset)

	rows, err := h.ch.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	type RawEvent struct {
		EventID           string            `json:"event_id"`
		EventName         string            `json:"event_name"`
		EventType         string            `json:"event_type"`
		Timestamp         time.Time         `json:"timestamp"`
		ReceivedAt        time.Time         `json:"received_at"`
		AnonID            string            `json:"anon_id"`
		UserID            *string           `json:"user_id,omitempty"`
		SessionID         string            `json:"session_id"`
		URL               string            `json:"url"`
		Path              string            `json:"path"`
		Title             string            `json:"title"`
		Referrer          string            `json:"referrer"`
		QueryString       string            `json:"query_string,omitempty"`
		UTMParams         map[string]string `json:"utm_params,omitempty"`
		RefSource         string            `json:"ref_source"`
		RefSourceCategory string            `json:"ref_source_category"`
		RefMedium         string            `json:"ref_medium"`
		Country           string            `json:"country"`
		City              string            `json:"city"`
		Browser           string            `json:"browser"`
		OS                string            `json:"os"`
		DeviceType        string            `json:"device_type"`
		Revenue           *float64          `json:"revenue,omitempty"`
		OrderID           *string           `json:"order_id,omitempty"`
		ProductID         *string           `json:"product_id,omitempty"`
		ProductName       *string           `json:"product_name,omitempty"`
		Properties        map[string]string `json:"properties,omitempty"`
	}

	var events []RawEvent
	for rows.Next() {
		var e RawEvent
		var propsMap map[string]string
		var utmMap map[string]string
		err := rows.Scan(
			&e.EventID, &e.EventName, &e.EventType, &e.Timestamp, &e.ReceivedAt,
			&e.AnonID, &e.UserID, &e.SessionID,
			&e.URL, &e.Path, &e.Title, &e.Referrer, &e.QueryString, &utmMap,
			&e.RefSource, &e.RefSourceCategory, &e.RefMedium,
			&e.Country, &e.City, &e.Browser, &e.OS, &e.DeviceType,
			&e.Revenue, &e.OrderID, &e.ProductID, &e.ProductName,
			&propsMap,
		)
		if err != nil {
			continue
		}
		if len(propsMap) > 0 {
			e.Properties = propsMap
		}
		if len(utmMap) > 0 {
			e.UTMParams = utmMap
		}
		events = append(events, e)
	}

	if events == nil {
		events = []RawEvent{}
	}

	var total uint64
	countQuery := fmt.Sprintf(`SELECT count() FROM events WHERE %s`, whereClause)
	h.ch.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"events": events,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
