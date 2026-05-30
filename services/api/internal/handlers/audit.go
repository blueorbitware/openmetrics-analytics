package handlers

import (
	"net/http"
	"strconv"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/models"
)

func (h *Handlers) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

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

	action := r.URL.Query().Get("action")

	var rows interface{ Close(); Next() bool; Scan(...any) error }
	var err error

	if action != "" {
		rows, err = h.pg.Query(r.Context(),
			`SELECT id, workspace_id, actor_user_id, action, target_type, target_id, meta, ip_address, user_agent, created_at
			 FROM audit_log
			 WHERE workspace_id = $1 AND action = $2
			 ORDER BY created_at DESC
			 LIMIT $3 OFFSET $4`,
			workspaceID, action, limit, offset)
	} else {
		rows, err = h.pg.Query(r.Context(),
			`SELECT id, workspace_id, actor_user_id, action, target_type, target_id, meta, ip_address, user_agent, created_at
			 FROM audit_log
			 WHERE workspace_id = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			workspaceID, limit, offset)
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch audit logs")
		return
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		if err := rows.Scan(&log.ID, &log.WorkspaceID, &log.ActorUserID, &log.Action,
			&log.TargetType, &log.TargetID, &log.Meta, &log.IPAddress, &log.UserAgent, &log.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, log)
	}

	if logs == nil {
		logs = []models.AuditLog{}
	}

	var total int
	h.pg.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM audit_log WHERE workspace_id = $1`,
		workspaceID,
	).Scan(&total)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
