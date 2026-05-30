package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/analytics/api/internal/middleware"
	"github.com/go-chi/chi/v5"
)

type WorkspaceSettings struct {
	WorkspaceID string `json:"workspace_id"`

	// AI Configuration
	AIOpenAIKey      string `json:"ai_openai_key,omitempty"`
	AIClaudeKey      string `json:"ai_claude_key,omitempty"`
	AIGeminiKey      string `json:"ai_gemini_key,omitempty"`
	AIDeepSeekKey    string `json:"ai_deepseek_key,omitempty"`
	AIKimiKey        string `json:"ai_kimi_key,omitempty"`
	AIDefaultProvider string `json:"ai_default_provider"`
	AIEnabled        bool   `json:"ai_enabled"`

	// Storage Configuration
	StorageProvider     string `json:"storage_provider"`
	StorageS3Bucket     string `json:"storage_s3_bucket,omitempty"`
	StorageS3Region     string `json:"storage_s3_region,omitempty"`
	StorageS3AccessKey  string `json:"storage_s3_access_key,omitempty"`
	StorageS3SecretKey  string `json:"storage_s3_secret_key,omitempty"`
	StorageGCSBucket    string `json:"storage_gcs_bucket,omitempty"`
	StorageGCSProjectID string `json:"storage_gcs_project_id,omitempty"`
	StorageGCSCreds     string `json:"storage_gcs_credentials,omitempty"`

	// Data Governance
	PIIMaskingEnabled  bool     `json:"pii_masking_enabled"`
	PIIMaskEmails      bool     `json:"pii_mask_emails"`
	PIIMaskPhones      bool     `json:"pii_mask_phones"`
	PIIMaskCreditCards bool     `json:"pii_mask_credit_cards"`
	PIICustomPatterns  []string `json:"pii_custom_patterns"`
	DataRetentionDays  int      `json:"data_retention_days"`
	GDPREnabled        bool     `json:"gdpr_enabled"`

	// Session Replay
	ReplayEnabled    bool    `json:"replay_enabled"`
	ReplaySampleRate float64 `json:"replay_sample_rate"`
	ReplayMaskInputs bool    `json:"replay_mask_inputs"`
	ReplayMaskText   bool    `json:"replay_mask_text"`

	// Heatmaps
	HeatmapEnabled  bool `json:"heatmap_enabled"`
	HeatmapClick    bool `json:"heatmap_click"`
	HeatmapScroll   bool `json:"heatmap_scroll"`
	HeatmapMovement bool `json:"heatmap_movement"`
}

// MaskedSettings returns settings with sensitive keys masked
type MaskedSettings struct {
	WorkspaceID string `json:"workspace_id"`

	AIOpenAIKey       string `json:"ai_openai_key"`
	AIClaudeKey       string `json:"ai_claude_key"`
	AIGeminiKey       string `json:"ai_gemini_key"`
	AIDeepSeekKey     string `json:"ai_deepseek_key"`
	AIKimiKey         string `json:"ai_kimi_key"`
	AIDefaultProvider string `json:"ai_default_provider"`
	AIEnabled         bool   `json:"ai_enabled"`

	StorageProvider     string `json:"storage_provider"`
	StorageS3Bucket     string `json:"storage_s3_bucket"`
	StorageS3Region     string `json:"storage_s3_region"`
	StorageS3AccessKey  string `json:"storage_s3_access_key"`
	StorageGCSBucket    string `json:"storage_gcs_bucket"`
	StorageGCSProjectID string `json:"storage_gcs_project_id"`
	StorageGCSCreds     string `json:"storage_gcs_credentials"`

	PIIMaskingEnabled  bool     `json:"pii_masking_enabled"`
	PIIMaskEmails      bool     `json:"pii_mask_emails"`
	PIIMaskPhones      bool     `json:"pii_mask_phones"`
	PIIMaskCreditCards bool     `json:"pii_mask_credit_cards"`
	PIICustomPatterns  []string `json:"pii_custom_patterns"`
	DataRetentionDays  int      `json:"data_retention_days"`
	GDPREnabled        bool     `json:"gdpr_enabled"`

	ReplayEnabled    bool    `json:"replay_enabled"`
	ReplaySampleRate float64 `json:"replay_sample_rate"`
	ReplayMaskInputs bool    `json:"replay_mask_inputs"`
	ReplayMaskText   bool    `json:"replay_mask_text"`

	HeatmapEnabled  bool `json:"heatmap_enabled"`
	HeatmapClick    bool `json:"heatmap_click"`
	HeatmapScroll   bool `json:"heatmap_scroll"`
	HeatmapMovement bool `json:"heatmap_movement"`
}

func maskKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "••••••••"
	}
	return key[:4] + "••••••••" + key[len(key)-4:]
}

func (h *Handlers) GetWorkspaceSettings(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "workspaceID")
	if workspaceID == "" {
		workspaceID = middleware.GetWorkspaceID(r.Context()).String()
	}

	var settings WorkspaceSettings
	var patterns *string

	err := h.pg.QueryRow(r.Context(), `
		SELECT 
			workspace_id,
			COALESCE(ai_openai_key, ''),
			COALESCE(ai_claude_key, ''),
			COALESCE(ai_gemini_key, ''),
			COALESCE(ai_deepseek_key, ''),
			COALESCE(ai_kimi_key, ''),
			COALESCE(ai_default_provider, 'openai'),
			COALESCE(ai_enabled, false),
			COALESCE(storage_provider, 'server'),
			COALESCE(storage_s3_bucket, ''),
			COALESCE(storage_s3_region, ''),
			COALESCE(storage_s3_access_key, ''),
			COALESCE(storage_s3_secret_key, ''),
			COALESCE(storage_gcs_bucket, ''),
			COALESCE(storage_gcs_project_id, ''),
			COALESCE(storage_gcs_credentials, ''),
			COALESCE(pii_masking_enabled, true),
			COALESCE(pii_mask_emails, true),
			COALESCE(pii_mask_phones, true),
			COALESCE(pii_mask_credit_cards, true),
			pii_custom_patterns,
			COALESCE(data_retention_days, 365),
			COALESCE(gdpr_enabled, true),
			COALESCE(replay_enabled, false),
			COALESCE(replay_sample_rate, 0.1),
			COALESCE(replay_mask_inputs, true),
			COALESCE(replay_mask_text, false),
			COALESCE(heatmap_enabled, false),
			COALESCE(heatmap_click, true),
			COALESCE(heatmap_scroll, true),
			COALESCE(heatmap_movement, false)
		FROM workspace_settings
		WHERE workspace_id = $1
	`, workspaceID).Scan(
		&settings.WorkspaceID,
		&settings.AIOpenAIKey,
		&settings.AIClaudeKey,
		&settings.AIGeminiKey,
		&settings.AIDeepSeekKey,
		&settings.AIKimiKey,
		&settings.AIDefaultProvider,
		&settings.AIEnabled,
		&settings.StorageProvider,
		&settings.StorageS3Bucket,
		&settings.StorageS3Region,
		&settings.StorageS3AccessKey,
		&settings.StorageS3SecretKey,
		&settings.StorageGCSBucket,
		&settings.StorageGCSProjectID,
		&settings.StorageGCSCreds,
		&settings.PIIMaskingEnabled,
		&settings.PIIMaskEmails,
		&settings.PIIMaskPhones,
		&settings.PIIMaskCreditCards,
		&patterns,
		&settings.DataRetentionDays,
		&settings.GDPREnabled,
		&settings.ReplayEnabled,
		&settings.ReplaySampleRate,
		&settings.ReplayMaskInputs,
		&settings.ReplayMaskText,
		&settings.HeatmapEnabled,
		&settings.HeatmapClick,
		&settings.HeatmapScroll,
		&settings.HeatmapMovement,
	)

	if err != nil {
		// No settings yet - return defaults
		respondJSON(w, http.StatusOK, MaskedSettings{
			WorkspaceID:        workspaceID,
			AIDefaultProvider:  "openai",
			AIEnabled:          false,
			StorageProvider:    "server",
			PIIMaskingEnabled:  true,
			PIIMaskEmails:      true,
			PIIMaskPhones:      true,
			PIIMaskCreditCards: true,
			PIICustomPatterns:  []string{},
			DataRetentionDays:  365,
			GDPREnabled:        true,
			ReplayEnabled:      false,
			ReplaySampleRate:   0.1,
			ReplayMaskInputs:   true,
			ReplayMaskText:     false,
			HeatmapEnabled:     false,
			HeatmapClick:       true,
			HeatmapScroll:      true,
			HeatmapMovement:    false,
		})
		return
	}

	// Parse custom patterns
	if patterns != nil {
		var p []string
		json.Unmarshal([]byte(*patterns), &p)
		settings.PIICustomPatterns = p
	}

	// Mask sensitive keys before returning
	masked := MaskedSettings{
		WorkspaceID:        settings.WorkspaceID,
		AIOpenAIKey:        maskKey(settings.AIOpenAIKey),
		AIClaudeKey:        maskKey(settings.AIClaudeKey),
		AIGeminiKey:        maskKey(settings.AIGeminiKey),
		AIDeepSeekKey:      maskKey(settings.AIDeepSeekKey),
		AIKimiKey:          maskKey(settings.AIKimiKey),
		AIDefaultProvider:  settings.AIDefaultProvider,
		AIEnabled:          settings.AIEnabled,
		StorageProvider:    settings.StorageProvider,
		StorageS3Bucket:    settings.StorageS3Bucket,
		StorageS3Region:    settings.StorageS3Region,
		StorageS3AccessKey: maskKey(settings.StorageS3AccessKey),
		StorageGCSBucket:   settings.StorageGCSBucket,
		StorageGCSProjectID: settings.StorageGCSProjectID,
		StorageGCSCreds:    maskKey(settings.StorageGCSCreds),
		PIIMaskingEnabled:  settings.PIIMaskingEnabled,
		PIIMaskEmails:      settings.PIIMaskEmails,
		PIIMaskPhones:      settings.PIIMaskPhones,
		PIIMaskCreditCards: settings.PIIMaskCreditCards,
		PIICustomPatterns:  settings.PIICustomPatterns,
		DataRetentionDays:  settings.DataRetentionDays,
		GDPREnabled:        settings.GDPREnabled,
		ReplayEnabled:      settings.ReplayEnabled,
		ReplaySampleRate:   settings.ReplaySampleRate,
		ReplayMaskInputs:   settings.ReplayMaskInputs,
		ReplayMaskText:     settings.ReplayMaskText,
		HeatmapEnabled:     settings.HeatmapEnabled,
		HeatmapClick:       settings.HeatmapClick,
		HeatmapScroll:      settings.HeatmapScroll,
		HeatmapMovement:    settings.HeatmapMovement,
	}

	respondJSON(w, http.StatusOK, masked)
}

