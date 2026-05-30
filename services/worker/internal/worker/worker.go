package worker

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/analytics/gocommon/config"
	"github.com/analytics/gocommon/database"
	"github.com/analytics/gocommon/models"
	"github.com/rs/zerolog"
)

type Worker struct {
	ch          *database.ClickHouse
	rdb         *database.Redis
	cfg         *config.Config
	log         zerolog.Logger
	buffer      []models.Event
	bufferMutex sync.Mutex
	done        chan struct{}
	wg          sync.WaitGroup
}

func New(ch *database.ClickHouse, rdb *database.Redis, cfg *config.Config, log zerolog.Logger) *Worker {
	return &Worker{
		ch:     ch,
		rdb:    rdb,
		cfg:    cfg,
		log:    log,
		buffer: make([]models.Event, 0, cfg.BatchSize),
		done:   make(chan struct{}),
	}
}

func (w *Worker) Run(ctx context.Context) error {
	err := w.rdb.XGroupCreateMkStream(ctx, "events:ingest", w.cfg.ConsumerGroup, "0")
	if err != nil {
		w.log.Warn().Err(err).Msg("Failed to create consumer group (may already exist)")
	}

	w.wg.Add(1)
	go w.flushLoop(ctx)

	w.wg.Add(1)
	go w.consumeLoop(ctx)

	return nil
}

func (w *Worker) Shutdown() {
	close(w.done)
	w.wg.Wait()
	w.flush(context.Background())
}

func (w *Worker) consumeLoop(ctx context.Context) {
	defer w.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.done:
			return
		default:
		}

		streams, err := w.rdb.XReadGroup(ctx, w.cfg.ConsumerGroup, w.cfg.ConsumerName, "events:ingest", 100, 2*time.Second)
		if err != nil {
			if err.Error() != "redis: nil" {
				w.log.Error().Err(err).Msg("Failed to read from stream")
			}
			continue
		}

		var idsToAck []string
		for _, stream := range streams {
			for _, msg := range stream.Messages {
				data, ok := msg.Values["data"].(string)
				if !ok {
					idsToAck = append(idsToAck, msg.ID)
					continue
				}

				var event models.Event
				if err := json.Unmarshal([]byte(data), &event); err != nil {
					w.log.Error().Err(err).Str("id", msg.ID).Msg("Failed to unmarshal event")
					w.publishToDLQ(ctx, msg.ID, data, err.Error())
					idsToAck = append(idsToAck, msg.ID)
					continue
				}

				w.bufferMutex.Lock()
				w.buffer = append(w.buffer, event)
				shouldFlush := len(w.buffer) >= w.cfg.BatchSize
				w.bufferMutex.Unlock()

				idsToAck = append(idsToAck, msg.ID)

				if shouldFlush {
					w.flush(ctx)
				}
			}
		}

		if len(idsToAck) > 0 {
			if err := w.rdb.XAck(ctx, "events:ingest", w.cfg.ConsumerGroup, idsToAck...); err != nil {
				w.log.Error().Err(err).Msg("Failed to ACK messages")
			}
		}
	}
}

func (w *Worker) flushLoop(ctx context.Context) {
	defer w.wg.Done()

	ticker := time.NewTicker(time.Duration(w.cfg.BatchTimeoutMS) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.done:
			return
		case <-ticker.C:
			w.flush(ctx)
		}
	}
}

func (w *Worker) flush(ctx context.Context) {
	w.bufferMutex.Lock()
	if len(w.buffer) == 0 {
		w.bufferMutex.Unlock()
		return
	}

	events := w.buffer
	w.buffer = make([]models.Event, 0, w.cfg.BatchSize)
	w.bufferMutex.Unlock()

	start := time.Now()
	if err := w.insertEvents(ctx, events); err != nil {
		w.log.Error().Err(err).Int("count", len(events)).Msg("Failed to insert events")
		for _, event := range events {
			data, _ := json.Marshal(event)
			w.publishToDLQ(ctx, event.EventID.String(), string(data), err.Error())
		}
		return
	}

	w.log.Info().
		Int("count", len(events)).
		Dur("duration", time.Since(start)).
		Msg("Flushed events to ClickHouse")

	w.publishLiveEvents(ctx, events)
}

