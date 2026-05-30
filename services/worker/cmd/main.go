package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/analytics/gocommon/logger"
	"github.com/analytics/worker/internal/worker"
)

func main() {
	log := logger.New("worker")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

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

	w := worker.New(ch, rdb, cfg, log)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		log.Info().
			Int("batch_size", cfg.BatchSize).
			Int("batch_timeout_ms", cfg.BatchTimeoutMS).
			Str("consumer_group", cfg.ConsumerGroup).
			Str("consumer_name", cfg.ConsumerName).
			Msg("Starting worker")
		if err := w.Run(ctx); err != nil {
			log.Error().Err(err).Msg("Worker error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down worker...")
	cancel()

	w.Shutdown()

	log.Info().Msg("Worker exited")
}
