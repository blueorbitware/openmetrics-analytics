-- Analytics Platform ClickHouse Schema
-- This file runs on container startup

-- Main events table - wide table with all event data
CREATE TABLE IF NOT EXISTS events
(
    workspace_id   UUID,
    project_id     UUID,
    event_id       UUID DEFAULT generateUUIDv4(),
    event_name     LowCardinality(String),
    event_type     LowCardinality(String),     -- page, click, ecommerce, auth, custom, banner
    ts             DateTime64(3) CODEC(DoubleDelta, LZ4),
    received_at    DateTime64(3) CODEC(DoubleDelta, LZ4),

    -- Identity
    anon_id        String,
    user_id        Nullable(String),
    session_id     String,
    is_new_session UInt8 DEFAULT 0,

    -- Page context
    url            String,
    path           String,
    referrer       String,
    title          String,
    hash           String DEFAULT '',
    search         String DEFAULT '',

    -- UTM parameters + arbitrary link params
    utm            Map(LowCardinality(String), String),

    -- Traffic source (enriched server-side from referrer + UTM)
    ref_source          LowCardinality(String) DEFAULT '',
    ref_source_category LowCardinality(String) DEFAULT '',
    ref_medium          LowCardinality(String) DEFAULT '',

    -- Device / Geo (enriched server-side)
    ip             IPv6,
    country        LowCardinality(String) DEFAULT '',
    region         LowCardinality(String) DEFAULT '',
    city           String DEFAULT '',
    ua_browser     LowCardinality(String) DEFAULT '',
    ua_browser_version LowCardinality(String) DEFAULT '',
    ua_os          LowCardinality(String) DEFAULT '',
    ua_os_version  LowCardinality(String) DEFAULT '',
    ua_device      LowCardinality(String) DEFAULT '',
    ua_device_type LowCardinality(String) DEFAULT '',
    locale         LowCardinality(String) DEFAULT '',
    screen_width   UInt16 DEFAULT 0,
    screen_height  UInt16 DEFAULT 0,

    -- E-commerce semantic columns
    revenue        Nullable(Decimal(18,4)),
    currency       LowCardinality(String) DEFAULT '',
    order_id       Nullable(String),
    product_id     Nullable(String),
    product_name   Nullable(String),
    product_category Nullable(String),
    quantity       Nullable(UInt32),

    -- Banner/campaign tracking
    banner_id      Nullable(String),
    banner_variant Nullable(String),

    -- Arbitrary unlimited properties
    props_string   Map(LowCardinality(String), String),
    props_number   Map(LowCardinality(String), Float64),
    props_bool     Map(LowCardinality(String), UInt8),

    -- User properties snapshot
    user_props     Map(LowCardinality(String), String),

    -- Web vitals
    lcp            Nullable(Float64),
    fid            Nullable(Float64),
    cls            Nullable(Float64),
    ttfb           Nullable(Float64),
    fcp            Nullable(Float64),

    -- Scroll depth
    scroll_depth   Nullable(UInt8)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (workspace_id, project_id, event_name, ts, anon_id)
TTL toDateTime(ts) + INTERVAL 25 MONTH
SETTINGS index_granularity = 8192;

-- Projection for user-centric queries (funnels, retention, paths)
ALTER TABLE events ADD PROJECTION IF NOT EXISTS events_by_user (
    SELECT *
    ORDER BY (workspace_id, project_id, anon_id, ts)
);

-- Projection for session analysis
ALTER TABLE events ADD PROJECTION IF NOT EXISTS events_by_session (
    SELECT *
    ORDER BY (workspace_id, project_id, session_id, ts)
);

-- Materialize projections
ALTER TABLE events MATERIALIZE PROJECTION events_by_user;
ALTER TABLE events MATERIALIZE PROJECTION events_by_session;

-- Sessions aggregation table (materialized view target)
CREATE TABLE IF NOT EXISTS sessions
(
    workspace_id    UUID,
    project_id      UUID,
    session_id      String,
    anon_id         String,
    user_id         Nullable(String),
    
    started_at      DateTime64(3),
    ended_at        DateTime64(3),
    duration_seconds UInt32,
    
    entry_url       String,
    entry_path      String,
    exit_url        String,
    exit_path       String,
    
    page_views      UInt32,
    events_count    UInt32,
    is_bounce       UInt8,
    
    referrer        String,
    utm             Map(LowCardinality(String), String),
    
    country         LowCardinality(String),
    region          LowCardinality(String),
    city            String,
    ua_browser      LowCardinality(String),
    ua_os           LowCardinality(String),
    ua_device_type  LowCardinality(String),
    
    revenue         Decimal(18,4) DEFAULT 0,
    has_purchase    UInt8 DEFAULT 0,
    
    version         UInt64
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(started_at)
ORDER BY (workspace_id, project_id, session_id)
TTL toDateTime(started_at) + INTERVAL 25 MONTH;

-- Materialized view to populate sessions table
CREATE MATERIALIZED VIEW IF NOT EXISTS sessions_mv TO sessions AS
SELECT
    workspace_id,
    project_id,
    session_id,
    any(anon_id) AS anon_id,
    anyIf(user_id, user_id IS NOT NULL) AS user_id,
    
    min(ts) AS started_at,
    max(ts) AS ended_at,
    dateDiff('second', min(ts), max(ts)) AS duration_seconds,
    
    argMin(url, ts) AS entry_url,
    argMin(path, ts) AS entry_path,
    argMax(url, ts) AS exit_url,
    argMax(path, ts) AS exit_path,
    
    countIf(event_name = 'page_view') AS page_views,
    count() AS events_count,
    if(countIf(event_name = 'page_view') <= 1 AND dateDiff('second', min(ts), max(ts)) < 10, 1, 0) AS is_bounce,
    
    argMin(referrer, ts) AS referrer,
    argMin(utm, ts) AS utm,
    
    any(country) AS country,
    any(region) AS region,
    any(city) AS city,
    any(ua_browser) AS ua_browser,
    any(ua_os) AS ua_os,
    any(ua_device_type) AS ua_device_type,
    
    toDecimal64(sumIf(ifNull(revenue, 0), revenue IS NOT NULL), 4) AS revenue,
    toUInt8(if(countIf(event_name = 'purchase') > 0, 1, 0)) AS has_purchase,
    
    toUnixTimestamp64Milli(now64(3)) AS version
FROM events
GROUP BY workspace_id, project_id, session_id;

-- Users state table (latest state per user)
CREATE TABLE IF NOT EXISTS users_state
(
    workspace_id    UUID,
    project_id      UUID,
    anon_id         String,
    user_id         Nullable(String),
    
    first_seen      DateTime64(3),
    last_seen       DateTime64(3),
    
    total_sessions  UInt32,
    total_events    UInt64,
    total_page_views UInt64,
    total_revenue   Decimal(18,4),
    
    first_referrer  String,
    first_utm       Map(LowCardinality(String), String),
    
    last_country    LowCardinality(String),
    last_city       String,
    last_browser    LowCardinality(String),
    last_os         LowCardinality(String),
    last_device     LowCardinality(String),
    
    user_props      Map(LowCardinality(String), String),
    
    version         UInt64
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(first_seen)
ORDER BY (workspace_id, project_id, anon_id)
TTL toDateTime(first_seen) + INTERVAL 25 MONTH;

-- Daily metrics aggregation table
CREATE TABLE IF NOT EXISTS daily_metrics
(
    workspace_id    UUID,
    project_id      UUID,
    date            Date,
    
    -- Core metrics
    unique_users    AggregateFunction(uniq, String),
    sessions        AggregateFunction(uniq, String),
    page_views      AggregateFunction(sum, UInt64),
    events          AggregateFunction(sum, UInt64),
    
    -- Engagement
    avg_session_duration AggregateFunction(avg, Float64),
    bounce_rate     AggregateFunction(avg, Float64),
    
    -- Revenue
    total_revenue   AggregateFunction(sum, Decimal(18,4)),
    transactions    AggregateFunction(sum, UInt64),
    
    -- Top events
    event_counts    AggregateFunction(sumMap, Map(LowCardinality(String), UInt64)),
    
    -- Top pages
    page_counts     AggregateFunction(sumMap, Map(String, UInt64))
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (workspace_id, project_id, date)
TTL date + INTERVAL 25 MONTH;

-- Materialized view for daily metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics_mv TO daily_metrics AS
SELECT
    workspace_id,
    project_id,
    toDate(ts) AS date,
    
    uniqState(anon_id) AS unique_users,
    uniqState(session_id) AS sessions,
    sumState(toUInt64(if(event_name = 'page_view', 1, 0))) AS page_views,
    sumState(toUInt64(1)) AS events,
    
    avgState(0.0) AS avg_session_duration,
    avgState(0.0) AS bounce_rate,
    
    sumState(ifNull(revenue, toDecimal64(0, 4))) AS total_revenue,
    sumState(toUInt64(if(event_name = 'purchase', 1, 0))) AS transactions,
    
    sumMapState(map(event_name, toUInt64(1))) AS event_counts,
    sumMapState(map(path, toUInt64(if(event_name = 'page_view', 1, 0)))) AS page_counts
FROM events
GROUP BY workspace_id, project_id, date;

-- Event counts by name for quick lookups
CREATE TABLE IF NOT EXISTS event_definitions
(
    workspace_id    UUID,
    project_id      UUID,
    event_name      String,
    event_type      LowCardinality(String),
    first_seen      DateTime64(3),
    last_seen       DateTime64(3),
    total_count     UInt64,
    sample_props    Array(String)
)
ENGINE = ReplacingMergeTree(total_count)
ORDER BY (workspace_id, project_id, event_name);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id) TYPE bloom_filter GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_events_path ON events (path) TYPE bloom_filter GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_events_country ON events (country) TYPE set(100) GRANULARITY 4;

-- Sample data for testing
INSERT INTO events (workspace_id, project_id, event_name, event_type, ts, received_at, anon_id, session_id, url, path, title, referrer, country, ua_browser, ua_os, ua_device_type) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'page_view', 'page', now64(3), now64(3), 'anon_test_1', 'sess_test_1', 'http://localhost:8082/', '/', 'Demo Site', '', 'US', 'Chrome', 'macOS', 'desktop');

INSERT INTO events (workspace_id, project_id, event_name, event_type, ts, received_at, anon_id, session_id, url, path, title, referrer, country, ua_browser, ua_os, ua_device_type) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'page_view', 'page', now64(3) + 5000, now64(3) + 5000, 'anon_test_1', 'sess_test_1', 'http://localhost:8082/products', '/products', 'Products - Demo Site', 'http://localhost:8082/', 'US', 'Chrome', 'macOS', 'desktop');
