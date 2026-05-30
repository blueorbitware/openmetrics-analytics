package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CreateWorkspaceRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug,omitempty"`
}

type UpdateWorkspaceRequest struct {
	Name         *string                `json:"name,omitempty"`
	Branding     map[string]interface{} `json:"branding,omitempty"`
	CustomDomain *string                `json:"custom_domain,omitempty"`
}

type InviteMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (h *Handlers) ListWorkspaces(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var workspaces []models.Workspace

	if claims.IsSuperAdmin {
		rows, err := h.pg.Query(r.Context(),
			`SELECT id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at
			 FROM workspaces ORDER BY created_at DESC`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to fetch workspaces")
			return
		}
		defer rows.Close()

		for rows.Next() {
			var ws models.Workspace
			if err := rows.Scan(&ws.ID, &ws.Name, &ws.Slug, &ws.Plan, &ws.Branding,
				&ws.CustomDomain, &ws.IsSuspended, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
				continue
			}
			workspaces = append(workspaces, ws)
		}
	} else {
		rows, err := h.pg.Query(r.Context(),
			`SELECT w.id, w.name, w.slug, w.plan, w.branding, w.custom_domain, w.is_suspended, w.created_at, w.updated_at
			 FROM workspaces w
			 JOIN memberships m ON w.id = m.workspace_id
			 WHERE m.user_id = $1
			 ORDER BY w.created_at DESC`,
			claims.UserID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to fetch workspaces")
			return
		}
		defer rows.Close()

		for rows.Next() {
			var ws models.Workspace
			if err := rows.Scan(&ws.ID, &ws.Name, &ws.Slug, &ws.Plan, &ws.Branding,
				&ws.CustomDomain, &ws.IsSuspended, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
				continue
			}
			workspaces = append(workspaces, ws)
		}
	}

	if workspaces == nil {
		workspaces = []models.Workspace{}
	}

	respondJSON(w, http.StatusOK, workspaces)
}

func (h *Handlers) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateWorkspaceRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
		return
	}

	slug := req.Slug
	if slug == "" {
		slug = strings.ReplaceAll(strings.ToLower(req.Name), " ", "-")
		slug = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(slug, "")
	}

	workspaceID := uuid.New()
	var workspace models.Workspace

	err := h.pg.QueryRow(r.Context(),
		`INSERT INTO workspaces (id, name, slug)
		 VALUES ($1, $2, $3)
		 RETURNING id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at`,
		workspaceID, req.Name, slug,
	).Scan(&workspace.ID, &workspace.Name, &workspace.Slug, &workspace.Plan, &workspace.Branding,
		&workspace.CustomDomain, &workspace.IsSuspended, &workspace.CreatedAt, &workspace.UpdatedAt)

	if err != nil {
		slug = slug + "-" + workspaceID.String()[:8]
		err = h.pg.QueryRow(r.Context(),
			`INSERT INTO workspaces (id, name, slug)
			 VALUES ($1, $2, $3)
			 RETURNING id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at`,
			workspaceID, req.Name, slug,
		).Scan(&workspace.ID, &workspace.Name, &workspace.Slug, &workspace.Plan, &workspace.Branding,
			&workspace.CustomDomain, &workspace.IsSuspended, &workspace.CreatedAt, &workspace.UpdatedAt)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create workspace")
			return
		}
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
		workspaceID, claims.UserID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create membership")
		return
	}

	respondJSON(w, http.StatusCreated, workspace)
}

func (h *Handlers) GetWorkspace(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	if workspaceID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "invalid workspace")
		return
	}

	var workspace models.Workspace
	err := h.pg.QueryRow(r.Context(),
		`SELECT id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at
		 FROM workspaces WHERE id = $1`,
		workspaceID,
	).Scan(&workspace.ID, &workspace.Name, &workspace.Slug, &workspace.Plan, &workspace.Branding,
		&workspace.CustomDomain, &workspace.IsSuspended, &workspace.CreatedAt, &workspace.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "workspace not found")
		return
	}

	respondJSON(w, http.StatusOK, workspace)
}

