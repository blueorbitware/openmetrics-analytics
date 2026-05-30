package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CreateBannerRequest struct {
	ProjectID           uuid.UUID       `json:"project_id"`
	Name                string          `json:"name"`
	Config              json.RawMessage `json:"config"`
	Targeting           json.RawMessage `json:"targeting"`
	FrequencyCapPerUser int             `json:"frequency_cap_per_user"`
	FrequencyCapDays    int             `json:"frequency_cap_days"`
	StartAt             *time.Time      `json:"start_at,omitempty"`
	EndAt               *time.Time      `json:"end_at,omitempty"`
	Variants            []CreateVariantRequest `json:"variants"`
}

type CreateVariantRequest struct {
	Name    string  `json:"name"`
	Weight  int     `json:"weight"`
	HTML    string  `json:"html"`
	CSS     string  `json:"css"`
	CTAURL  *string `json:"cta_url,omitempty"`
	CTAText *string `json:"cta_text,omitempty"`
}

type UpdateBannerRequest struct {
	Name                *string          `json:"name,omitempty"`
	Status              *string          `json:"status,omitempty"`
	Config              *json.RawMessage `json:"config,omitempty"`
	Targeting           *json.RawMessage `json:"targeting,omitempty"`
	FrequencyCapPerUser *int             `json:"frequency_cap_per_user,omitempty"`
	FrequencyCapDays    *int             `json:"frequency_cap_days,omitempty"`
	StartAt             *time.Time       `json:"start_at,omitempty"`
	EndAt               *time.Time       `json:"end_at,omitempty"`
}

type BannerWithVariants struct {
	models.Banner
	Variants []models.BannerVariant `json:"variants"`
}

func (h *Handlers) ListBanners(w http.ResponseWriter, r *http.Request) {
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
			`SELECT b.id, b.project_id, b.name, b.status, b.config, b.targeting,
				    b.frequency_cap_per_user, b.frequency_cap_days, b.start_at, b.end_at,
				    b.created_by, b.created_at, b.updated_at
			 FROM banners b
			 JOIN projects p ON b.project_id = p.id
			 WHERE p.workspace_id = $1 AND b.project_id = $2
			 ORDER BY b.created_at DESC`,
			workspaceID, projectID)
	} else {
		rows, err = h.pg.Query(r.Context(),
			`SELECT b.id, b.project_id, b.name, b.status, b.config, b.targeting,
				    b.frequency_cap_per_user, b.frequency_cap_days, b.start_at, b.end_at,
				    b.created_by, b.created_at, b.updated_at
			 FROM banners b
			 JOIN projects p ON b.project_id = p.id
			 WHERE p.workspace_id = $1
			 ORDER BY b.created_at DESC`,
			workspaceID)
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch banners")
		return
	}
	defer rows.Close()

	var banners []models.Banner
	for rows.Next() {
		var b models.Banner
		if err := rows.Scan(&b.ID, &b.ProjectID, &b.Name, &b.Status, &b.Config, &b.Targeting,
			&b.FrequencyCapPerUser, &b.FrequencyCapDays, &b.StartAt, &b.EndAt,
			&b.CreatedBy, &b.CreatedAt, &b.UpdatedAt); err != nil {
			continue
		}
		banners = append(banners, b)
	}

	if banners == nil {
		banners = []models.Banner{}
	}

	respondJSON(w, http.StatusOK, banners)
}

