# OpenMetrics Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![ClickHouse](https://img.shields.io/badge/ClickHouse-powered-yellow)](https://clickhouse.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Built by BlueOrbit](https://img.shields.io/badge/Built%20by-BlueOrbit%20Solutions-0066FF)](https://blueorbitware.com)

> **Open-source, self-hosted web & app analytics platform** — A privacy-focused alternative to Google Analytics, Amplitude, and Mixpanel. Track user behavior, analyze funnels, measure retention, and create targeted campaigns with full data ownership.
>
> **Built with ❤️ by [BlueOrbit Solutions](https://blueorbitware.com)** — Software Development, App Development & AI Automation experts based in Manchester, UK.

<p align="center">
  <img src="docs/assets/dashboard-preview.png" alt="OpenMetrics Dashboard" width="800">
</p>

---

## Why OpenMetrics?

| Feature | Google Analytics | Amplitude | Mixpanel | **OpenMetrics** |
|---------|-----------------|-----------|----------|-----------------|
| **Self-hosted** | ❌ | ❌ | ❌ | ✅ |
| **100% Data Ownership** | ❌ | ❌ | ❌ | ✅ |
| **GDPR Compliant** | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **No Cookie Banners** | ❌ | ❌ | ❌ | ✅ |
| **Unlimited Events** | ❌ | 💰 | 💰 | ✅ |
| **Open Source** | ❌ | ❌ | ❌ | ✅ |
| **White-label Ready** | ❌ | 💰 | 💰 | ✅ |

---

## Features

### Core Analytics
- **Single Script Integration** — One lightweight JavaScript tag tracks everything
- **Automatic Event Tracking** — Page views, clicks, forms, scroll depth, web vitals
- **Real-time Dashboard** — Live event stream and KPI monitoring
- **Session Recording** *(coming soon)* — Replay user sessions to understand behavior

### Advanced Reports
- **Segmentation** — Filter and group users by any property
- **Funnel Analysis** — Track conversion through multi-step flows
- **Retention Cohorts** — Measure user engagement over time
- **User Paths** — Visualize how users navigate your app

### E-commerce Tracking
- **Revenue Analytics** — Track purchases, refunds, and lifetime value
- **Product Performance** — See which products drive conversions
- **Cart Abandonment** — Identify drop-off points in checkout
- **WooCommerce Ready** — WordPress plugin included

### Growth Tools
- **Pop-up/Banner Engine** — Create targeted campaigns without code
- **A/B Testing** — Test variations and measure impact
- **Surveys** — Collect user feedback in-context

### Enterprise Ready
- **Multi-tenant Architecture** — SaaS-ready with workspaces and teams
- **White-label Support** — Custom branding, domains, and themes
- **Full REST API** — Pull any data into external systems
- **Horizontal Scaling** — Handle millions of events per day

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Your Site    │────▶│    Collector    │────▶│     Redis       │
│    (JS Tag)     │     │      (Go)       │     │    Streams      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│    Dashboard    │────▶│      API        │────▶│   ClickHouse    │
│    (Next.js)    │     │      (Go)       │     │    (Events)     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   PostgreSQL    │
                        │   (Metadata)    │
                        └─────────────────┘
```

**Why this stack?**
- **ClickHouse**: Sub-second queries on billions of events
- **Redis Streams**: High-throughput event ingestion (100k+ events/sec)
- **Go**: Low-latency, memory-efficient services
- **Next.js**: Modern, fast dashboard with SSR
- **PostgreSQL**: Reliable storage for users, projects, and settings

---

## Database Architecture

### ClickHouse (Analytics Database)

ClickHouse stores all event data and powers the analytics queries. It's optimized for:
- **High-volume writes**: Handles millions of events per day
- **Fast aggregations**: Complex queries return in milliseconds
- **Columnar storage**: Efficient compression (10-20x)

**Main Tables:**

| Table | Purpose | Data Retention |
|-------|---------|----------------|
| `events` | All tracked events (page views, clicks, custom) | Configurable |
| `sessions` | User session data | 90 days default |
| `daily_stats` | Pre-aggregated daily metrics | Indefinite |

**Key Schema (events table):**
```sql
CREATE TABLE events (
    project_id      UUID,
    event_name      String,
    distinct_id     String,
    timestamp       DateTime64(3),
    properties      String,  -- JSON
    session_id      String,
    page_url        String,
    referrer        String,
    utm_source      String,
    utm_medium      String,
    utm_campaign    String,
    country         LowCardinality(String),
    device_type     LowCardinality(String),
    browser         LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, event_name, timestamp)
```

### PostgreSQL (Application Database)

PostgreSQL stores application metadata and user management:

**Core Tables:**

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `workspaces` | Multi-tenant workspace containers |
| `projects` | Analytics projects with API keys |
| `team_members` | Workspace membership and roles |
| `dashboards` | Custom dashboard configurations |
| `funnels` | Saved funnel definitions |
| `api_tokens` | API access tokens |

**Relationships:**
```
workspaces (1) ──▶ (N) projects
workspaces (1) ──▶ (N) team_members ◀── (1) users
projects   (1) ──▶ (N) dashboards
projects   (1) ──▶ (N) funnels
```

### Redis (Event Streaming & Cache)

Redis serves two critical functions:

**1. Event Streaming (Redis Streams)**
- Collector service pushes events to Redis Streams
- Worker service consumes and batches events
- Ensures no data loss during high-traffic spikes

```
Collector → XADD events:stream → Worker → ClickHouse
```

**2. Caching Layer**
- Session data for real-time visitor counts
- Rate limiting counters
- Temporary authentication tokens

**Key Patterns:**

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `events:stream` | Event ingestion queue | N/A |
| `session:{id}` | Active session data | 30 min |
| `rate:{ip}` | Rate limit counter | 1 min |
| `cache:report:{hash}` | Cached query results | 5 min |

### Database Sizing Recommendations

| Traffic Level | ClickHouse | PostgreSQL | Redis |
|--------------|------------|------------|-------|
| < 1M events/mo | 20GB SSD | 5GB | 1GB |
| 1-10M events/mo | 100GB SSD | 10GB | 2GB |
| 10-100M events/mo | 500GB SSD | 20GB | 4GB |
| > 100M events/mo | 1TB+ NVMe | 50GB | 8GB+ |

### Data Flow

```
1. Browser sends event → Collector (validates & enriches)
2. Collector → Redis Stream (XADD, <1ms)
3. Worker reads batch → ClickHouse (INSERT, every 2s)
4. Dashboard → API → ClickHouse (SELECT, <200ms)
5. API reads metadata → PostgreSQL (users, projects)
```

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/blueorbitware/openmetrics-analytics.git
cd openmetrics-analytics

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Start all services
cd deploy
docker compose up -d

# Access the dashboard
open http://localhost:3000
```

### Option 2: Development Setup

**Prerequisites:**
- Go 1.22+
- Node.js 20+
- pnpm
- Docker (for databases)

```bash
# Start infrastructure
cd deploy
docker compose up -d clickhouse postgres redis

# Run services (in separate terminals)
cd services/api && go run cmd/main.go
cd services/collector && go run cmd/main.go
cd services/worker && go run cmd/main.go

# Run dashboard
cd apps/dashboard
pnpm install
pnpm dev
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Analytics dashboard |
| API | http://localhost:8080 | REST API |
| Collector | http://localhost:8081 | Event ingestion |

---

## Integration

### Basic Setup (Any Website)

Add this single script to your website:

```html
<script src="https://your-domain.com/t.js?k=pk_live_xxx" async></script>
```

The script automatically tracks:
- ✅ Page views
- ✅ Click events
- ✅ Form submissions
- ✅ Scroll depth
- ✅ Web vitals (LCP, FID, CLS)
- ✅ Session duration
- ✅ Referrer & UTM parameters

### Custom Event Tracking

```javascript
// Track custom events
analytics.track('button_clicked', { 
  button_id: 'cta-hero',
  variant: 'blue' 
});

// Identify users
analytics.identify('user-123', { 
  email: 'user@example.com',
  plan: 'pro',
  company: 'Acme Inc' 
});

// E-commerce: Purchase
analytics.ecommerce.purchase({
  order_id: 'order-456',
  revenue: 99.99,
  currency: 'USD',
  items: [
    { id: 'sku-1', name: 'Widget', price: 49.99, quantity: 2 }
  ]
});
```

### Framework Integrations

| Framework | Integration |
|-----------|-------------|
| React / Next.js | Add script tag to `_app.tsx` or `layout.tsx` |
| Vue / Nuxt | Add script tag to `nuxt.config.ts` or `App.vue` |
| WordPress | See WordPress section in [API Documentation](docs/API.md) |
| WooCommerce | See WooCommerce section in [API Documentation](docs/API.md) |
| Shopify | Add script tag to `theme.liquid` |

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database connections
DATABASE_URL=postgres://user:pass@localhost:5432/analytics
CLICKHOUSE_DSN=clickhouse://user:pass@localhost:9000/analytics
REDIS_URL=redis://localhost:6379/0

# Security (REQUIRED - generate with: openssl rand -hex 32)
JWT_SECRET=your-secure-random-string-minimum-32-characters

# Service ports
PORT=8080
COLLECTOR_PORT=8081

# CORS (your dashboard domain)
CORS_ORIGINS=https://analytics.yourdomain.com

# Dashboard configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_COLLECTOR_URL=https://collect.yourdomain.com
```

### Production Deployment

See [DEPLOY.md](DEPLOY.md) for complete deployment guides:
- Single server with Docker
- Kubernetes with Helm
- High-availability setup

---

## Project Structure

```
├── apps/
│   ├── tracker/           # JavaScript SDK (~5KB gzipped)
│   └── dashboard/         # Next.js admin dashboard
├── services/
│   ├── api/               # Go REST API (admin, reports, auth)
│   ├── collector/         # Go event ingestion (high-throughput)
│   └── worker/            # Go batch processor (Redis → ClickHouse)
├── packages/
│   └── gocommon/          # Shared Go code (auth, DB, utilities)
├── deploy/
│   ├── docker-compose.yml # Full stack deployment
│   ├── clickhouse/        # ClickHouse schemas & init
│   ├── postgres/          # PostgreSQL migrations
│   └── k8s/               # Kubernetes Helm charts
├── docs/
│   ├── API.md             # REST API reference
│   └── integrations/      # Platform-specific guides
└── scripts/               # Utility scripts
```

---

## API Documentation

Full API documentation available at [docs/API.md](docs/API.md).

### Quick Examples

```bash
# Login and get token
curl -X POST https://api.yourdomain.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'

# Get analytics summary
curl https://api.yourdomain.com/v1/reports/summary?start=2024-01-01&end=2024-01-31 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID"

# Query events
curl -X POST https://api.yourdomain.com/v1/reports/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"event": "page_view", "start": "2024-01-01", "end": "2024-01-31"}'
```

---

## Performance

Benchmarks on a $40/month server (4 CPU, 8GB RAM):

| Metric | Performance |
|--------|-------------|
| Event ingestion | 50,000+ events/sec |
| Dashboard queries | < 200ms p95 |
| JS tracker size | ~5KB gzipped |
| Memory per service | ~50MB |

---

## Roadmap

- [x] Core event tracking
- [x] Real-time dashboard
- [x] Funnel analysis
- [x] Retention cohorts
- [x] Multi-tenant workspaces
- [ ] Session replay
- [ ] Heatmaps
- [ ] A/B testing framework
- [ ] Mobile SDK (iOS/Android)
- [ ] Data export (CSV, BigQuery)

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork the repo, then:
git clone https://github.com/YOUR_USERNAME/openmetrics-analytics.git
cd openmetrics-analytics
make dev  # Start development environment
```

### Development Commands

```bash
make dev          # Start all services in development mode
make test         # Run all tests
make lint         # Run linters
make build        # Build production binaries
```

---

## Security

Found a security vulnerability? Please report it responsibly.

See [SECURITY.md](SECURITY.md) for our security policy and disclosure process.

**Do NOT open public issues for security vulnerabilities.**

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/blueorbitware/openmetrics-analytics/issues)
- **Discussions**: [GitHub Discussions](https://github.com/blueorbitware/openmetrics-analytics/discussions)

---

## Acknowledgments

Built with amazing open-source technologies:
- [ClickHouse](https://clickhouse.com) — Lightning-fast analytics database
- [Go](https://golang.org) — Efficient, reliable backend services
- [Next.js](https://nextjs.org) — Modern React framework
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS
- [PostgreSQL](https://postgresql.org) — Rock-solid relational database
- [Redis](https://redis.io) — In-memory data store

---

---

## About the Creators

<p align="center">
  <a href="https://blueorbitware.com">
    <img src="https://img.shields.io/badge/Built%20by-BlueOrbit%20Solutions-0066FF?style=for-the-badge" alt="Built by BlueOrbit Solutions">
  </a>
</p>

**[BlueOrbit Solutions](https://blueorbitware.com)** is a UK-based software development company specializing in:

- **Custom Web Applications** — React, Node.js, Laravel
- **Mobile App Development** — iOS, Android, React Native, Flutter
- **AI & Automation** — Process automation, chatbots, machine learning
- **Cloud Solutions** — AWS, Azure, GCP, Kubernetes

📍 **Manchester, UK** | 📧 support@blueorbitware.com | 🌐 [blueorbitware.com](https://blueorbitware.com)

**Need a custom analytics solution or enterprise features?** [Contact us](https://blueorbitware.com/#contact) for professional services and support.

---

<p align="center">
  <strong>⭐ Star this repo if you find it useful!</strong>
</p>

