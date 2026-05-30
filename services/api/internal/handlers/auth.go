package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/auth"
	"github.com/analytics/gocommon/models"
	"github.com/google/uuid"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	User         models.User `json:"user"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresAt    time.Time   `json:"expires_at"`
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	// Public registration is disabled - only super admins can create users
	respondError(w, http.StatusForbidden, "public registration is disabled - contact your administrator")
}

func (h *Handlers) registerDisabled(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if !emailRegex.MatchString(req.Email) {
		respondError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	if len(req.Password) < 8 {
		respondError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
		return
	}

	var exists bool
	err := h.pg.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`,
		req.Email,
	).Scan(&exists)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if exists {
		respondError(w, http.StatusConflict, "email already registered")
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	userID := uuid.New()
	var user models.User

	err = h.pg.QueryRow(r.Context(),
		`INSERT INTO users (id, email, password_hash, name)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, name, is_super_admin, email_verified, created_at, updated_at`,
		userID, req.Email, passwordHash, req.Name,
	).Scan(&user.ID, &user.Email, &user.Name, &user.IsSuperAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	workspaceSlug := strings.ReplaceAll(strings.ToLower(req.Name), " ", "-")
	workspaceSlug = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(workspaceSlug, "")
	if len(workspaceSlug) < 3 {
		workspaceSlug = "workspace-" + userID.String()[:8]
	}

	workspaceID := uuid.New()
	err = h.pg.Exec(r.Context(),
		`INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)`,
		workspaceID, req.Name+"'s Workspace", workspaceSlug,
	)
	if err != nil {
		workspaceSlug = workspaceSlug + "-" + userID.String()[:8]
		err = h.pg.Exec(r.Context(),
			`INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)`,
			workspaceID, req.Name+"'s Workspace", workspaceSlug,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create workspace")
			return
		}
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
		workspaceID, userID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create membership")
		return
	}

	jwtManager := auth.NewJWTManager(
		h.cfg.JWTSecret,
		h.cfg.JWTIssuer,
		h.cfg.JWTAccessDuration,
		h.cfg.JWTRefreshDuration,
	)

	tokens, err := jwtManager.GenerateTokenPair(user.ID, user.Email, user.Name, user.IsSuperAdmin)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	tokenHash := sha256.Sum256([]byte(tokens.RefreshToken))
	ipAddr := r.RemoteAddr
	if idx := strings.LastIndex(ipAddr, ":"); idx != -1 {
		ipAddr = ipAddr[:idx]
	}
	ipAddr = strings.Trim(ipAddr, "[]")
	if ipAddr == "" {
		ipAddr = "127.0.0.1"
	}
	err = h.pg.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4::inet, $5)`,
		user.ID, hex.EncodeToString(tokenHash[:]),
		time.Now().Add(jwtManager.RefreshDuration()),
		ipAddr, r.UserAgent(),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to store refresh token")
		return
	}

	respondJSON(w, http.StatusCreated, AuthResponse{
		User:         user,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    tokens.ExpiresAt,
	})
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var user models.User
	err := h.pg.QueryRow(r.Context(),
		`SELECT id, email, password_hash, name, is_super_admin, email_verified, avatar_url, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.IsSuperAdmin,
		&user.EmailVerified, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	h.pg.Exec(r.Context(),
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`,
		user.ID,
	)

	jwtManager := auth.NewJWTManager(
		h.cfg.JWTSecret,
		h.cfg.JWTIssuer,
		h.cfg.JWTAccessDuration,
		h.cfg.JWTRefreshDuration,
	)

	tokens, err := jwtManager.GenerateTokenPair(user.ID, user.Email, user.Name, user.IsSuperAdmin)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	tokenHash := sha256.Sum256([]byte(tokens.RefreshToken))
	ipAddr := r.RemoteAddr
	if idx := strings.LastIndex(ipAddr, ":"); idx != -1 {
		ipAddr = ipAddr[:idx]
	}
	ipAddr = strings.Trim(ipAddr, "[]")
	if ipAddr == "" {
		ipAddr = "127.0.0.1"
	}
	err = h.pg.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4::inet, $5)`,
		user.ID, hex.EncodeToString(tokenHash[:]),
		time.Now().Add(jwtManager.RefreshDuration()),
		ipAddr, r.UserAgent(),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to store refresh token")
		return
	}

	user.PasswordHash = ""

	respondJSON(w, http.StatusOK, AuthResponse{
		User:         user,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    tokens.ExpiresAt,
	})
}