func (h *Handlers) UpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	var req UpdateWorkspaceRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		err := h.pg.Exec(r.Context(),
			`UPDATE workspaces SET name = $1 WHERE id = $2`,
			*req.Name, workspaceID,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update workspace")
			return
		}
	}

	if req.Branding != nil {
		err := h.pg.Exec(r.Context(),
			`UPDATE workspaces SET branding = $1 WHERE id = $2`,
			req.Branding, workspaceID,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update branding")
			return
		}
	}

	if req.CustomDomain != nil {
		err := h.pg.Exec(r.Context(),
			`UPDATE workspaces SET custom_domain = $1 WHERE id = $2`,
			*req.CustomDomain, workspaceID,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update custom domain")
			return
		}
	}

	var workspace models.Workspace
	err := h.pg.QueryRow(r.Context(),
		`SELECT id, name, slug, plan, branding, custom_domain, is_suspended, created_at, updated_at
		 FROM workspaces WHERE id = $1`,
		workspaceID,
	).Scan(&workspace.ID, &workspace.Name, &workspace.Slug, &workspace.Plan, &workspace.Branding,
		&workspace.CustomDomain, &workspace.IsSuspended, &workspace.CreatedAt, &workspace.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "workspace not found")
		return
	}

	respondJSON(w, http.StatusOK, workspace)
}

func (h *Handlers) InviteMember(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	var req InviteMemberRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Role != "admin" && req.Role != "user" {
		req.Role = "user"
	}

	var userID uuid.UUID
	err := h.pg.QueryRow(r.Context(),
		`SELECT id FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID)

	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	var exists bool
	err = h.pg.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2)`,
		workspaceID, userID,
	).Scan(&exists)

	if exists {
		respondError(w, http.StatusConflict, "user is already a member")
		return
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO memberships (workspace_id, user_id, role, invited_by)
		 VALUES ($1, $2, $3, $4)`,
		workspaceID, userID, req.Role, claims.UserID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to add member")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "member added successfully"})
}

func (h *Handlers) ListMembers(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	rows, err := h.pg.Query(r.Context(),
		`SELECT u.id, u.email, u.name, u.avatar_url, u.created_at, m.role, m.joined_at
		 FROM users u
		 JOIN memberships m ON u.id = m.user_id
		 WHERE m.workspace_id = $1
		 ORDER BY m.joined_at`,
		workspaceID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch members")
		return
	}
	defer rows.Close()

	type MemberResponse struct {
		ID        uuid.UUID  `json:"id"`
		Email     string     `json:"email"`
		Name      string     `json:"name"`
		AvatarURL *string    `json:"avatar_url,omitempty"`
		Role      string     `json:"role"`
		JoinedAt  string     `json:"joined_at"`
	}

	var members []MemberResponse
	for rows.Next() {
		var m MemberResponse
		var joinedAt interface{}
		var createdAt interface{}
		if err := rows.Scan(&m.ID, &m.Email, &m.Name, &m.AvatarURL, &createdAt, &m.Role, &joinedAt); err != nil {
			continue
		}
		members = append(members, m)
	}

	if members == nil {
		members = []MemberResponse{}
	}

	respondJSON(w, http.StatusOK, members)
}

func (h *Handlers) RemoveMember(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	role := middleware.GetRole(r.Context())
	claims := middleware.GetClaims(r.Context())

	if role != "admin" && !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "admin access required")
		return
	}

	userIDStr := chi.URLParam(r, "userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	if userID == claims.UserID {
		respondError(w, http.StatusBadRequest, "cannot remove yourself")
		return
	}

	err = h.pg.Exec(r.Context(),
		`DELETE FROM memberships WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "member removed successfully"})
}
