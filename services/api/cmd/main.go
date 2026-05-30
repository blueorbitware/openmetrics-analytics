package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/analytics/api/internal/handlers"
	"github.com/analytics/api/internal/middleware"
	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/analytics/gocommon/logger"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	log := logger.New("api")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	pg, err := database.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to PostgreSQL")
	}
	defer pg.Close()

	ch, err := database.NewClickHouse(cfg.ClickHouseDSN)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to ClickHouse")
	}
	defer ch.Close()

	rdb, err := database.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer rdb.Close()

	h := handlers.New(pg, ch, rdb, cfg)

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(logger.HTTPMiddleware(log))
	r.Use(chimw.Recoverer)
	r.Use(chimw.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Workspace-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	r.Route("/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/login", h.Login)
			r.Post("/refresh", h.RefreshToken)
			r.With(middleware.Auth(cfg)).Post("/logout", h.Logout)
			r.With(middleware.Auth(cfg)).Patch("/profile", h.UpdateProfile)
			r.With(middleware.Auth(cfg)).Post("/password", h.ChangePassword)
		})

		r.Get("/config/{publicKey}", h.GetProjectConfig)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg))

			r.Route("/workspaces", func(r chi.Router) {
				r.Get("/", h.ListWorkspaces)
				r.Post("/", h.CreateWorkspace)
				r.Route("/{workspaceID}", func(r chi.Router) {
					r.Use(middleware.WorkspaceAccess(pg))
					r.Get("/", h.GetWorkspace)
					r.Patch("/", h.UpdateWorkspace)
					r.Post("/invite", h.InviteMember)
					r.Get("/members", h.ListMembers)
					r.Delete("/members/{userID}", h.RemoveMember)
				})
			})

			r.Route("/projects", func(r chi.Router) {
				r.Use(middleware.WorkspaceFromHeader(pg))
				r.Get("/", h.ListProjects)
				r.Post("/", h.CreateProject)
				r.Route("/{projectID}", func(r chi.Router) {
					r.Get("/", h.GetProject)
					r.Patch("/", h.UpdateProject)
					r.Delete("/", h.DeleteProject)
					r.Post("/rotate-keys", h.RotateProjectKeys)
					r.Get("/snippet", h.GetSnippet)
				})
			})

			r.Route("/reports", func(r chi.Router) {
				r.Use(middleware.WorkspaceFromHeader(pg))
				r.Post("/events", h.ReportEvents)
				r.Post("/funnel", h.ReportFunnel)
				r.Post("/retention", h.ReportRetention)
				r.Post("/paths", h.ReportPaths)
				r.Get("/live", h.ReportLive)
				r.Get("/raw", h.GetRawEvents)
				r.Get("/summary", h.GetSummary)
				r.Get("/users/{anonID}", h.GetUserTimeline)
				r.Get("/sessions/{sessionID}", h.GetSession)
			})

			r.Route("/banners", func(r chi.Router) {
				r.Use(middleware.WorkspaceFromHeader(pg))
				r.Use(middleware.RequireRole("admin"))
				r.Get("/", h.ListBanners)
				r.Post("/", h.CreateBanner)
				r.Route("/{bannerID}", func(r chi.Router) {
					r.Get("/", h.GetBanner)
					r.Patch("/", h.UpdateBanner)
					r.Delete("/", h.DeleteBanner)
					r.Post("/preview", h.PreviewBanner)
				})
			})

			r.Route("/dashboards", func(r chi.Router) {
				r.Use(middleware.WorkspaceFromHeader(pg))
				r.Get("/", h.ListDashboards)
				r.Post("/", h.CreateDashboard)
				r.Route("/{dashboardID}", func(r chi.Router) {
					r.Get("/", h.GetDashboard)
					r.Patch("/", h.UpdateDashboard)
					r.Delete("/", h.DeleteDashboard)
				})
			})

			r.Route("/tokens", func(r chi.Router) {
				r.Use(middleware.WorkspaceFromHeader(pg))
				r.Use(middleware.RequireRole("admin"))
				r.Get("/", h.ListAPITokens)
				r.Post("/", h.CreateAPIToken)
				r.Delete("/{tokenID}", h.RevokeAPIToken)
			})

		r.Route("/audit", func(r chi.Router) {
			r.Use(middleware.WorkspaceFromHeader(pg))
			r.Use(middleware.RequireRole("admin"))
			r.Get("/", h.ListAuditLogs)
		})

		r.Route("/settings", func(r chi.Router) {
			r.Use(middleware.WorkspaceFromHeader(pg))
			r.Use(middleware.RequireRole("admin"))
			r.Get("/", h.GetWorkspaceSettings)
			r.Put("/", h.UpdateWorkspaceSettings)
			r.Post("/test-ai", h.TestAIConnection)
			r.Post("/test-storage", h.TestStorageConnection)
		})

		r.Route("/ai", func(r chi.Router) {
			r.Use(middleware.WorkspaceFromHeader(pg))
			r.Get("/insights", h.ListAIInsights)
			r.Post("/insights/{insightID}/read", h.MarkInsightRead)
			r.Post("/insights/{insightID}/dismiss", h.DismissInsight)
			r.Post("/insights/generate", h.GenerateInsights)
			r.Post("/query", h.RunNaturalLanguageQuery)
			r.Get("/query/history", h.GetAIQueryHistory)
		})
		})

		r.Route("/super", func(r chi.Router) {
			r.Use(middleware.Auth(cfg))
			r.Use(middleware.RequireSuperAdmin())
			r.Get("/workspaces", h.SuperListWorkspaces)
			r.Post("/workspaces/{workspaceID}/suspend", h.SuspendWorkspace)
			r.Post("/impersonate/{userID}", h.Impersonate)
			r.Get("/metrics", h.SystemMetrics)
			
			// User management (super admin only)
			r.Get("/users", h.ListUsers)
			r.Post("/users", h.CreateUser)
			r.Delete("/users/{userID}", h.DeleteUser)
			r.Post("/users/workspace", h.AddUserToWorkspace)
		})
	})

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("port", port).Msg("Starting API server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}
