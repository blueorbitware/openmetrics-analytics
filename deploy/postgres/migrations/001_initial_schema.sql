-- Analytics Platform PostgreSQL Schema
-- This file runs on container startup via docker-entrypoint-initdb.d

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom types
CREATE TYPE membership_role AS ENUM ('admin', 'user');
CREATE TYPE banner_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE report_type AS ENUM ('events', 'funnel', 'retention', 'paths', 'live', 'users', 'sessions');

-- Workspaces table (multi-tenancy + white-label)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    plan VARCHAR(50) DEFAULT 'free',
    branding JSONB DEFAULT '{}'::jsonb,
    custom_domain VARCHAR(255),
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_custom_domain ON workspaces(custom_domain) WHERE custom_domain IS NOT NULL;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Memberships table (user <-> workspace relationship with role)
CREATE TABLE memberships (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'user',
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_workspace ON memberships(workspace_id);

-- Projects table (websites/apps to track)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    public_key VARCHAR(50) NOT NULL UNIQUE,
    secret_key VARCHAR(100) NOT NULL,
    domain VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE UNIQUE INDEX idx_projects_public_key ON projects(public_key);

-- Project settings table
CREATE TABLE project_settings (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    autotrack JSONB DEFAULT '{
        "page_views": true,
        "clicks": true,
        "forms": true,
        "scroll_depth": true,
        "outbound_links": true,
        "web_vitals": true,
        "spa_navigation": true
    }'::jsonb,
    mask_selectors TEXT[] DEFAULT ARRAY[]::TEXT[],
    allowed_origins TEXT[] DEFAULT ARRAY['*']::TEXT[],
    sample_rate DECIMAL(5,4) DEFAULT 1.0,
    anonymize_ip BOOLEAN DEFAULT FALSE,
    cookie_domain VARCHAR(255),
    session_timeout_minutes INTEGER DEFAULT 30,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banners table (pop-ups / campaigns)
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status banner_status DEFAULT 'draft',
    config JSONB DEFAULT '{}'::jsonb,
    targeting JSONB DEFAULT '{}'::jsonb,
    frequency_cap_per_user INTEGER DEFAULT 1,
    frequency_cap_days INTEGER DEFAULT 7,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_banners_project ON banners(project_id);
CREATE INDEX idx_banners_project_status ON banners(project_id, status);

-- Banner variants table (A/B testing)
CREATE TABLE banner_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    banner_id UUID NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'Control',
    weight INTEGER DEFAULT 100,
    html TEXT NOT NULL,
    css TEXT DEFAULT '',
    cta_url VARCHAR(500),
    cta_text VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_banner_variants_banner ON banner_variants(banner_id);

-- Dashboards table
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_project ON dashboards(project_id);

-- Reports table (saved report configurations)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type report_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    position JSONB DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_dashboard ON reports(dashboard_id);
CREATE INDEX idx_reports_project ON reports(project_id);

-- API Tokens table
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(20) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read:reports']::TEXT[],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_tokens_workspace ON api_tokens(workspace_id);
CREATE INDEX idx_api_tokens_hash ON api_tokens(token_hash) WHERE revoked_at IS NULL;

-- Audit Log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    meta JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_workspace ON audit_log(workspace_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Refresh tokens table (for JWT refresh token rotation)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role membership_role NOT NULL DEFAULT 'user',
    token_hash VARCHAR(255) NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_workspace ON invitations(workspace_id);
CREATE INDEX idx_invitations_token ON invitations(token_hash) WHERE accepted_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo data for testing
INSERT INTO users (id, email, password_hash, name, is_super_admin) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@analytics.local', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.tEvsqBfE1VH9Wy', 'Super Admin', true);

INSERT INTO workspaces (id, name, slug, plan) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Demo Workspace', 'demo', 'pro');

INSERT INTO memberships (workspace_id, user_id, role) VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin');

INSERT INTO projects (id, workspace_id, name, public_key, secret_key, domain) VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Demo Site', 'pk_test_demo', 'sk_test_demo_secret_key_12345', 'localhost');

INSERT INTO project_settings (project_id) VALUES 
    ('00000000-0000-0000-0000-000000000001');

-- Create default dashboard for demo project
INSERT INTO dashboards (id, project_id, name, is_default, created_by) VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Overview', true, '00000000-0000-0000-0000-000000000001');