func (h *Handlers) UpdateWorkspaceSettings(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "workspaceID")
	if workspaceID == "" {
		workspaceID = middleware.GetWorkspaceID(r.Context()).String()
	}

	var req WorkspaceSettings
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Use UPSERT
	err := h.pg.Exec(r.Context(), `
		INSERT INTO workspace_settings (
			workspace_id,
			ai_openai_key, ai_claude_key, ai_gemini_key, ai_deepseek_key, ai_kimi_key,
			ai_default_provider, ai_enabled,
			storage_provider, storage_s3_bucket, storage_s3_region, storage_s3_access_key, storage_s3_secret_key,
			storage_gcs_bucket, storage_gcs_project_id, storage_gcs_credentials,
			pii_masking_enabled, pii_mask_emails, pii_mask_phones, pii_mask_credit_cards, pii_custom_patterns,
			data_retention_days, gdpr_enabled,
			replay_enabled, replay_sample_rate, replay_mask_inputs, replay_mask_text,
			heatmap_enabled, heatmap_click, heatmap_scroll, heatmap_movement
		) VALUES (
			$1,
			NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''),
			$7, $8,
			$9, NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''),
			NULLIF($14, ''), NULLIF($15, ''), NULLIF($16, ''),
			$17, $18, $19, $20, $21,
			$22, $23,
			$24, $25, $26, $27,
			$28, $29, $30, $31
		)
		ON CONFLICT (workspace_id) DO UPDATE SET
			ai_openai_key = CASE WHEN $2 != '' AND $2 NOT LIKE '%••••%' THEN $2 ELSE workspace_settings.ai_openai_key END,
			ai_claude_key = CASE WHEN $3 != '' AND $3 NOT LIKE '%••••%' THEN $3 ELSE workspace_settings.ai_claude_key END,
			ai_gemini_key = CASE WHEN $4 != '' AND $4 NOT LIKE '%••••%' THEN $4 ELSE workspace_settings.ai_gemini_key END,
			ai_deepseek_key = CASE WHEN $5 != '' AND $5 NOT LIKE '%••••%' THEN $5 ELSE workspace_settings.ai_deepseek_key END,
			ai_kimi_key = CASE WHEN $6 != '' AND $6 NOT LIKE '%••••%' THEN $6 ELSE workspace_settings.ai_kimi_key END,
			ai_default_provider = $7,
			ai_enabled = $8,
			storage_provider = $9,
			storage_s3_bucket = NULLIF($10, ''),
			storage_s3_region = NULLIF($11, ''),
			storage_s3_access_key = CASE WHEN $12 != '' AND $12 NOT LIKE '%••••%' THEN $12 ELSE workspace_settings.storage_s3_access_key END,
			storage_s3_secret_key = CASE WHEN $13 != '' AND $13 NOT LIKE '%••••%' THEN $13 ELSE workspace_settings.storage_s3_secret_key END,
			storage_gcs_bucket = NULLIF($14, ''),
			storage_gcs_project_id = NULLIF($15, ''),
			storage_gcs_credentials = CASE WHEN $16 != '' AND $16 NOT LIKE '%••••%' THEN $16 ELSE workspace_settings.storage_gcs_credentials END,
			pii_masking_enabled = $17,
			pii_mask_emails = $18,
			pii_mask_phones = $19,
			pii_mask_credit_cards = $20,
			pii_custom_patterns = $21,
			data_retention_days = $22,
			gdpr_enabled = $23,
			replay_enabled = $24,
			replay_sample_rate = $25,
			replay_mask_inputs = $26,
			replay_mask_text = $27,
			heatmap_enabled = $28,
			heatmap_click = $29,
			heatmap_scroll = $30,
			heatmap_movement = $31,
			updated_at = NOW()
	`, workspaceID,
		req.AIOpenAIKey, req.AIClaudeKey, req.AIGeminiKey, req.AIDeepSeekKey, req.AIKimiKey,
		req.AIDefaultProvider, req.AIEnabled,
		req.StorageProvider, req.StorageS3Bucket, req.StorageS3Region, req.StorageS3AccessKey, req.StorageS3SecretKey,
		req.StorageGCSBucket, req.StorageGCSProjectID, req.StorageGCSCreds,
		req.PIIMaskingEnabled, req.PIIMaskEmails, req.PIIMaskPhones, req.PIIMaskCreditCards, req.PIICustomPatterns,
		req.DataRetentionDays, req.GDPREnabled,
		req.ReplayEnabled, req.ReplaySampleRate, req.ReplayMaskInputs, req.ReplayMaskText,
		req.HeatmapEnabled, req.HeatmapClick, req.HeatmapScroll, req.HeatmapMovement,
	)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save settings: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// TestAIConnection tests if an AI provider key is valid