func (w *Worker) insertEvents(ctx context.Context, events []models.Event) error {
	batch, err := w.ch.PrepareBatch(ctx, `
		INSERT INTO events (
			workspace_id, project_id, event_id, event_name, event_type, ts, received_at,
			anon_id, user_id, session_id, is_new_session,
			url, path, referrer, title, hash, search, utm,
			ref_source, ref_source_category, ref_medium,
			ip, country, region, city,
			ua_browser, ua_browser_version, ua_os, ua_os_version, ua_device, ua_device_type,
			locale, screen_width, screen_height,
			revenue, currency, order_id, product_id, product_name, product_category, quantity,
			banner_id, banner_variant,
			props_string, props_number, props_bool, user_props,
			lcp, fid, cls, ttfb, fcp, scroll_depth
		)
	`)
	if err != nil {
		return err
	}

	for _, e := range events {
		ipv6 := e.IP
		if ipv6 == nil {
			ipv6 = make([]byte, 16)
		} else if len(ipv6) == 4 {
			ipv6 = append(make([]byte, 12), ipv6...)
		}

		isNewSession := uint8(0)
		if e.IsNewSession {
			isNewSession = 1
		}

		propsString := e.PropsString
		if propsString == nil {
			propsString = map[string]string{}
		}
		propsNumber := e.PropsNumber
		if propsNumber == nil {
			propsNumber = map[string]float64{}
		}
		propsBool := make(map[string]uint8)
		for k, v := range e.PropsBool {
			if v {
				propsBool[k] = 1
			} else {
				propsBool[k] = 0
			}
		}
		userProps := e.UserProps
		if userProps == nil {
			userProps = map[string]string{}
		}
		utm := e.UTM
		if utm == nil {
			utm = map[string]string{}
		}

		var scrollDepth uint8
		if e.ScrollDepth != nil {
			scrollDepth = uint8(*e.ScrollDepth)
		}
		var quantity uint32
		if e.Quantity != nil {
			quantity = uint32(*e.Quantity)
		}
		var revenue float64
		if e.Revenue != nil {
			revenue = *e.Revenue
		}
		var lcp, fid, cls, ttfb, fcp float64
		if e.LCP != nil { lcp = *e.LCP }
		if e.FID != nil { fid = *e.FID }
		if e.CLS != nil { cls = *e.CLS }
		if e.TTFB != nil { ttfb = *e.TTFB }
		if e.FCP != nil { fcp = *e.FCP }

		err := batch.Append(
			e.WorkspaceID, e.ProjectID, e.EventID, e.EventName, e.EventType, e.Timestamp, e.ReceivedAt,
			e.AnonID, e.UserID, e.SessionID, isNewSession,
			e.URL, e.Path, e.Referrer, e.Title, e.Hash, e.Search, utm,
			e.RefSource, e.RefSourceCategory, e.RefMedium,
			ipv6, e.Country, e.Region, e.City,
			e.UABrowser, e.UABrowserVer, e.UAOS, e.UAOSVersion, e.UADevice, e.UADeviceType,
			e.Locale, uint16(e.ScreenWidth), uint16(e.ScreenHeight),
			revenue, e.Currency, e.OrderID, e.ProductID, e.ProductName, e.ProductCategory, quantity,
			e.BannerID, e.BannerVariant,
			propsString, propsNumber, propsBool, userProps,
			lcp, fid, cls, ttfb, fcp, scrollDepth,
		)
		if err != nil {
			w.log.Error().Err(err).Msg("Failed to append to batch")
		}
	}

	return batch.Send()
}

func (w *Worker) publishToDLQ(ctx context.Context, id, data, errMsg string) {
	w.rdb.XAdd(ctx, "events:dlq", map[string]any{
		"id":    id,
		"data":  data,
		"error": errMsg,
	})
}

func (w *Worker) publishLiveEvents(ctx context.Context, events []models.Event) {
	for _, e := range events {
		liveEvent := map[string]any{
			"event_id":    e.EventID.String(),
			"event_name":  e.EventName,
			"event_type":  e.EventType,
			"timestamp":   e.Timestamp.Format(time.RFC3339),
			"project_id":  e.ProjectID.String(),
			"anon_id":     e.AnonID,
			"url":         e.URL,
			"country":     e.Country,
			"city":        e.City,
			"browser":     e.UABrowser,
			"os":          e.UAOS,
			"device_type": e.UADeviceType,
		}
		data, _ := json.Marshal(liveEvent)
		w.rdb.Publish(ctx, "live:"+e.ProjectID.String(), string(data))
	}
}