func (h *Handlers) CreateBanner(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	claims := middleware.GetClaims(r.Context())

	var req CreateBannerRequest
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

	if req.FrequencyCapPerUser == 0 {
		req.FrequencyCapPerUser = 1
	}
	if req.FrequencyCapDays == 0 {
		req.FrequencyCapDays = 7
	}

	if req.Config == nil {
		req.Config = json.RawMessage(`{"type": "modal", "position": "center"}`)
	}
	if req.Targeting == nil {
		req.Targeting = json.RawMessage(`{}`)
	}

	bannerID := uuid.New()
	var banner models.Banner

	err = h.pg.QueryRow(r.Context(),
		`INSERT INTO banners (id, project_id, name, config, targeting, frequency_cap_per_user, frequency_cap_days, start_at, end_at, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id, project_id, name, status, config, targeting, frequency_cap_per_user, frequency_cap_days, start_at, end_at, created_by, created_at, updated_at`,
		bannerID, req.ProjectID, req.Name, req.Config, req.Targeting,
		req.FrequencyCapPerUser, req.FrequencyCapDays, req.StartAt, req.EndAt, claims.UserID,
	).Scan(&banner.ID, &banner.ProjectID, &banner.Name, &banner.Status, &banner.Config, &banner.Targeting,
		&banner.FrequencyCapPerUser, &banner.FrequencyCapDays, &banner.StartAt, &banner.EndAt,
		&banner.CreatedBy, &banner.CreatedAt, &banner.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create banner")
		return
	}

	var variants []models.BannerVariant
	for _, v := range req.Variants {
		variantID := uuid.New()
		var variant models.BannerVariant

		err = h.pg.QueryRow(r.Context(),
			`INSERT INTO banner_variants (id, banner_id, name, weight, html, css, cta_url, cta_text)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 RETURNING id, banner_id, name, weight, html, css, cta_url, cta_text, created_at`,
			variantID, bannerID, v.Name, v.Weight, v.HTML, v.CSS, v.CTAURL, v.CTAText,
		).Scan(&variant.ID, &variant.BannerID, &variant.Name, &variant.Weight, &variant.HTML,
			&variant.CSS, &variant.CTAURL, &variant.CTAText, &variant.CreatedAt)

		if err == nil {
			variants = append(variants, variant)
		}
	}

	if len(req.Variants) == 0 {
		variantID := uuid.New()
		h.pg.Exec(r.Context(),
			`INSERT INTO banner_variants (id, banner_id, name, weight, html, css)
			 VALUES ($1, $2, 'Control', 100, '<div>Your banner content here</div>', '')`,
			variantID, bannerID)
	}

	respondJSON(w, http.StatusCreated, BannerWithVariants{
		Banner:   banner,
		Variants: variants,
	})
}

func (h *Handlers) GetBanner(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	bannerIDStr := chi.URLParam(r, "bannerID")
	bannerID, err := uuid.Parse(bannerIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid banner ID")
		return
	}

	var banner models.Banner
	err = h.pg.QueryRow(r.Context(),
		`SELECT b.id, b.project_id, b.name, b.status, b.config, b.targeting,
			    b.frequency_cap_per_user, b.frequency_cap_days, b.start_at, b.end_at,
			    b.created_by, b.created_at, b.updated_at
		 FROM banners b
		 JOIN projects p ON b.project_id = p.id
		 WHERE b.id = $1 AND p.workspace_id = $2`,
		bannerID, workspaceID,
	).Scan(&banner.ID, &banner.ProjectID, &banner.Name, &banner.Status, &banner.Config, &banner.Targeting,
		&banner.FrequencyCapPerUser, &banner.FrequencyCapDays, &banner.StartAt, &banner.EndAt,
		&banner.CreatedBy, &banner.CreatedAt, &banner.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusNotFound, "banner not found")
		return
	}

	rows, _ := h.pg.Query(r.Context(),
		`SELECT id, banner_id, name, weight, html, css, cta_url, cta_text, created_at
		 FROM banner_variants WHERE banner_id = $1`,
		bannerID)

	var variants []models.BannerVariant
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var v models.BannerVariant
			rows.Scan(&v.ID, &v.BannerID, &v.Name, &v.Weight, &v.HTML, &v.CSS, &v.CTAURL, &v.CTAText, &v.CreatedAt)
			variants = append(variants, v)
		}
	}

	if variants == nil {
		variants = []models.BannerVariant{}
	}

	respondJSON(w, http.StatusOK, BannerWithVariants{
		Banner:   banner,
		Variants: variants,
	})
}

