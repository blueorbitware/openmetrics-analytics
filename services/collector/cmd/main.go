package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/analytics/collector/internal/collector"
	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/analytics/gocommon/logger"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

func main() {
	log := logger.New("collector")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	pg, err := database.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to PostgreSQL")
	}
	defer pg.Close()

	rdb, err := database.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer rdb.Close()

	c := collector.New(pg, rdb, cfg, log)

	if err := c.LoadProjectsCache(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("Failed to load projects cache")
	}

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)

	// Bulletproof CORS middleware - works with any origin, Cloudflare, ad blockers
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Origin, Referer")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Timing-Allow-Origin", "*")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Serve tracker script - try multiple paths for different environments
	var trackerScript []byte
	for _, path := range []string{"static/t.js", "/static/t.js"} {
		trackerScript, err = os.ReadFile(path)
		if err == nil {
			log.Info().Str("path", path).Msg("Loaded tracker script")
			break
		}
	}
	if trackerScript == nil {
		log.Warn().Msg("Tracker script (t.js) not found - tracking will not work")
	}

	r.Get("/t.js", func(w http.ResponseWriter, r *http.Request) {
		if trackerScript == nil {
			http.Error(w, "tracker not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(trackerScript)
	})

	// Source map for t.js (return empty to prevent console warnings)
	r.Get("/t.js.map", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"version":3,"sources":[],"mappings":""}`))
	})

	r.Route("/v1", func(r chi.Router) {
		r.Post("/collect", c.HandleCollect)
		r.Get("/collect", c.HandleCollectGET)
		r.Get("/config/{publicKey}", c.HandleConfig)
	})

	// Alternative non-versioned paths (helps bypass some ad blockers)
	r.Post("/collect", c.HandleCollect)
	r.Get("/collect", c.HandleCollectGET)

	port := cfg.Port
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	go func() {
		log.Info().Str("port", port).Msg("Starting Collector server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down collector...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Collector forced to shutdown")
	}

	log.Info().Msg("Collector exited")
}
