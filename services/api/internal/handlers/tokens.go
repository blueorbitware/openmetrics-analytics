package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/auth"
	"github.com/analytics/gocommon/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CreateAPITokenRequest struct {
	Name      string    `json:"name"`
	Scopes    []string  `json:"scopes,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type APITokenResponse struct {
	models.APIToken
	Token string `json:"token,omitempty"`
}

func (h *Handlers) ListAPITokens(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())

	rows, err := h.pg.Query(r.Context(),
		`SELECT id, workspace_id, name, token_prefix, scopes, last_used_at, expires_at, revoked_at, created_by, created_at
		 FROM api_tokens
		 WHERE workspace_id = $1 AND revoked_at IS NULL
		 ORDER BY created_at DESC`,
		workspaceID)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch API tokens")
		return
	}
	defer rows.Close()

	var tokens []models.APIToken
	for rows.Next() {
		var t models.APIToken
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.TokenPrefix, &t.Scopes,
			&t.LastUsedAt, &t.ExpiresAt, &t.RevokedAt, &t.CreatedBy, &t.CreatedAt); err != nil {
			continue
		}
		tokens = append(tokens, t)
	}

	if tokens == nil {
		tokens = []models.APIToken{}
	}

	respondJSON(w, http.StatusOK, tokens)
}

func (h *Handlers) CreateAPIToken(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	claims := middleware.GetClaims(r.Context())

	var req CreateAPITokenRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
		return
	}

	if len(req.Scopes) == 0 {
		req.Scopes = []string{"read:reports"}
	}

	validScopes := map[string]bool{
		"read:reports":   true,
		"read:events":    true,
		"read:users":     true,
		"read:sessions":  true,
		"write:events":   true,
		"admin":          true,
	}

	for _, scope := range req.Scopes {
		if !validScopes[scope] {
			respondError(w, http.StatusBadRequest, "invalid scope: "+scope)
			return
		}
	}

	token, err := auth.GenerateAPIToken()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	tokenHash := sha256.Sum256([]byte(token))
	tokenPrefix := token[:12] + "..."

	tokenID := uuid.New()
	var apiToken models.APIToken

	err = h.pg.QueryRow(r.Context(),
		`INSERT INTO api_tokens (id, workspace_id, name, token_hash, token_prefix, scopes, expires_at, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, workspace_id, name, token_prefix, scopes, last_used_at, expires_at, revoked_at, created_by, created_at`,
		tokenID, workspaceID, req.Name, hex.EncodeToString(tokenHash[:]), tokenPrefix, req.Scopes, req.ExpiresAt, claims.UserID,
	).Scan(&apiToken.ID, &apiToken.WorkspaceID, &apiToken.Name, &apiToken.TokenPrefix, &apiToken.Scopes,
		&apiToken.LastUsedAt, &apiToken.ExpiresAt, &apiToken.RevokedAt, &apiToken.CreatedBy, &apiToken.CreatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create API token")
		return
	}

	respondJSON(w, http.StatusCreated, APITokenResponse{
		APIToken: apiToken,
		Token:    token,
	})
}

func (h *Handlers) RevokeAPIToken(w http.ResponseWriter, r *http.Request) {
	workspaceID := middleware.GetWorkspaceID(r.Context())
	tokenIDStr := chi.URLParam(r, "tokenID")
	tokenID, err := uuid.Parse(tokenIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid token ID")
		return
	}

	var tokenWorkspaceID uuid.UUID
	err = h.pg.QueryRow(r.Context(),
		`SELECT workspace_id FROM api_tokens WHERE id = $1`,
		tokenID,
	).Scan(&tokenWorkspaceID)

	if err != nil || tokenWorkspaceID != workspaceID {
		respondError(w, http.StatusNotFound, "token not found")
		return
	}

	err = h.pg.Exec(r.Context(),
		`UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to revoke token")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "token revoked successfully"})
}
