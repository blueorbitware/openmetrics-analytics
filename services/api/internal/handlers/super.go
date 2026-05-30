package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/auth"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type WorkspaceWithStats struct {
	models.Workspace
	MembersCount  int   `json:"members_count"`
	ProjectsCount int   `json:"projects_count"`
	EventsCount   int64 `json:"events_count"`
}

func (h *Handlers) SuperListWorkspaces(w http.ResponseWriter, r *http.Request) {
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	search := r.URL.Query().Get("search")

	var rows interface{ Close(); Next() bool; Scan(...any) error }
	var err error

	if search != "" {
		rows, err = h.pg.Query(r.Context(),
			`SELECT id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at
			 FROM workspaces
			 WHERE name ILIKE $1 OR slug ILIKE $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			"%"+search+"%", limit, offset)
	} else {
		rows, err = h.pg.Query(r.Context(),
			`SELECT id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at
			 FROM workspaces
			 ORDER BY created_at DESC
			 LIMIT $1 OFFSET $2`,
			limit, offset)
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch workspaces")
		return
	}
	defer rows.Close()

	var workspaces []WorkspaceWithStats
	for rows.Next() {
		var ws models.Workspace
		if err := rows.Scan(&ws.ID, &ws.Name, &ws.Slug, &ws.Plan, &ws.Branding,
			&ws.CustomDomain, &ws.IsSuspended, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
			continue
		}

		var membersCount, projectsCount int
		h.pg.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM memberships WHERE workspace_id = $1`,
			ws.ID,
		).Scan(&membersCount)

		h.pg.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM projects WHERE workspace_id = $1`,
			ws.ID,
		).Scan(&projectsCount)

		workspaces = append(workspaces, WorkspaceWithStats{
			Workspace:     ws,
			MembersCount:  membersCount,
			ProjectsCount: projectsCount,
		})
	}

	if workspaces == nil {
		workspaces = []WorkspaceWithStats{}
	}

	var total int
	h.pg.QueryRow(r.Context(), `SELECT COUNT(*) FROM workspaces`).Scan(&total)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   workspaces,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handlers) SuspendWorkspace(w http.ResponseWriter, r *http.Request) {
	workspaceIDStr := chi.URLParam(r, "workspaceID")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid workspace ID")
		return
	}

	var isSuspended bool
	err = h.pg.QueryRow(r.Context(),
		`SELECT is_suspended FROM workspaces WHERE id = $1`,
		workspaceID,
	).Scan(&isSuspended)

	if err != nil {
		respondError(w, http.StatusNotFound, "workspace not found")
		return
	}

	err = h.pg.Exec(r.Context(),
		`UPDATE workspaces SET is_suspended = $1 WHERE id = $2`,
		!isSuspended, workspaceID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update workspace")
		return
	}

	action := "suspended"
	if isSuspended {
		action = "unsuspended"
	}

	claims := middleware.GetClaims(r.Context())
	h.pg.Exec(r.Context(),
		`INSERT INTO audit_log (workspace_id, actor_user_id, action, target_type, target_id)
		 VALUES ($1, $2, $3, 'workspace', $4)`,
		workspaceID, claims.UserID, "workspace."+action, workspaceID,
	)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "workspace " + action,
		"is_suspended": !isSuspended,
	})
}

func (h *Handlers) Impersonate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "super admin access required")
		return
	}

	userIDStr := chi.URLParam(r, "userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	var user models.User
	err = h.pg.QueryRow(r.Context(),
		`SELECT id, email, name, is_super_admin FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.IsSuperAdmin)

	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	jwtManager := auth.NewJWTManager(
		h.cfg.JWTSecret,
		h.cfg.JWTIssuer,
		h.cfg.JWTAccessDuration,
		h.cfg.JWTRefreshDuration,
	)

	impersonatedClaims := &auth.Claims{
		UserID:       user.ID,
		Email:        user.Email,
		Name:         user.Name,
		IsSuperAdmin: false,
	}

	accessToken, expiresAt, err := jwtManager.GenerateAccessToken(impersonatedClaims)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	h.pg.Exec(r.Context(),
		`INSERT INTO audit_log (workspace_id, actor_user_id, action, target_type, target_id, meta)
		 VALUES (NULL, $1, 'user.impersonate', 'user', $2, '{"impersonated_by": "'|| $1 ||'"}')`,
		claims.UserID, userID,
	)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
		"expires_at":   expiresAt,
		"user":         user,
	})
}

func (h *Handlers) SystemMetrics(w http.ResponseWriter, r *http.Request) {
	var totalWorkspaces, totalUsers, totalProjects int

	h.pg.QueryRow(r.Context(), `SELECT COUNT(*) FROM workspaces`).Scan(&totalWorkspaces)
	h.pg.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
	h.pg.QueryRow(r.Context(), `SELECT COUNT(*) FROM projects`).Scan(&totalProjects)

	var eventsToday, eventsThisMonth uint64
	h.ch.QueryRow(r.Context(), `
		SELECT count() FROM events WHERE ts >= today()
	`).Scan(&eventsToday)
	h.ch.QueryRow(r.Context(), `
		SELECT count() FROM events WHERE ts >= toStartOfMonth(now())
	`).Scan(&eventsThisMonth)

	var activeUsersToday, activeUsersThisMonth uint64
	h.ch.QueryRow(r.Context(), `
		SELECT uniq(anon_id) FROM events WHERE ts >= today()
	`).Scan(&activeUsersToday)
	h.ch.QueryRow(r.Context(), `
		SELECT uniq(anon_id) FROM events WHERE ts >= toStartOfMonth(now())
	`).Scan(&activeUsersThisMonth)

	topWorkspacesRows, _ := h.ch.Query(r.Context(), `
		SELECT workspace_id, count() as events
		FROM events
		WHERE ts >= today() - 7
		GROUP BY workspace_id
		ORDER BY events DESC
		LIMIT 10
	`)

	type WorkspaceEvents struct {
		WorkspaceID uuid.UUID `json:"workspace_id"`
		Events      int64     `json:"events"`
	}
	var topWorkspaces []WorkspaceEvents
	if topWorkspacesRows != nil {
		defer topWorkspacesRows.Close()
		for topWorkspacesRows.Next() {
			var we WorkspaceEvents
			var events uint64
			topWorkspacesRows.Scan(&we.WorkspaceID, &events)
			we.Events = int64(events)
			topWorkspaces = append(topWorkspaces, we)
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"workspaces": map[string]interface{}{
			"total": totalWorkspaces,
		},
		"users": map[string]interface{}{
			"total": totalUsers,
		},
		"projects": map[string]interface{}{
			"total": totalProjects,
		},
		"events": map[string]interface{}{
			"today":      eventsToday,
			"this_month": eventsThisMonth,
		},
		"active_users": map[string]interface{}{
			"today":      activeUsersToday,
			"this_month": activeUsersThisMonth,
		},
		"top_workspaces": topWorkspaces,
		"timestamp":      time.Now(),
	})
}
