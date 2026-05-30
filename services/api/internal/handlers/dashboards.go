package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CreateDashboardRequest struct {
	ProjectID   uuid.UUID       `json:"project_id"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Layout      json.RawMessage `json:"layout,omitempty"`
}

type UpdateDashboardRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Layout      *json.RawMessage `json:"layout,omitempty"`
	IsDefault   *bool            `json:"is_default,omitempty"`
}

type DashboardWithReports struct {
	models.Dashboard
	Reports []models.Report `json:"reports"`
}

func (h *Handlers) ListDashboards(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	projectIDStr := r.URL.Query().Get("project_id")

	var rows interface{ Close(); Next() bool; Scan(...any) error }
	var err error

	if projectIDStr != "" {
		projectID, parseErr := uuid.Parse(projectIDStr)
		if parseErr != nil {
			respondError(w, http.StatusBadRequest, "invalid project ID")
			return
		}
		rows, err = h.pg.Query(r.Context(),
			`SELECT d.id, d.project_id, d.name, d.description, d.layout, d.is_default, d.created_by, d.created_at, d.updated_at
			 FROM dashboards d
			 JOIN projects p ON d.project_id = p.id
			 WHERE p.workspace_id = $1 AND d.project_id = $2
			 ORDER BY d.is_default DESC, d.created_at DESC`,
			workspaceID, projectID)
	} else {
		rows, err = h.pg.Query(r.Context(),
			`SELECT d.id, d.project_id, d.name, d.description, d.layout, d.is_default, d.created_by, d.created_at, d.updated_at
			 FROM dashboards d
			 JOIN projects p ON d.project_id = p.id
			 WHERE p.workspace_id = $1
			 ORDER BY d.is_default DESC, d.created_at DESC`,
			workspaceID)
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch dashboards")
		return
	}
	defer rows.Close()

	var dashboards []models.Dashboard
	for rows.Next() {
		var d models.Dashboard
		if err := rows.Scan(&d.ID, &d.ProjectID, &d.Name, &d.Description, &d.Layout,
			&d.IsDefault, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt); err != nil {
			continue
		}
		dashboards = append(dashboards, d)
	}

	if dashboards == nil {
		dashboards = []models.Dashboard{}
	}

	respondJSON(w, http.StatusOK, dashboards)
}

func (h *Handlers) CreateDashboard(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	claims := middleware.GetClaims(r.Context())

	var req CreateDashboardRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
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

	if req.Layout == nil {
		req.Layout = json.RawMessage(`[]`)
	}

	dashboardID := uuid.New()
	var dashboard models.Dashboard

	err = h.pg.QueryRow(r.Context(),
		`INSERT INTO dashboards (id, project_id, name, description, layout, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, project_id, name, description, layout, is_default, created_by, created_at, updated_at`,
		dashboardID, req.ProjectID, req.Name, req.Description, req.Layout, claims.UserID,
	).Scan(&dashboard.ID, &dashboard.ProjectID, &dashboard.Name, &dashboard.Description,
		&dashboard.Layout, &dashboard.IsDefault, &dashboard.CreatedBy, &dashboard.CreatedAt, &dashboard.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create dashboard")
		return
	}

	respondJSON(w, http.StatusCreated, dashboard)
}

func (h *Handlers) GetDashboard(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	dashboardIDStr := chi.URLParam(r, "dashboardID")
	dashboardID, err := uuid.Parse(dashboardIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid dashboard ID")
		return
	}

	var dashboard models.Dashboard
	err = h.pg.QueryRow(r.Context(),
		`SELECT d.id, d.project_id, d.name, d.description, d.layout, d.is_default, d.created_by, d.created_at, d.updated_at
		 FROM dashboards d
		 JOIN projects p ON d.project_id = p.id
		 WHERE d.id = $1 AND p.workspace_id = $2`,
		dashboardID, workspaceID,
	).Scan(&dashboard.ID, &dashboard.ProjectID, &dashboard.Name, &dashboard.Description,
		&dashboard.Layout, &dashboard.IsDefault, &dashboard.CreatedBy, &dashboard.CreatedAt, &dashboard.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "dashboard not found")
		return
	}

	rows, _ := h.pg.Query(r.Context(),
		`SELECT id, dashboard_id, project_id, name, type, config, position, created_by, created_at, updated_at
		 FROM reports WHERE dashboard_id = $1 ORDER BY created_at`,
		dashboardID)

	var reports []models.Report
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var rep models.Report
			rows.Scan(&rep.ID, &rep.DashboardID, &rep.ProjectID, &rep.Name, &rep.Type,
				&rep.Config, &rep.Position, &rep.CreatedBy, &rep.CreatedAt, &rep.UpdatedAt)
			reports = append(reports, rep)
		}
	}

	if reports == nil {
		reports = []models.Report{}
	}

	respondJSON(w, http.StatusOK, DashboardWithReports{
		Dashboard: dashboard,
		Reports:   reports,
	})
}

func (h *Handlers) UpdateDashboard(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	dashboardIDStr := chi.URLParam(r, "dashboardID")
	dashboardID, err := uuid.Parse(dashboardIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid dashboard ID")
		return
	}

	var req UpdateDashboardRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT p.workspace_id FROM dashboards d
		 JOIN projects p ON d.project_id = p.id
		 WHERE d.id = $1`,
		dashboardID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "dashboard not found")
		return
	}

	if req.Name != nil {
		h.pg.Exec(r.Context(), `UPDATE dashboards SET name = $1 WHERE id = $2`, *req.Name, dashboardID)
	}
	if req.Description != nil {
		h.pg.Exec(r.Context(), `UPDATE dashboards SET description = $1 WHERE id = $2`, *req.Description, dashboardID)
	}
	if req.Layout != nil {
		h.pg.Exec(r.Context(), `UPDATE dashboards SET layout = $1 WHERE id = $2`, *req.Layout, dashboardID)
	}
	if req.IsDefault != nil && *req.IsDefault {
		var projectID uuid.UUID
		h.pg.QueryRow(r.Context(), `SELECT project_id FROM dashboards WHERE id = $1`, dashboardID).Scan(&projectID)
		h.pg.Exec(r.Context(), `UPDATE dashboards SET is_default = false WHERE project_id = $1`, projectID)
		h.pg.Exec(r.Context(), `UPDATE dashboards SET is_default = true WHERE id = $1`, dashboardID)
	}

	var dashboard models.Dashboard
	h.pg.QueryRow(r.Context(),
		`SELECT id, project_id, name, description, layout, is_default, created_by, created_at, updated_at
		 FROM dashboards WHERE id = $1`,
		dashboardID,
	).Scan(&dashboard.ID, &dashboard.ProjectID, &dashboard.Name, &dashboard.Description,
		&dashboard.Layout, &dashboard.IsDefault, &dashboard.CreatedBy, &dashboard.CreatedAt, &dashboard.UpdatedAt)

	respondJSON(w, http.StatusOK, dashboard)
}

func (h *Handlers) DeleteDashboard(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	dashboardIDStr := chi.URLParam(r, "dashboardID")
	dashboardID, err := uuid.Parse(dashboardIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid dashboard ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	var isDefault bool
	err = h.pg.QueryRow(r.Context(),
		`SELECT p.workspace_id, d.is_default FROM dashboards d
		 JOIN projects p ON d.project_id = p.id
		 WHERE d.id = $1`,
		dashboardID,
	).Scan(&projectWorkspaceID, &isDefault)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "dashboard not found")
		return
	}

	if isDefault {
		respondError(w, http.StatusBadRequest, "cannot delete default dashboard")
		return
	}

	h.pg.Exec(r.Context(), `DELETE FROM dashboards WHERE id = $1`, dashboardID)

	respondJSON(w, http.StatusOK, map[string]string{"message": "dashboard deleted successfully"})
}