func (h *Handlers) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tokenHash := sha256.Sum256([]byte(req.RefreshToken))
	tokenHashStr := hex.EncodeToString(tokenHash[:])

	var userID uuid.UUID
	var expiresAt time.Time
	err := h.pg.QueryRow(r.Context(),
		`SELECT user_id, expires_at FROM refresh_tokens
		 WHERE token_hash = $1 AND revoked_at IS NULL`,
		tokenHashStr,
	).Scan(&userID, &expiresAt)

	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if time.Now().After(expiresAt) {
		respondError(w, http.StatusUnauthorized, "refresh token expired")
		return
	}

	h.pg.Exec(r.Context(),
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
		tokenHashStr,
	)

	var user models.User
	err = h.pg.QueryRow(r.Context(),
		`SELECT id, email, name, is_super_admin, email_verified, avatar_url, created_at, updated_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.IsSuperAdmin,
		&user.EmailVerified, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusUnauthorized, "user not found")
		return
	}

	jwtManager := auth.NewJWTManager(
		h.cfg.JWTSecret,
		h.cfg.JWTIssuer,
		h.cfg.JWTAccessDuration,
		h.cfg.JWTRefreshDuration,
	)

	tokens, err := jwtManager.GenerateTokenPair(user.ID, user.Email, user.Name, user.IsSuperAdmin)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	newTokenHash := sha256.Sum256([]byte(tokens.RefreshToken))
	ipAddr := r.RemoteAddr
	if idx := strings.LastIndex(ipAddr, ":"); idx != -1 {
		ipAddr = ipAddr[:idx]
	}
	ipAddr = strings.Trim(ipAddr, "[]")
	if ipAddr == "" {
		ipAddr = "127.0.0.1"
	}
	err = h.pg.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4::inet, $5)`,
		user.ID, hex.EncodeToString(newTokenHash[:]),
		time.Now().Add(jwtManager.RefreshDuration()),
		ipAddr, r.UserAgent(),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to store refresh token")
		return
	}

	respondJSON(w, http.StatusOK, AuthResponse{
		User:         user,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    tokens.ExpiresAt,
	})
}

func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	h.pg.Exec(r.Context(),
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
		claims.UserID,
	)

	respondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

// UpdateProfile allows users to update their profile
type UpdateProfileRequest struct {
	Name            *string `json:"name,omitempty"`
	Email           *string `json:"email,omitempty"`
	CurrentPassword string  `json:"current_password,omitempty"`
}

