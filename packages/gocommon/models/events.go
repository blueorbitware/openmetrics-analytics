package models

import (
	"net"
	"time"

	"github.com/google/uuid"
)

type Event struct {
	WorkspaceID uuid.UUID `json:"workspace_id"`
	ProjectID   uuid.UUID `json:"project_id"`
	EventID     uuid.UUID `json:"event_id"`
	EventName   string    `json:"event_name"`
	EventType   string    `json:"event_type"`
	Timestamp   time.Time `json:"ts"`
	ReceivedAt  time.Time `json:"received_at"`

	AnonID       string  `json:"anon_id"`
	UserID       *string `json:"user_id,omitempty"`
	SessionID    string  `json:"session_id"`
	IsNewSession bool    `json:"is_new_session"`

	URL      string `json:"url"`
	Path     string `json:"path"`
	Referrer string `json:"referrer"`
	Title    string `json:"title"`
	Hash     string `json:"hash"`
	Search   string `json:"search"`

	UTM map[string]string `json:"utm,omitempty"`

	RefSource         string `json:"ref_source"`
	RefSourceCategory string `json:"ref_source_category"`
	RefMedium         string `json:"ref_medium"`

	IP             net.IP `json:"ip,omitempty"`
	Country        string `json:"country"`
	Region         string `json:"region"`
	City           string `json:"city"`
	UABrowser      string `json:"ua_browser"`
	UABrowserVer   string `json:"ua_browser_version"`
	UAOS           string `json:"ua_os"`
	UAOSVersion    string `json:"ua_os_version"`
	UADevice       string `json:"ua_device"`
	UADeviceType   string `json:"ua_device_type"`
	Locale         string `json:"locale"`
	ScreenWidth    int    `json:"screen_width"`
	ScreenHeight   int    `json:"screen_height"`

	Revenue         *float64 `json:"revenue,omitempty"`
	Currency        string   `json:"currency,omitempty"`
	OrderID         *string  `json:"order_id,omitempty"`
	ProductID       *string  `json:"product_id,omitempty"`
	ProductName     *string  `json:"product_name,omitempty"`
	ProductCategory *string  `json:"product_category,omitempty"`
	Quantity        *int     `json:"quantity,omitempty"`

	BannerID      *string `json:"banner_id,omitempty"`
	BannerVariant *string `json:"banner_variant,omitempty"`

	PropsString map[string]string  `json:"props_string,omitempty"`
	PropsNumber map[string]float64 `json:"props_number,omitempty"`
	PropsBool   map[string]bool    `json:"props_bool,omitempty"`

	UserProps map[string]string `json:"user_props,omitempty"`

	LCP  *float64 `json:"lcp,omitempty"`
	FID  *float64 `json:"fid,omitempty"`
	CLS  *float64 `json:"cls,omitempty"`
	TTFB *float64 `json:"ttfb,omitempty"`
	FCP  *float64 `json:"fcp,omitempty"`

	ScrollDepth *int `json:"scroll_depth,omitempty"`
}

type IncomingEvent struct {
	EventName string `json:"event"`
	EventType string `json:"type"`
	Timestamp int64  `json:"ts"`

	AnonID       string  `json:"anon_id"`
	UserID       *string `json:"user_id,omitempty"`
	SessionID    string  `json:"session_id"`
	IsNewSession bool    `json:"is_new_session"`

	URL      string `json:"url"`
	Path     string `json:"path"`
	Referrer string `json:"referrer"`
	Title    string `json:"title"`
	Hash     string `json:"hash"`
	Search   string `json:"search"`

	UTM map[string]string `json:"utm,omitempty"`

	Locale       string `json:"locale"`
	ScreenWidth  int    `json:"screen_width"`
	ScreenHeight int    `json:"screen_height"`

	Revenue         *float64 `json:"revenue,omitempty"`
	Currency        string   `json:"currency,omitempty"`
	OrderID         *string  `json:"order_id,omitempty"`
	ProductID       *string  `json:"product_id,omitempty"`
	ProductName     *string  `json:"product_name,omitempty"`
	ProductCategory *string  `json:"product_category,omitempty"`
	Quantity        *int     `json:"quantity,omitempty"`

	BannerID      *string `json:"banner_id,omitempty"`
	BannerVariant *string `json:"banner_variant,omitempty"`

	Props     map[string]any    `json:"props,omitempty"`
	UserProps map[string]string `json:"user_props,omitempty"`

	LCP  *float64 `json:"lcp,omitempty"`
	FID  *float64 `json:"fid,omitempty"`
	CLS  *float64 `json:"cls,omitempty"`
	TTFB *float64 `json:"ttfb,omitempty"`
	FCP  *float64 `json:"fcp,omitempty"`

	ScrollDepth *int `json:"scroll_depth,omitempty"`
}

type CollectRequest struct {
	PublicKey string          `json:"k"`
	Events    []IncomingEvent `json:"events"`
}

type Session struct {
	WorkspaceID     uuid.UUID         `json:"workspace_id"`
	ProjectID       uuid.UUID         `json:"project_id"`
	SessionID       string            `json:"session_id"`
	AnonID          string            `json:"anon_id"`
	UserID          *string           `json:"user_id,omitempty"`
	StartedAt       time.Time         `json:"started_at"`
	EndedAt         time.Time         `json:"ended_at"`
	DurationSeconds int               `json:"duration_seconds"`
	EntryURL        string            `json:"entry_url"`
	EntryPath       string            `json:"entry_path"`
	ExitURL         string            `json:"exit_url"`
	ExitPath        string            `json:"exit_path"`
	PageViews       int               `json:"page_views"`
	EventsCount     int               `json:"events_count"`
	IsBounce        bool              `json:"is_bounce"`
	Referrer        string            `json:"referrer"`
	UTM             map[string]string `json:"utm,omitempty"`
	Country         string            `json:"country"`
	Region          string            `json:"region"`
	City            string            `json:"city"`
	UABrowser       string            `json:"ua_browser"`
	UAOS            string            `json:"ua_os"`
	UADeviceType    string            `json:"ua_device_type"`
	Revenue         float64           `json:"revenue"`
	HasPurchase     bool              `json:"has_purchase"`
}

type UserState struct {
	WorkspaceID    uuid.UUID         `json:"workspace_id"`
	ProjectID      uuid.UUID         `json:"project_id"`
	AnonID         string            `json:"anon_id"`
	UserID         *string           `json:"user_id,omitempty"`
	FirstSeen      time.Time         `json:"first_seen"`
	LastSeen       time.Time         `json:"last_seen"`
	TotalSessions  int               `json:"total_sessions"`
	TotalEvents    int64             `json:"total_events"`
	TotalPageViews int64             `json:"total_page_views"`
	TotalRevenue   float64           `json:"total_revenue"`
	FirstReferrer  string            `json:"first_referrer"`
	FirstUTM       map[string]string `json:"first_utm,omitempty"`
	LastCountry    string            `json:"last_country"`
	LastCity       string            `json:"last_city"`
	LastBrowser    string            `json:"last_browser"`
	LastOS         string            `json:"last_os"`
	LastDevice     string            `json:"last_device"`
	UserProps      map[string]string `json:"user_props,omitempty"`
}
