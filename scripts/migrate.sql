-- ================================================
-- Analytics Platform - Complete Database Migration
-- ================================================
--
-- This file sets up PostgreSQL tables only.
-- For ClickHouse (events storage), run: scripts/seed-clickhouse.sql
--
-- QUICK RUN (copy this one command to your server SSH):
-- 
-- PostgreSQL:
-- docker exec -i $(docker ps -qf "name=analytics-db") psql -U postgres -d postgres < migrate.sql
--
-- ClickHouse:
-- docker exec -i $(docker ps -qf "name=analytics-clickhouse") clickhouse-client --multiquery < seed-clickhouse.sql
--
-- OR manually:
-- 
-- 1. SSH to server: ssh ubuntu@YOUR_SERVER_IP
-- 2. Enter psql: docker exec -it $(docker ps -qf "name=analytics-db") psql -U postgres -d postgres
-- 3. Copy and paste ALL contents below
-- 4. Exit psql: \q
--
-- SUPER ADMIN LOGIN:
-- Email: admin@analytics.local
-- Password: SuperAdmin123!
--
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- USERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_super_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist (for upgrades)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- ================================================
-- WORKSPACES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id),
    plan VARCHAR(50) DEFAULT 'free',
    branding JSONB DEFAULT '{}',
    custom_domain TEXT,
    settings JSONB DEFAULT '{}',
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist (for upgrades)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- ================================================
-- MEMBERSHIPS TABLE (User-Workspace relationship)
-- ================================================
CREATE TABLE IF NOT EXISTS memberships (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- Legacy table name support
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- ================================================
-- PROJECTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    public_key VARCHAR(64) UNIQUE NOT NULL,
    secret_key VARCHAR(64),
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secret_key VARCHAR(64);

-- Remove legacy private_key constraint if it exists (was replaced by secret_key)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'private_key') THEN
        ALTER TABLE projects ALTER COLUMN private_key DROP NOT NULL;
    END IF;
END $$;
DO $$ 
BEGIN
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_private_key_key;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ================================================
-- PROJECT SETTINGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS project_settings (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    allowed_origins TEXT[] DEFAULT '{}',
    autotrack JSONB DEFAULT '{"page_views": true, "clicks": true, "forms": true}',
    mask_selectors TEXT[] DEFAULT '{}',
    sample_rate DECIMAL DEFAULT 1.0,
    anonymize_ip BOOLEAN DEFAULT FALSE,
    cookie_domain TEXT,
    session_timeout_minutes INTEGER DEFAULT 30,
    rate_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- BANNERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    config JSONB NOT NULL DEFAULT '{}',
    targeting JSONB DEFAULT '{}',
    frequency_cap_per_user INTEGER DEFAULT 1,
    frequency_cap_days INTEGER DEFAULT 7,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE banners ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS frequency_cap_per_user INTEGER DEFAULT 1;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS frequency_cap_days INTEGER DEFAULT 7;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS start_at TIMESTAMP;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS end_at TIMESTAMP;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- ================================================
-- DASHBOARDS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '[]';
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- workspace_id is nullable (handler creates dashboards without it)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboards' AND column_name = 'workspace_id' AND is_nullable = 'NO') THEN
        ALTER TABLE dashboards ALTER COLUMN workspace_id DROP NOT NULL;
    END IF;
END $$;

-- ================================================
-- API TOKENS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(20),
    scopes TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS token_prefix VARCHAR(20);
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- ================================================
-- REFRESH TOKENS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- AUDIT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    actor_user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255),
    target_type VARCHAR(255),
    resource_id UUID,
    target_id UUID,
    details JSONB DEFAULT '{}',
    meta JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES users(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ================================================
-- WORKSPACE SETTINGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS workspace_settings (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    ai_provider VARCHAR(50),
    ai_api_key TEXT,
    ai_model VARCHAR(100),
    storage_provider VARCHAR(50) DEFAULT 'local',
    storage_config JSONB DEFAULT '{}',
    replay_enabled BOOLEAN DEFAULT FALSE,
    replay_sample_rate INTEGER DEFAULT 100,
    heatmap_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- INVITATIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    token_hash VARCHAR(255) NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_public_key ON projects(public_key);
CREATE INDEX IF NOT EXISTS idx_banners_workspace ON banners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_banners_project ON banners(project_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ================================================
-- CREATE SUPER ADMIN USER
-- ================================================
-- Password: SuperAdmin123!
INSERT INTO users (email, password_hash, name, is_super_admin, email_verified)
VALUES (
    'admin@analytics.local',
    '$2a$12$AoDcAD8.ASvaXqTw3tK5G.gCy3q.WkyJTtSvV4WWalKupzXmUFAMS',
    'Super Admin',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = '$2a$12$AoDcAD8.ASvaXqTw3tK5G.gCy3q.WkyJTtSvV4WWalKupzXmUFAMS',
    is_super_admin = TRUE,
    updated_at = NOW();

-- ================================================
-- DONE!
-- ================================================
SELECT 'Migration completed successfully!' AS status;
SELECT COUNT(*) AS total_users FROM users;
SELECT email, name, is_super_admin FROM users WHERE is_super_admin = TRUE;
