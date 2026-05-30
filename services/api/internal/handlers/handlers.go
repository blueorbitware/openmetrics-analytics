package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type Handlers struct {
	pg  *database.Postgres
	ch  *database.ClickHouse
	rdb *database.Redis
	cfg *config.Config
	log zerolog.Logger
}

func New(pg *database.Postgres, ch *database.ClickHouse, rdb *database.Redis, cfg *config.Config) *Handlers {
	return &Handlers{
		pg:  pg,
		ch:  ch,
		rdb: rdb,
		cfg: cfg,
		log: log.With().Str("service", "api-handlers").Logger(),
	}
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, v any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}
