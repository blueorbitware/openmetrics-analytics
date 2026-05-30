package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/analytics/gocommon/auth"
	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type contextKey string

const (
	ClaimsKey    contextKey = "claims"
	WorkspaceKey contextKey = "workspace"
	MemberKey    contextKey = "membership"
)

func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	jwtManager := auth.NewJWTManager(
		cfg.JWTSecret,
		cfg.JWTIssuer,
		cfg.JWTAccessDuration,
		cfg.JWTRefreshDuration,
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error": "missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error": "invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			claims, err := jwtManager.ValidateToken(parts[1])
			if err != nil {
				if err == auth.ErrExpiredToken {
					http.Error(w, `{"error": "token expired"}`, http.StatusUnauthorized)
					return
				}
				http.Error(w, `{"error": "invalid token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetClaims(ctx context.Context) *auth.Claims {
	if claims, ok := ctx.Value(ClaimsKey).(*auth.Claims); ok {
		return claims
	}
	return nil
}

func WorkspaceAccess(pg *database.Postgres) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			workspaceIDStr := chi.URLParam(r, "workspaceID")
			workspaceID, err := uuid.Parse(workspaceIDStr)
			if err != nil {
				http.Error(w, `{"error": "invalid workspace ID"}`, http.StatusBadRequest)
				return
			}

			if claims.IsSuperAdmin {
				ctx := context.WithValue(r.Context(), WorkspaceKey, workspaceID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			var role string
			err = pg.QueryRow(r.Context(),
				`SELECT role FROM memberships WHERE workspace_id = $1 AND user_id = $2`,
				workspaceID, claims.UserID,
			).Scan(&role)

			if err != nil {
				http.Error(w, `{"error": "access denied"}`, http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), WorkspaceKey, workspaceID)
			ctx = context.WithValue(ctx, MemberKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func WorkspaceFromHeader(pg *database.Postgres) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			workspaceIDStr := r.Header.Get("X-Workspace-ID")
			if workspaceIDStr == "" {
				http.Error(w, `{"error": "missing X-Workspace-ID header"}`, http.StatusBadRequest)
				return
			}

			workspaceID, err := uuid.Parse(workspaceIDStr)
			if err != nil {
				http.Error(w, `{"error": "invalid workspace ID"}`, http.StatusBadRequest)
				return
			}

			if claims.IsSuperAdmin {
				ctx := context.WithValue(r.Context(), WorkspaceKey, workspaceID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			var role string
			err = pg.QueryRow(r.Context(),
				`SELECT role FROM memberships WHERE workspace_id = $1 AND user_id = $2`,
				workspaceID, claims.UserID,
			).Scan(&role)

			if err != nil {
				http.Error(w, `{"error": "access denied"}`, http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), WorkspaceKey, workspaceID)
			ctx = context.WithValue(ctx, MemberKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if claims.IsSuperAdmin {
				next.ServeHTTP(w, r)
				return
			}

			role, ok := r.Context().Value(MemberKey).(string)
			if !ok {
				http.Error(w, `{"error": "access denied"}`, http.StatusForbidden)
				return
			}

			if requiredRole == "admin" && role != "admin" {
				http.Error(w, `{"error": "admin access required"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireSuperAdmin() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil || !claims.IsSuperAdmin {
				http.Error(w, `{"error": "super admin access required"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetWorkspaceID(ctx context.Context) uuid.UUID {
	if id, ok := ctx.Value(WorkspaceKey).(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

func GetRole(ctx context.Context) string {
	if role, ok := ctx.Value(MemberKey).(string); ok {
		return role
	}
	return ""
}
