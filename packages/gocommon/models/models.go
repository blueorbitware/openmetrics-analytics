package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	Email         string     `json:"email" db:"email"`
	PasswordHash  string     `json:"-" db:"password_hash"`
	Name          string     `json:"name" db:"name"`
	IsSuperAdmin  bool       `json:"is_super_admin" db:"is_super_admin"`
	EmailVerified bool       `json:"email_verified" db:"email_verified"`
	AvatarURL     *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	LastLoginAt   *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

type Workspace struct {
	ID           uuid.UUID       `json:"id" db:"id"`
	Name         string          `json:"name" db:"name"`
	Slug         string          `json:"slug" db:"slug"`
	Plan         string          `json:"plan" db:"plan"`
	Branding     json.RawMessage `json:"branding" db:"branding"`
	CustomDomain *string         `json:"custom_domain,omitempty" db:"custom_domain"`
	IsSuspended  bool            `json:"is_suspended" db:"is_suspended"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

type Branding struct {
	LogoURL      string `json:"logo_url,omitempty"`
	PrimaryColor string `json:"primary_color,omitempty"`
	AccentColor  string `json:"accent_color,omitempty"`
	FaviconURL   string `json:"favicon_url,omitempty"`
	CompanyName  string `json:"company_name,omitempty"`
}

type MembershipRole string

const (
	RoleAdmin MembershipRole = "admin"
	RoleUser  MembershipRole = "user"
)

type Membership struct {
	WorkspaceID uuid.UUID      `json:"workspace_id" db:"workspace_id"`
	UserID      uuid.UUID      `json:"user_id" db:"user_id"`
	Role        MembershipRole `json:"role" db:"role"`
	InvitedBy   *uuid.UUID     `json:"invited_by,omitempty" db:"invited_by"`
	JoinedAt    time.Time      `json:"joined_at" db:"joined_at"`
}

type MemberWithUser struct {
	Membership
	User User `json:"user"`
}

type Project struct {
	ID          uuid.UUID `json:"id" db:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id" db:"workspace_id"`
	Name        string    `json:"name" db:"name"`
	PublicKey   string    `json:"public_key" db:"public_key"`
	SecretKey   string    `json:"-" db:"secret_key"`
	Domain      *string   `json:"domain,omitempty" db:"domain"`
	Timezone    string    `json:"timezone" db:"timezone"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type ProjectSettings struct {
	ProjectID             uuid.UUID       `json:"project_id" db:"project_id"`
	Autotrack             json.RawMessage `json:"autotrack" db:"autotrack"`
	MaskSelectors         []string        `json:"mask_selectors" db:"mask_selectors"`
	AllowedOrigins        []string        `json:"allowed_origins" db:"allowed_origins"`
	SampleRate            float64         `json:"sample_rate" db:"sample_rate"`
	AnonymizeIP           bool            `json:"anonymize_ip" db:"anonymize_ip"`
	CookieDomain          *string         `json:"cookie_domain,omitempty" db:"cookie_domain"`
	SessionTimeoutMinutes int             `json:"session_timeout_minutes" db:"session_timeout_minutes"`
	UpdatedAt             time.Time       `json:"updated_at" db:"updated_at"`
}

type AutotrackConfig struct {
	PageViews     bool `json:"page_views"`
	Clicks        bool `json:"clicks"`
	Forms         bool `json:"forms"`
	ScrollDepth   bool `json:"scroll_depth"`
	OutboundLinks bool `json:"outbound_links"`
	WebVitals     bool `json:"web_vitals"`
	SPANavigation bool `json:"spa_navigation"`
}

type BannerStatus string

const (
	BannerStatusDraft    BannerStatus = "draft"
	BannerStatusActive   BannerStatus = "active"
	BannerStatusPaused   BannerStatus = "paused"
	BannerStatusArchived BannerStatus = "archived"
)

type Banner struct {
	ID                  uuid.UUID       `json:"id" db:"id"`
	ProjectID           uuid.UUID       `json:"project_id" db:"project_id"`
	Name                string          `json:"name" db:"name"`
	Status              BannerStatus    `json:"status" db:"status"`
	Config              json.RawMessage `json:"config" db:"config"`
	Targeting           json.RawMessage `json:"targeting" db:"targeting"`
	FrequencyCapPerUser int             `json:"frequency_cap_per_user" db:"frequency_cap_per_user"`
	FrequencyCapDays    int             `json:"frequency_cap_days" db:"frequency_cap_days"`
	StartAt             *time.Time      `json:"start_at,omitempty" db:"start_at"`
	EndAt               *time.Time      `json:"end_at,omitempty" db:"end_at"`
	CreatedBy           *uuid.UUID      `json:"created_by,omitempty" db:"created_by"`
	CreatedAt           time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at" db:"updated_at"`
}