func (h *Handlers) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req UpdateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get current user
	var currentPasswordHash string
	err := h.pg.QueryRow(r.Context(),
		`SELECT password_hash FROM users WHERE id = $1`,
		claims.UserID,
	).Scan(&currentPasswordHash)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "user not found")
		return
	}

	// If changing email, require password verification
	if req.Email != nil && *req.Email != claims.Email {
		if req.CurrentPassword == "" {
			respondError(w, http.StatusBadRequest, "current password required to change email")
			return
		}
		if !auth.CheckPassword(req.CurrentPassword, currentPasswordHash) {
			respondError(w, http.StatusUnauthorized, "incorrect password")
			return
		}

		// Validate new email
		newEmail := strings.TrimSpace(strings.ToLower(*req.Email))
		if !emailRegex.MatchString(newEmail) {
			respondError(w, http.StatusBadRequest, "invalid email format")
			return
		}

		// Check if email is already taken
		var exists bool
		h.pg.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id != $2)`,
			newEmail, claims.UserID,
		).Scan(&exists)
		if exists {
			respondError(w, http.StatusConflict, "email already in use")
			return
		}
	}

	// Build update query
	updates := []string{}
	args := []interface{}{}
	argNum := 1

	if req.Name != nil {
		updates = append(updates, "name = $"+string(rune('0'+argNum)))
		args = append(args, strings.TrimSpace(*req.Name))
		argNum++
	}
	if req.Email != nil {
		updates = append(updates, "email = $"+string(rune('0'+argNum)))
		args = append(args, strings.TrimSpace(strings.ToLower(*req.Email)))
		argNum++
	}

	if len(updates) == 0 {
		respondError(w, http.StatusBadRequest, "no updates provided")
		return
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, claims.UserID)

	query := "UPDATE users SET " + strings.Join(updates, ", ") + " WHERE id = $" + string(rune('0'+argNum))
	err = h.pg.Exec(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "profile updated"})
}

// ChangePassword allows users to change their password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *Handlers) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.NewPassword) < 8 {
		respondError(w, http.StatusBadRequest, "new password must be at least 8 characters")
		return
	}

	// Get current password hash
	var currentPasswordHash string
	err := h.pg.QueryRow(r.Context(),
		`SELECT password_hash FROM users WHERE id = $1`,
		claims.UserID,
	).Scan(&currentPasswordHash)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "user not found")
		return
	}

	// Verify current password
	if !auth.CheckPassword(req.CurrentPassword, currentPasswordHash) {
		respondError(w, http.StatusUnauthorized, "incorrect current password")
		return
	}

	// Hash new password
	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	// Update password
	err = h.pg.Exec(r.Context(),
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		newHash, claims.UserID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	// Revoke all refresh tokens (force re-login)
	h.pg.Exec(r.Context(),
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
		claims.UserID,
	)

	respondJSON(w, http.StatusOK, map[string]string{"message": "password changed successfully"})
}

// CreateUser allows super admins to create new users
type CreateUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil || !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "super admin access required")
		return
	}

	var req CreateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if !emailRegex.MatchString(req.Email) {
		respondError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	if len(req.Password) < 8 {
		respondError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	if len(req.Name) < 2 {
		respondError(w, http.StatusBadRequest, "name must be at least 2 characters")
		return
	}

	var exists bool
	err := h.pg.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`,
		req.Email,
	).Scan(&exists)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if exists {
		respondError(w, http.StatusConflict, "email already registered")
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	userID := uuid.New()
	var user models.User

	err = h.pg.QueryRow(r.Context(),
		`INSERT INTO users (id, email, password_hash, name)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, name, is_super_admin, created_at, updated_at`,
		userID, req.Email, passwordHash, req.Name,
	).Scan(&user.ID, &user.Email, &user.Name, &user.IsSuperAdmin, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	respondJSON(w, http.StatusCreated, user)
}

// ListUsers returns all users (super admin only)
func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil || !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "super admin access required")
		return
	}

	rows, err := h.pg.Query(r.Context(),
		`SELECT id, email, name, is_super_admin, email_verified, avatar_url, last_login_at, created_at, updated_at
		 FROM users ORDER BY created_at DESC`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.Email, &user.Name, &user.IsSuperAdmin,
			&user.EmailVerified, &user.AvatarURL, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			continue
		}
		users = append(users, user)
	}

	if users == nil {
		users = []models.User{}
	}

	respondJSON(w, http.StatusOK, users)
}

// DeleteUser deletes a user (super admin only)
func (h *Handlers) DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil || !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "super admin access required")
		return
	}

	userIDStr := r.PathValue("userID")
	if userIDStr == "" {
		respondError(w, http.StatusBadRequest, "user ID required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	// Prevent deleting yourself
	if userID == claims.UserID {
		respondError(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}

	err = h.pg.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete user")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}

// AddUserToWorkspace adds a user to a workspace (super admin only)
type AddUserToWorkspaceRequest struct {
	UserID      string `json:"user_id"`
	WorkspaceID string `json:"workspace_id"`
	Role        string `json:"role"`
}

func (h *Handlers) AddUserToWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil || !claims.IsSuperAdmin {
		respondError(w, http.StatusForbidden, "super admin access required")
		return
	}

	var req AddUserToWorkspaceRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	workspaceID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid workspace ID")
		return
	}

	role := req.Role
	if role == "" {
		role = "member"
	}

	err = h.pg.Exec(r.Context(),
		`INSERT INTO memberships (workspace_id, user_id, role) 
		 VALUES ($1, $2, $3)
		 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3`,
		workspaceID, userID, role,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to add user to workspace")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "user added to workspace"})
}
