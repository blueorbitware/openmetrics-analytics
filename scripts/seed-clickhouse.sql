-- Analytics Platform ClickHouse Schema
-- Run this on ClickHouse to set up the events database and table
--
-- Usage (from Lightsail SSH):
--   docker exec -it $(docker ps -qf "name=analytics-clickhouse") clickhouse-client --multiquery < seed-clickhouse.sql
--
-- Or copy-paste the commands into clickhouse-client

CREATE DATABASE IF NOT EXISTS analytics;

-- Main events table - stores all tracked events
-- Must match exactly what the worker inserts and the API queries
CREATE TABLE IF NOT EXISTS analytics.events (
    -- Core identifiers
    workspace_id UUID,
    project_id UUID,
    event_id UUID,

    -- Event metadata
    event_name String,
    event_type String,
    ts DateTime64(3),
    received_at DateTime64(3) DEFAULT now64(3),

    -- User/session identifiers
    anon_id String,
    user_id String DEFAULT '',
    session_id String,
    is_new_session UInt8 DEFAULT 0,

    -- Page data
    url String DEFAULT '',
    path String DEFAULT '',
    referrer String DEFAULT '',
    title String DEFAULT '',
    hash String DEFAULT '',
    search String DEFAULT '',

    -- UTM parameters (stored as a Map for flexibility)
    utm Map(String, String),

    -- Referrer categorization (auto-detected by collector)
    ref_source String DEFAULT '',
    ref_source_category String DEFAULT '',
    ref_medium String DEFAULT '',

    -- Geo/IP data
    ip IPv6,
    country String DEFAULT '',
    region String DEFAULT '',
    city String DEFAULT '',

    -- User agent / device data
    ua_browser String DEFAULT '',
    ua_browser_version String DEFAULT '',
    ua_os String DEFAULT '',
    ua_os_version String DEFAULT '',
    ua_device String DEFAULT '',
    ua_device_type String DEFAULT '',

    -- Client info
    locale String DEFAULT '',
    screen_width UInt16 DEFAULT 0,
    screen_height UInt16 DEFAULT 0,

    -- E-commerce data
    revenue Float64 DEFAULT 0,
    currency String DEFAULT '',
    order_id String DEFAULT '',
    product_id String DEFAULT '',
    product_name String DEFAULT '',
    product_category String DEFAULT '',
    quantity UInt32 DEFAULT 0,

    -- Banner/experiment tracking
    banner_id String DEFAULT '',
    banner_variant String DEFAULT '',

    -- Flexible properties (typed maps for efficient querying)
    props_string Map(String, String),
    props_number Map(String, Float64),
    props_bool Map(String, UInt8),
    user_props Map(String, String),

    -- Web Vitals performance metrics
    lcp Float64 DEFAULT 0,
    fid Float64 DEFAULT 0,
    cls Float64 DEFAULT 0,
    ttfb Float64 DEFAULT 0,
    fcp Float64 DEFAULT 0,

    -- Engagement
    scroll_depth UInt8 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(ts)
ORDER BY (project_id, ts, event_id);
