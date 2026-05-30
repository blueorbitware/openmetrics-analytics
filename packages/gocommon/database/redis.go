package database

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Redis struct {
	Client *redis.Client
}

func NewRedis(redisURL string) (*Redis, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	opts.PoolSize = 50
	opts.MinIdleConns = 10
	opts.MaxRetries = 3
	opts.ReadTimeout = 5 * time.Second
	opts.WriteTimeout = 5 * time.Second
	opts.PoolTimeout = 10 * time.Second

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Redis{Client: client}, nil
}

func (r *Redis) Close() error {
	if r.Client != nil {
		return r.Client.Close()
	}
	return nil
}

func (r *Redis) Get(ctx context.Context, key string) (string, error) {
	return r.Client.Get(ctx, key).Result()
}

func (r *Redis) Set(ctx context.Context, key string, value any, expiration time.Duration) error {
	return r.Client.Set(ctx, key, value, expiration).Err()
}

func (r *Redis) Del(ctx context.Context, keys ...string) error {
	return r.Client.Del(ctx, keys...).Err()
}

func (r *Redis) XAdd(ctx context.Context, stream string, values map[string]any) (string, error) {
	return r.Client.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		MaxLen: 1000000,
		Approx: true,
		Values: values,
	}).Result()
}

func (r *Redis) XReadGroup(ctx context.Context, group, consumer, stream string, count int64, block time.Duration) ([]redis.XStream, error) {
	return r.Client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, ">"},
		Count:    count,
		Block:    block,
	}).Result()
}

func (r *Redis) XAck(ctx context.Context, stream, group string, ids ...string) error {
	return r.Client.XAck(ctx, stream, group, ids...).Err()
}

func (r *Redis) XGroupCreateMkStream(ctx context.Context, stream, group, start string) error {
	err := r.Client.XGroupCreateMkStream(ctx, stream, group, start).Err()
	if err != nil && err.Error() == "BUSYGROUP Consumer Group name already exists" {
		return nil
	}
	return err
}

func (r *Redis) Publish(ctx context.Context, channel string, message any) error {
	return r.Client.Publish(ctx, channel, message).Err()
}

func (r *Redis) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.Client.Subscribe(ctx, channels...)
}

func (r *Redis) HSet(ctx context.Context, key string, values ...any) error {
	return r.Client.HSet(ctx, key, values...).Err()
}

func (r *Redis) HGet(ctx context.Context, key, field string) (string, error) {
	return r.Client.HGet(ctx, key, field).Result()
}

func (r *Redis) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.Client.HGetAll(ctx, key).Result()
}

func (r *Redis) Incr(ctx context.Context, key string) (int64, error) {
	return r.Client.Incr(ctx, key).Result()
}

func (r *Redis) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return r.Client.Expire(ctx, key, expiration).Err()
}

func (r *Redis) Exists(ctx context.Context, keys ...string) (int64, error) {
	return r.Client.Exists(ctx, keys...).Result()
}

func (r *Redis) SetNX(ctx context.Context, key string, value any, expiration time.Duration) (bool, error) {
	return r.Client.SetNX(ctx, key, value, expiration).Result()
}
