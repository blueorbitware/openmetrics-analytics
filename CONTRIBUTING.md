# Contributing to OpenMetrics Analytics

Thank you for your interest in contributing! This document provides guidelines and information about contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Go 1.22+** — [Download](https://golang.org/dl/)
- **Node.js 20+** — [Download](https://nodejs.org/)
- **pnpm** — `npm install -g pnpm`
- **Docker & Docker Compose** — [Download](https://docker.com)
- **Make** — Usually pre-installed on macOS/Linux

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/openmetrics-analytics.git
cd openmetrics-analytics

# Add upstream remote
git remote add upstream https://github.com/blueorbitware/openmetrics-analytics.git
```

---

## Development Setup

### 1. Start Infrastructure

```bash
cd deploy
docker compose up -d clickhouse postgres redis
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 3. Start Services

**Option A: Using Make (Recommended)**
```bash
make dev
```

**Option B: Manual**
```bash
# Terminal 1: API
cd services/api && go run cmd/main.go

# Terminal 2: Collector
cd services/collector && go run cmd/main.go

# Terminal 3: Worker
cd services/worker && go run cmd/main.go

# Terminal 4: Dashboard
cd apps/dashboard && pnpm install && pnpm dev
```

### 4. Verify Setup

- Dashboard: http://localhost:3000
- API: http://localhost:8080/health
- Collector: http://localhost:8081/health

---

## Making Changes

### Branch Naming

Use descriptive branch names:

```
feature/add-session-replay
fix/dashboard-timezone-bug
docs/update-api-reference
refactor/optimize-clickhouse-queries
```

### Commit Messages

Follow conventional commits format:

```
type(scope): short description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(collector): add batch event processing

fix(dashboard): correct timezone display in reports

docs(api): add authentication examples

refactor(worker): optimize ClickHouse batch inserts
```

### Keep Changes Focused

- One feature/fix per pull request
- Keep PRs small and reviewable (< 500 lines when possible)
- Split large changes into multiple PRs

---

## Pull Request Process

### 1. Sync with Upstream

```bash
git fetch upstream
git checkout main
git merge upstream/main
git checkout -b your-feature-branch
```

### 2. Make Your Changes

```bash
# Make changes
git add .
git commit -m "feat(scope): description"
```

### 3. Run Tests and Linting

```bash
make test
make lint
```

### 4. Push and Create PR

```bash
git push origin your-feature-branch
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what and why
- Screenshots for UI changes
- Link to related issues

### 5. PR Review

- Address reviewer feedback promptly
- Keep the PR updated with main branch
- Be patient — reviews may take time

---

## Coding Standards

### Go Code

- Follow [Effective Go](https://golang.org/doc/effective_go.html)
- Use `gofmt` for formatting
- Use `golint` and `go vet`
- Write godoc comments for exported functions

```go
// ProcessEvent handles incoming analytics events.
// It validates the event data and queues it for processing.
func ProcessEvent(ctx context.Context, event *Event) error {
    // implementation
}
```

### TypeScript/JavaScript

- Use TypeScript for new code
- Follow existing code style
- Use ESLint and Prettier

```typescript
// Use explicit types
interface EventData {
  name: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

// Prefer async/await over .then()
async function trackEvent(data: EventData): Promise<void> {
  await collector.send(data);
}
```

### SQL (ClickHouse)

- Use uppercase for SQL keywords
- Use meaningful table and column names
- Add comments for complex queries

```sql
-- Get daily active users for the last 30 days
SELECT
    toDate(timestamp) AS date,
    uniqExact(distinct_id) AS daily_users
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date DESC
```

---

## Testing

### Running Tests

```bash
# All tests
make test

# Go tests only
cd services/api && go test ./...

# Dashboard tests
cd apps/dashboard && pnpm test

# With coverage
make test-coverage
```

### Writing Tests

**Go Tests:**
```go
func TestProcessEvent(t *testing.T) {
    event := &Event{
        Name: "page_view",
        Properties: map[string]interface{}{"page": "/home"},
    }
    
    err := ProcessEvent(context.Background(), event)
    
    if err != nil {
        t.Errorf("unexpected error: %v", err)
    }
}
```

**React Component Tests:**
```typescript
import { render, screen } from '@testing-library/react';
import { EventsTable } from './EventsTable';

describe('EventsTable', () => {
  it('displays events correctly', () => {
    const events = [{ name: 'page_view', count: 100 }];
    render(<EventsTable events={events} />);
    
    expect(screen.getByText('page_view')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
```

---

## Documentation

### When to Update Docs

- Adding new features
- Changing API endpoints
- Modifying configuration options
- Adding new integrations

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and quick start |
| `DEPLOY.md` | Deployment guides |
| `docs/API.md` | API reference |
| `docs/integrations/` | Platform-specific guides |

### API Documentation

When adding/modifying API endpoints, update `docs/API.md`:

```markdown
### POST /v1/events

Track a custom event.

**Request:**
\`\`\`json
{
  "name": "button_click",
  "properties": { "button_id": "cta" }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`
```

---

## Project Structure Overview

```
├── apps/
│   ├── tracker/        # JS tracking SDK
│   └── dashboard/      # Next.js frontend
├── services/
│   ├── api/            # Main API service
│   ├── collector/      # Event ingestion
│   └── worker/         # Background processing
├── packages/
│   └── gocommon/       # Shared Go code
├── deploy/             # Deployment configs
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

---

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/blueorbitware/openmetrics-analytics/discussions)
- **Found a bug?** Open an [Issue](https://github.com/blueorbitware/openmetrics-analytics/issues)
- **Security issue?** See [SECURITY.md](SECURITY.md)

---

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- README acknowledgments for major features

Thank you for contributing to OpenMetrics Analytics! 🎉

---

**OpenMetrics Analytics** is built and maintained by [BlueOrbit Solutions](https://blueorbitware.com) — Software Development, App Development & AI Automation experts based in Manchester, UK.