type BannerConfig struct {
	Type       string `json:"type"`
	Position   string `json:"position"`
	Animation  string `json:"animation"`
	CloseButton bool  `json:"close_button"`
	Backdrop   bool   `json:"backdrop"`
}

type BannerTargeting struct {
	URLPatterns  []string          `json:"url_patterns,omitempty"`
	UserProps    map[string]string `json:"user_props,omitempty"`
	Countries    []string          `json:"countries,omitempty"`
	Devices      []string          `json:"devices,omitempty"`
	EventTrigger *string           `json:"event_trigger,omitempty"`
	Percentage   int               `json:"percentage,omitempty"`
}

type BannerVariant struct {
	ID        uuid.UUID `json:"id" db:"id"`
	BannerID  uuid.UUID `json:"banner_id" db:"banner_id"`
	Name      string    `json:"name" db:"name"`
	Weight    int       `json:"weight" db:"weight"`
	HTML      string    `json:"html" db:"html"`
	CSS       string    `json:"css" db:"css"`
	CTAURL    *string   `json:"cta_url,omitempty" db:"cta_url"`
	CTAText   *string   `json:"cta_text,omitempty" db:"cta_text"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Dashboard struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	ProjectID   uuid.UUID       `json:"project_id" db:"project_id"`
	Name        string          `json:"name" db:"name"`
	Description *string         `json:"description,omitempty" db:"description"`
	Layout      json.RawMessage `json:"layout" db:"layout"`
	IsDefault   bool            `json:"is_default" db:"is_default"`
	CreatedBy   *uuid.UUID      `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type ReportType string

const (
	ReportTypeEvents    ReportType = "events"
	ReportTypeFunnel    ReportType = "funnel"
	ReportTypeRetention ReportType = "retention"
	ReportTypePaths     ReportType = "paths"
	ReportTypeLive      ReportType = "live"
	ReportTypeUsers     ReportType = "users"
	ReportTypeSessions  ReportType = "sessions"
)

type Report struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	DashboardID *uuid.UUID      `json:"dashboard_id,omitempty" db:"dashboard_id"`
	ProjectID   uuid.UUID       `json:"project_id" db:"project_id"`
	Name        string          `json:"name" db:"name"`
	Type        ReportType      `json:"type" db:"type"`
	Config      json.RawMessage `json:"config" db:"config"`
	Position    json.RawMessage `json:"position" db:"position"`
	CreatedBy   *uuid.UUID      `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type APIToken struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id" db:"workspace_id"`
	Name        string     `json:"name" db:"name"`
	TokenHash   string     `json:"-" db:"token_hash"`
	TokenPrefix string     `json:"token_prefix" db:"token_prefix"`
	Scopes      []string   `json:"scopes" db:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

type AuditLog struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	WorkspaceID *uuid.UUID      `json:"workspace_id,omitempty" db:"workspace_id"`
	ActorUserID *uuid.UUID      `json:"actor_user_id,omitempty" db:"actor_user_id"`
	Action      string          `json:"action" db:"action"`
	TargetType  *string         `json:"target_type,omitempty" db:"target_type"`
	TargetID    *uuid.UUID      `json:"target_id,omitempty" db:"target_id"`
	Meta        json.RawMessage `json:"meta,omitempty" db:"meta"`
	IPAddress   *string         `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent   *string         `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	TokenHash string     `json:"-" db:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UserAgent *string    `json:"user_agent,omitempty" db:"user_agent"`
	IPAddress *string    `json:"ip_address,omitempty" db:"ip_address"`
}

type Invitation struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	WorkspaceID uuid.UUID      `json:"workspace_id" db:"workspace_id"`
	Email       string         `json:"email" db:"email"`
	Role        MembershipRole `json:"role" db:"role"`
	TokenHash   string         `json:"-" db:"token_hash"`
	InvitedBy   *uuid.UUID     `json:"invited_by,omitempty" db:"invited_by"`
	ExpiresAt   time.Time      `json:"expires_at" db:"expires_at"`
	AcceptedAt  *time.Time     `json:"accepted_at,omitempty" db:"accepted_at"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
}
