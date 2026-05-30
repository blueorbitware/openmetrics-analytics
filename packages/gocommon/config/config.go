package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Port          string   `mapstructure:"PORT"`
	DatabaseURL   string   `mapstructure:"DATABASE_URL"`
	ClickHouseDSN string   `mapstructure:"CLICKHOUSE_DSN"`
	RedisURL      string   `mapstructure:"REDIS_URL"`
	CORSOrigins   []string `mapstructure:"CORS_ORIGINS"`

	JWTSecret          string        `mapstructure:"JWT_SECRET"`
	JWTIssuer          string        `mapstructure:"JWT_ISSUER"`
	JWTAccessDuration  time.Duration `mapstructure:"JWT_ACCESS_DURATION"`
	JWTRefreshDuration time.Duration `mapstructure:"JWT_REFRESH_DURATION"`

	BatchSize       int    `mapstructure:"BATCH_SIZE"`
	BatchTimeoutMS  int    `mapstructure:"BATCH_TIMEOUT_MS"`
	ConsumerGroup   string `mapstructure:"CONSUMER_GROUP"`
	ConsumerName    string `mapstructure:"CONSUMER_NAME"`
	RateLimitRPS    int    `mapstructure:"RATE_LIMIT_RPS"`

	GeoIPPath    string `mapstructure:"GEOIP_PATH"`
	CollectorURL string `mapstructure:"COLLECTOR_URL"`

	Environment string `mapstructure:"ENVIRONMENT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
}

func Load() (*Config, error) {
	viper.SetConfigName(".env")
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AddConfigPath("../..")
	viper.AddConfigPath("/app")

	viper.AutomaticEnv()

	// Explicitly bind environment variables
	viper.BindEnv("PORT")
	viper.BindEnv("DATABASE_URL")
	viper.BindEnv("CLICKHOUSE_DSN")
	viper.BindEnv("REDIS_URL")
	viper.BindEnv("CORS_ORIGINS")
	viper.BindEnv("JWT_SECRET")
	viper.BindEnv("JWT_ISSUER")
	viper.BindEnv("JWT_ACCESS_DURATION")
	viper.BindEnv("JWT_REFRESH_DURATION")
	viper.BindEnv("BATCH_SIZE")
	viper.BindEnv("BATCH_TIMEOUT_MS")
	viper.BindEnv("CONSUMER_GROUP")
	viper.BindEnv("CONSUMER_NAME")
	viper.BindEnv("RATE_LIMIT_RPS")
	viper.BindEnv("GEOIP_PATH")
	viper.BindEnv("COLLECTOR_URL")
	viper.BindEnv("ENVIRONMENT")
	viper.BindEnv("LOG_LEVEL")

	viper.SetDefault("PORT", "8080")
	viper.SetDefault("JWT_ISSUER", "analytics-platform")
	viper.SetDefault("JWT_ACCESS_DURATION", "15m")
	viper.SetDefault("JWT_REFRESH_DURATION", "720h")
	viper.SetDefault("BATCH_SIZE", 5000)
	viper.SetDefault("BATCH_TIMEOUT_MS", 2000)
	viper.SetDefault("CONSUMER_GROUP", "analytics-workers")
	viper.SetDefault("CONSUMER_NAME", "worker-1")
	viper.SetDefault("RATE_LIMIT_RPS", 10000)
	viper.SetDefault("ENVIRONMENT", "development")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("GEOIP_PATH", "/app/data/GeoLite2-City.mmdb")

	_ = viper.ReadInConfig()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	if corsStr := viper.GetString("CORS_ORIGINS"); corsStr != "" {
		cfg.CORSOrigins = strings.Split(corsStr, ",")
	}
	if len(cfg.CORSOrigins) == 0 {
		cfg.CORSOrigins = []string{"http://localhost:3000"}
	}

	if cfg.JWTAccessDuration == 0 {
		cfg.JWTAccessDuration = 15 * time.Minute
	}
	if cfg.JWTRefreshDuration == 0 {
		cfg.JWTRefreshDuration = 30 * 24 * time.Hour
	}

	return &cfg, nil
}

func (c *Config) IsDevelopment() bool {
	return c.Environment == "development" || c.Environment == "dev"
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production" || c.Environment == "prod"
}
