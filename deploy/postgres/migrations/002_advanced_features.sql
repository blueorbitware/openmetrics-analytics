-- Advanced Features Schema
-- AI Settings, Storage Config, Session Replay, Heatmaps, Surveys, Data Governance

-- Workspace Settings table (AI keys, storage config, etc.)
CREATE TABLE IF NOT EXISTS workspace_settings (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- AI Provider API Keys (encrypted)
    ai_openai_key TEXT,
    ai_claude_key TEXT,
    ai_gemini_key TEXT,
    ai_deepseek_key TEXT,
    ai_kimi_key TEXT,
    ai_default_provider VARCHAR(50) DEFAULT 'openai',
    ai_enabled BOOLEAN DEFAULT FALSE,
    
    -- Storage Configuration
    storage_provider VARCHAR(50) DEFAULT 'server', -- server, s3, gcs
    storage_s3_bucket VARCHAR(255),
    storage_s3_region VARCHAR(50),
    storage_s3_access_key TEXT,
    storage_s3_secret_key TEXT,
    storage_gcs_bucket VARCHAR(255),
    storage_gcs_project_id VARCHAR(255),
    storage_gcs_credentials TEXT, -- JSON key file contents
    
    -- Data Governance
    pii_masking_enabled BOOLEAN DEFAULT TRUE,
    pii_mask_emails BOOLEAN DEFAULT TRUE,
    pii_mask_phones BOOLEAN DEFAULT TRUE,
    pii_mask_credit_cards BOOLEAN DEFAULT TRUE,
    pii_custom_patterns TEXT[], -- Custom regex patterns
    data_retention_days INTEGER DEFAULT 365,
    gdpr_enabled BOOLEAN DEFAULT TRUE,
    
    -- Session Replay Settings
    replay_enabled BOOLEAN DEFAULT FALSE,
    replay_sample_rate DECIMAL(5,4) DEFAULT 0.1, -- 10% by default
    replay_mask_inputs BOOLEAN DEFAULT TRUE,
    replay_mask_text BOOLEAN DEFAULT FALSE,
    
    -- Heatmap Settings
    heatmap_enabled BOOLEAN DEFAULT FALSE,
    heatmap_click BOOLEAN DEFAULT TRUE,
    heatmap_scroll BOOLEAN DEFAULT TRUE,
    heatmap_movement BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Insights table (generated insights)
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL, -- anomaly, trend, recommendation, prediction
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical, success
    metric_name VARCHAR(100),
    metric_value DECIMAL(18,4),
    metric_change DECIMAL(10,4),
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_workspace ON ai_insights(workspace_id);
CREATE INDEX idx_ai_insights_project ON ai_insights(project_id);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at DESC);

-- AI Queries table (natural language query history)
CREATE TABLE IF NOT EXISTS ai_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    generated_sql TEXT,
    result_summary TEXT,
    result_data JSONB,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_queries_workspace ON ai_queries(workspace_id);
CREATE INDEX idx_ai_queries_user ON ai_queries(user_id);

-- Session Replays table
CREATE TABLE IF NOT EXISTS session_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    anon_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    page_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    storage_path TEXT, -- Path to recording file
    storage_size_bytes BIGINT,
    entry_url TEXT,
    country VARCHAR(10),
    city VARCHAR(100),
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_replays_project ON session_replays(project_id);
CREATE INDEX idx_session_replays_session ON session_replays(session_id);
CREATE INDEX idx_session_replays_started ON session_replays(started_at DESC);

-- Heatmaps table
CREATE TABLE IF NOT EXISTS heatmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url_pattern VARCHAR(500) NOT NULL, -- URL or pattern to match
    heatmap_type VARCHAR(20) NOT NULL, -- click, scroll, movement
    data JSONB DEFAULT '{}'::jsonb, -- Aggregated heatmap data
    sample_count INTEGER DEFAULT 0,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heatmaps_project ON heatmaps(project_id);

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    survey_type VARCHAR(50) NOT NULL, -- nps, rating, multiple_choice, free_text
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, completed
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    targeting JSONB DEFAULT '{}'::jsonb,
    display_type VARCHAR(50) DEFAULT 'modal', -- modal, slideout, tooltip, banner
    frequency_cap INTEGER DEFAULT 1,
    frequency_days INTEGER DEFAULT 30,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    response_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_surveys_project ON surveys(project_id);
CREATE INDEX idx_surveys_status ON surveys(status);

-- Survey Responses table
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    anon_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    response_data JSONB NOT NULL,
    score INTEGER, -- For NPS/rating surveys
    page_url TEXT,
    device_type VARCHAR(20),
    country VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_project ON survey_responses(project_id);
CREATE INDEX idx_survey_responses_created ON survey_responses(created_at DESC);

-- Guides table (tooltips, walkthroughs)
CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    guide_type VARCHAR(50) NOT NULL, -- tooltip, modal, slideout, banner, walkthrough
    status VARCHAR(20) DEFAULT 'draft',
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    targeting JSONB DEFAULT '{}'::jsonb,
    trigger_event VARCHAR(100), -- Event that triggers the guide
    trigger_url VARCHAR(500), -- URL pattern to trigger
    frequency_cap INTEGER DEFAULT 1,
    impression_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guides_project ON guides(project_id);
CREATE INDEX idx_guides_status ON guides(status);

-- GDPR Requests table
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- deletion, export, access
    identifier_type VARCHAR(50) NOT NULL, -- email, user_id, anon_id
    identifier_value VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    requested_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    result_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gdpr_requests_workspace ON gdpr_requests(workspace_id);
CREATE INDEX idx_gdpr_requests_status ON gdpr_requests(status);

-- Annotations table (for team collaboration)
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    annotation_date DATE NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_project ON annotations(project_id);
CREATE INDEX idx_annotations_date ON annotations(annotation_date);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL, -- dashboard, report, insight
    target_id UUID NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions UUID[], -- Array of mentioned user IDs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_workspace ON comments(workspace_id);
CREATE INDEX idx_comments_target ON comments(target_type, target_id);

-- Activity Feed table
CREATE TABLE IF NOT EXISTS activity_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    target_name VARCHAR(255),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_workspace ON activity_feed(workspace_id);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);

-- Triggers
CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON workspace_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_heatmaps_updated_at BEFORE UPDATE ON heatmaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