func (h *Handlers) TestAIConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// For now, just validate that the key looks valid
	// In production, we'd make a test API call to each provider
	valid := len(req.APIKey) > 10
	var message string

	switch req.Provider {
	case "openai":
		valid = valid && (len(req.APIKey) > 20 && (req.APIKey[:3] == "sk-" || req.APIKey[:4] == "org-"))
		if valid {
			message = "OpenAI API key format is valid"
		} else {
			message = "Invalid OpenAI API key format (should start with sk-)"
		}
	case "claude":
		valid = valid && len(req.APIKey) > 20
		message = "Anthropic API key format looks valid"
	case "gemini":
		valid = valid && len(req.APIKey) > 20
		message = "Google AI API key format looks valid"
	case "deepseek":
		valid = valid && len(req.APIKey) > 20
		message = "DeepSeek API key format looks valid"
	case "kimi":
		valid = valid && len(req.APIKey) > 20
		message = "Kimi API key format looks valid"
	default:
		respondError(w, http.StatusBadRequest, "unknown provider: "+req.Provider)
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"valid":    valid,
		"message":  message,
		"provider": req.Provider,
	})
}

// TestStorageConnection tests if storage credentials are valid
func (h *Handlers) TestStorageConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider    string `json:"provider"`
		S3Bucket    string `json:"s3_bucket"`
		S3Region    string `json:"s3_region"`
		S3AccessKey string `json:"s3_access_key"`
		S3SecretKey string `json:"s3_secret_key"`
		GCSBucket   string `json:"gcs_bucket"`
		GCSProjectID string `json:"gcs_project_id"`
		GCSCreds    string `json:"gcs_credentials"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	switch req.Provider {
	case "server":
		respondJSON(w, http.StatusOK, map[string]any{
			"valid":    true,
			"message":  "Server storage is always available",
			"provider": req.Provider,
		})
	case "s3":
		// In production, we'd test actual S3 connection
		valid := req.S3Bucket != "" && req.S3Region != "" && req.S3AccessKey != "" && req.S3SecretKey != ""
		message := "S3 configuration looks valid"
		if !valid {
			message = "Missing required S3 configuration fields"
		}
		respondJSON(w, http.StatusOK, map[string]any{
			"valid":    valid,
			"message":  message,
			"provider": req.Provider,
		})
	case "gcs":
		valid := req.GCSBucket != "" && req.GCSProjectID != "" && req.GCSCreds != ""
		message := "Google Cloud Storage configuration looks valid"
		if !valid {
			message = "Missing required GCS configuration fields"
		}
		respondJSON(w, http.StatusOK, map[string]any{
			"valid":    valid,
			"message":  message,
			"provider": req.Provider,
		})
	default:
		respondError(w, http.StatusBadRequest, "unknown storage provider: "+req.Provider)
	}
}
