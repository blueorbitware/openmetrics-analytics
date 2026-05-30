package database

import (
	"context"
	"crypto/tls"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouse struct {
	Conn driver.Conn
}

func NewClickHouse(dsn string) (*ClickHouse, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return nil, err
	}

	opts.MaxOpenConns = 10
	opts.MaxIdleConns = 5
	opts.ConnMaxLifetime = time.Hour
	opts.DialTimeout = 10 * time.Second
	opts.ReadTimeout = 30 * time.Second

	opts.Settings = clickhouse.Settings{
		"max_execution_time":             60,
		"async_insert":                   1,
		"wait_for_async_insert":          0,
		"async_insert_max_data_size":     "10485760",
		"async_insert_busy_timeout_ms":   2000,
	}

	if opts.TLS != nil {
		opts.TLS = &tls.Config{
			InsecureSkipVerify: false,
		}
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := conn.Ping(ctx); err != nil {
		return nil, err
	}

	return &ClickHouse{Conn: conn}, nil
}

func (c *ClickHouse) Close() error {
	if c.Conn != nil {
		return c.Conn.Close()
	}
	return nil
}

func (c *ClickHouse) Query(ctx context.Context, query string, args ...any) (driver.Rows, error) {
	return c.Conn.Query(ctx, query, args...)
}

func (c *ClickHouse) QueryRow(ctx context.Context, query string, args ...any) driver.Row {
	return c.Conn.QueryRow(ctx, query, args...)
}

func (c *ClickHouse) Exec(ctx context.Context, query string, args ...any) error {
	return c.Conn.Exec(ctx, query, args...)
}

func (c *ClickHouse) PrepareBatch(ctx context.Context, query string) (driver.Batch, error) {
	return c.Conn.PrepareBatch(ctx, query)
}

func (c *ClickHouse) AsyncInsert(ctx context.Context, query string, wait bool, args ...any) error {
	return c.Conn.AsyncInsert(ctx, query, wait, args...)
}