func (h *Handlers) UpdateBanner(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	bannerIDStr := chi.URLParam(r, "bannerID")
	bannerID, err := uuid.Parse(bannerIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid banner ID")
		return
	}

	var req UpdateBannerRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT p.workspace_id FROM banners b
		 JOIN projects p ON b.project_id = p.id
		 WHERE b.id = $1`,
		bannerID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "banner not found")
		return
	}

	if req.Name != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET name = $1 WHERE id = $2`, *req.Name, bannerID)
	}
	if req.Status != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET status = $1 WHERE id = $2`, *req.Status, bannerID)
	}
	if req.Config != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET config = $1 WHERE id = $2`, *req.Config, bannerID)
	}
	if req.Targeting != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET targeting = $1 WHERE id = $2`, *req.Targeting, bannerID)
	}
	if req.FrequencyCapPerUser != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET frequency_cap_per_user = $1 WHERE id = $2`, *req.FrequencyCapPerUser, bannerID)
	}
	if req.FrequencyCapDays != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET frequency_cap_days = $1 WHERE id = $2`, *req.FrequencyCapDays, bannerID)
	}
	if req.StartAt != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET start_at = $1 WHERE id = $2`, *req.StartAt, bannerID)
	}
	if req.EndAt != nil {
		h.pg.Exec(r.Context(), `UPDATE banners SET end_at = $1 WHERE id = $2`, *req.EndAt, bannerID)
	}

	var banner models.Banner
	h.pg.QueryRow(r.Context(),
		`SELECT id, project_id, name, status, config, targeting, frequency_cap_per_user, frequency_cap_days, start_at, end_at, created_by, created_at, updated_at
		 FROM banners WHERE id = $1`,
		bannerID,
	).Scan(&banner.ID, &banner.ProjectID, &banner.Name, &banner.Status, &banner.Config, &banner.Targeting,
		&banner.FrequencyCapPerUser, &banner.FrequencyCapDays, &banner.StartAt, &banner.EndAt,
		&banner.CreatedBy, &banner.CreatedAt, &banner.UpdatedAt)

	respondJSON(w, http.StatusOK, banner)
}

func (h *Handlers) DeleteBanner(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	bannerIDStr := chi.URLParam(r, "bannerID")
	bannerID, err := uuid.Parse(bannerIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid banner ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT p.workspace_id FROM banners b
		 JOIN projects p ON b.project_id = p.id
		 WHERE b.id = $1`,
		bannerID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "banner not found")
		return
	}

	h.pg.Exec(r.Context(), `DELETE FROM banners WHERE id = $1`, bannerID)

	respondJSON(w, http.StatusOK, map[string]string{"message": "banner deleted successfully"})
}

func (h *Handlers) PreviewBanner(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	bannerIDStr := chi.URLParam(r, "bannerID")
	bannerID, err := uuid.Parse(bannerIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid banner ID")
		return
	}

	var projectWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT p.workspace_id FROM banners b
		 JOIN projects p ON b.project_id = p.id
		 WHERE b.id = $1`,
		bannerID,
	).Scan(&projectWorkspaceID)

	if err != nil || projectWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "banner not found")
		return
	}

	rows, _ := h.pg.Query(r.Context(),
		`SELECT html, css FROM banner_variants WHERE banner_id = $1 LIMIT 1`,
		bannerID)

	var html, css string
	if rows != nil && rows.Next() {
		rows.Scan(&html, &css)
		rows.Close()
	}

	previewHTML := `<!DOCTYPE html>
<html>
<head>
    <title>Banner Preview</title>
    <style>
        body { margin: 0; padding: 20px; font-family: system-ui; background: #f5f5f5; }
        .preview-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        ` + css + `
    </style>
</head>
<body>
    <div class="preview-container">
        ` + html + `
    </div>
</body>
</html>`

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(previewHTML))
}
