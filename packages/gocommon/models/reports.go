package models

import (
	"time"

	"github.com/google/uuid"
)

type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

type Filter struct {
	Property string `json:"property"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

type EventsReportRequest struct {
	ProjectID    uuid.UUID `json:"project_id"`
	ProjectIDStr string    `json:"project_id_str,omitempty"`
	EventName    string    `json:"event_name"`
	TimeRange    TimeRange `json:"time_range"`
	Interval     string    `json:"interval"`
	Filters      []Filter  `json:"filters,omitempty"`
	Breakdown    *string   `json:"breakdown,omitempty"`
	Metrics      []string  `json:"metrics"`
}

type EventsReportResponse struct {
	Data []TimeSeriesPoint `json:"data"`
	Meta ReportMeta        `json:"meta"`
}

type TimeSeriesPoint struct {
	Timestamp   time.Time         `json:"timestamp"`
	Count       int64             `json:"count"`
	UniqueUsers int64             `json:"unique_users"`
	Breakdown   map[string]int64  `json:"breakdown,omitempty"`
}

type ReportMeta struct {
	TotalCount       int64   `json:"total_count"`
	TotalUniqueUsers int64   `json:"total_unique_users"`
	QueryTimeMS      int64   `json:"query_time_ms"`
}

type FunnelStep struct {
	EventName string   `json:"event_name"`
	Filters   []Filter `json:"filters,omitempty"`
}

type FunnelReportRequest struct {
	ProjectID       uuid.UUID    `json:"project_id"`
	Steps           []FunnelStep `json:"steps"`
	TimeRange       TimeRange    `json:"time_range"`
	ConversionWindow int         `json:"conversion_window_hours"`
	Breakdown       *string      `json:"breakdown,omitempty"`
}

type FunnelStepResult struct {
	StepNumber     int     `json:"step_number"`
	EventName      string  `json:"event_name"`
	Count          int64   `json:"count"`
	ConversionRate float64 `json:"conversion_rate"`
	DropoffRate    float64 `json:"dropoff_rate"`
}

type FunnelReportResponse struct {
	Steps           []FunnelStepResult       `json:"steps"`
	OverallConversion float64                `json:"overall_conversion"`
	Breakdown       map[string][]FunnelStepResult `json:"breakdown,omitempty"`
	Meta            ReportMeta               `json:"meta"`
}

type RetentionReportRequest struct {
	ProjectID      uuid.UUID `json:"project_id"`
	StartEvent     string    `json:"start_event"`
	ReturnEvent    string    `json:"return_event"`
	TimeRange      TimeRange `json:"time_range"`
	RetentionPeriod string   `json:"retention_period"`
	Periods        int       `json:"periods"`
}

type RetentionCohort struct {
	CohortDate    time.Time `json:"cohort_date"`
	CohortSize    int64     `json:"cohort_size"`
	RetentionData []float64 `json:"retention_data"`
}

type RetentionReportResponse struct {
	Cohorts []RetentionCohort `json:"cohorts"`
	Average []float64         `json:"average"`
	Meta    ReportMeta        `json:"meta"`
}

type PathsReportRequest struct {
	ProjectID   uuid.UUID `json:"project_id"`
	StartEvent  *string   `json:"start_event,omitempty"`
	EndEvent    *string   `json:"end_event,omitempty"`
	TimeRange   TimeRange `json:"time_range"`
	MaxSteps    int       `json:"max_steps"`
	MinCount    int       `json:"min_count"`
}

type PathNode struct {
	Event string `json:"event"`
	Count int64  `json:"count"`
}

type PathEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Count  int64  `json:"count"`
}

type PathsReportResponse struct {
	Nodes []PathNode `json:"nodes"`
	Edges []PathEdge `json:"edges"`
	Meta  ReportMeta `json:"meta"`
}

type LiveReportRequest struct {
	ProjectID uuid.UUID `json:"project_id"`
	Seconds   int       `json:"seconds"`
}

type LiveEvent struct {
	EventID     uuid.UUID `json:"event_id"`
	EventName   string    `json:"event_name"`
	EventType   string    `json:"event_type"`
	Timestamp   time.Time `json:"timestamp"`
	AnonID      string    `json:"anon_id"`
	UserID      *string   `json:"user_id,omitempty"`
	URL         string    `json:"url"`
	Country     string    `json:"country"`
	City        string    `json:"city"`
	Browser     string    `json:"browser"`
	OS          string    `json:"os"`
	DeviceType  string    `json:"device_type"`
}

type LiveReportResponse struct {
	Events         []LiveEvent `json:"events"`
	ActiveUsers    int64       `json:"active_users"`
	EventsPerMinute float64    `json:"events_per_minute"`
}

type UserTimelineRequest struct {
	ProjectID uuid.UUID `json:"project_id"`
	AnonID    string    `json:"anon_id"`
	Limit     int       `json:"limit"`
	Offset    int       `json:"offset"`
}

type UserTimelineResponse struct {
	User   UserState `json:"user"`
	Events []Event   `json:"events"`
	Total  int64     `json:"total"`
}

type SessionDetailRequest struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID string    `json:"session_id"`
}

type SessionDetailResponse struct {
	Session Session `json:"session"`
	Events  []Event `json:"events"`
}

type DailyMetrics struct {
	Date              time.Time        `json:"date"`
	UniqueUsers       int64            `json:"unique_users"`
	Sessions          int64            `json:"sessions"`
	PageViews         int64            `json:"page_views"`
	Events            int64            `json:"events"`
	AvgSessionDuration float64         `json:"avg_session_duration"`
	BounceRate        float64          `json:"bounce_rate"`
	TotalRevenue      float64          `json:"total_revenue"`
	Transactions      int64            `json:"transactions"`
	TopEvents         map[string]int64 `json:"top_events"`
	TopPages          map[string]int64 `json:"top_pages"`
}

type OverviewResponse struct {
	CurrentPeriod  DailyMetrics `json:"current_period"`
	PreviousPeriod DailyMetrics `json:"previous_period"`
	Changes        MetricChanges `json:"changes"`
}

type MetricChanges struct {
	UniqueUsers  float64 `json:"unique_users"`
	Sessions     float64 `json:"sessions"`
	PageViews    float64 `json:"page_views"`
	BounceRate   float64 `json:"bounce_rate"`
	Revenue      float64 `json:"revenue"`
}
