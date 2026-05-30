package logger

import (
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func New(service string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano

	var logger zerolog.Logger

	if os.Getenv("ENVIRONMENT") == "production" {
		logger = zerolog.New(os.Stdout).With().
			Timestamp().
			Str("service", service).
			Logger()
	} else {
		logger = zerolog.New(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: "15:04:05",
		}).With().
			Timestamp().
			Str("service", service).
			Logger()
	}

	level := os.Getenv("LOG_LEVEL")
	switch level {
	case "debug":
		logger = logger.Level(zerolog.DebugLevel)
	case "warn":
		logger = logger.Level(zerolog.WarnLevel)
	case "error":
		logger = logger.Level(zerolog.ErrorLevel)
	default:
		logger = logger.Level(zerolog.InfoLevel)
	}

	return logger
}

func HTTPMiddleware(log zerolog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			defer func() {
				status := ww.Status()
				duration := time.Since(start)

				event := log.Info()
				if status >= 500 {
					event = log.Error()
				} else if status >= 400 {
					event = log.Warn()
				}

				event.
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Int("status", status).
					Int("bytes", ww.BytesWritten()).
					Dur("duration", duration).
					Str("ip", r.RemoteAddr).
					Str("request_id", middleware.GetReqID(r.Context())).
					Msg("HTTP request")
			}()

			next.ServeHTTP(ww, r)
		})
	}
}

type contextKey string

const LoggerKey contextKey = "logger"

func FromContext(r *http.Request) zerolog.Logger {
	if logger, ok := r.Context().Value(LoggerKey).(zerolog.Logger); ok {
		return logger
	}
	return New("unknown")
}
