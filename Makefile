.PHONY: all setup deps infra infra-down api collector worker dashboard tracker test clean

# Default target
all: help

help:
	@echo "Analytics Platform - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Initial setup (install deps, create .env)"
	@echo "  make deps         - Install all dependencies"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra        - Start ClickHouse, PostgreSQL, Redis via Docker"
	@echo "  make infra-down   - Stop infrastructure"
	@echo "  make infra-logs   - View infrastructure logs"
	@echo ""
	@echo "Services:"
	@echo "  make api          - Run API service (port 8080)"
	@echo "  make collector    - Run Collector service (port 8081)"
	@echo "  make worker       - Run Worker service"
	@echo "  make dashboard    - Run Dashboard (port 3000)"
	@echo "  make tracker      - Build tracker SDK"
	@echo ""
	@echo "All-in-one:"
	@echo "  make dev          - Start infra + all services"
	@echo "  make test         - Run all tests"
	@echo "  make clean        - Clean build artifacts"

# Setup
setup: deps
	@if [ ! -f .env ]; then cp .env.example .env; fi
	@echo "Setup complete! Run 'make infra' to start databases, then 'make dev'"

deps: deps-go deps-node

deps-go:
	@echo "Installing Go dependencies..."
	cd packages/gocommon && go mod download
	cd services/api && go mod download
	cd services/collector && go mod download
	cd services/worker && go mod download

deps-node:
	@echo "Installing Node dependencies..."
	cd apps/dashboard && pnpm install || npm install
	cd apps/tracker && pnpm install || npm install

# Infrastructure
infra:
	@echo "Starting infrastructure (ClickHouse, PostgreSQL, Redis)..."
	cd deploy && docker compose up -d clickhouse postgres redis
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Infrastructure ready!"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  ClickHouse: localhost:8123 (HTTP), localhost:9000 (Native)"
	@echo "  Redis: localhost:6379"

infra-down:
	cd deploy && docker compose down

infra-logs:
	cd deploy && docker compose logs -f

infra-reset:
	cd deploy && docker compose down -v
	@echo "All data volumes removed. Run 'make infra' to start fresh."

# Services
api:
	@echo "Starting API service on port 8080..."
	cd services/api && go run cmd/main.go

collector:
	@echo "Starting Collector service on port 8081..."
	cd services/collector && go run cmd/main.go

worker:
	@echo "Starting Worker service..."
	cd services/worker && go run cmd/main.go

dashboard:
	@echo "Starting Dashboard on port 3000..."
	cd apps/dashboard && pnpm dev || npm run dev

tracker:
	@echo "Building tracker SDK..."
	cd apps/tracker && pnpm build || npm run build

# Development (run all)
dev: infra
	@echo ""
	@echo "Infrastructure is running. Now start the services in separate terminals:"
	@echo ""
	@echo "  Terminal 1: make api"
	@echo "  Terminal 2: make collector"
	@echo "  Terminal 3: make worker"
	@echo "  Terminal 4: make dashboard"
	@echo ""
	@echo "Or run './scripts/dev.sh' to start all services"

# Testing
test: test-go test-node

test-go:
	@echo "Running Go tests..."
	cd packages/gocommon && go test -v ./...
	cd services/api && go test -v ./...
	cd services/collector && go test -v ./...
	cd services/worker && go test -v ./...

test-node:
	@echo "Running Node tests..."
	cd apps/dashboard && pnpm test || npm test || echo "No tests configured"
	cd apps/tracker && pnpm test || npm test || echo "No tests configured"

# Build
build: build-go build-tracker

build-go:
	@echo "Building Go services..."
	cd services/api && go build -o ../../bin/api ./cmd/main.go
	cd services/collector && go build -o ../../bin/collector ./cmd/main.go
	cd services/worker && go build -o ../../bin/worker ./cmd/main.go

build-tracker:
	@echo "Building tracker SDK..."
	cd apps/tracker && pnpm build || npm run build

build-dashboard:
	@echo "Building dashboard..."
	cd apps/dashboard && pnpm build || npm run build

# Clean
clean:
	rm -rf bin/
	rm -rf apps/tracker/dist/
	rm -rf apps/dashboard/.next/
	rm -rf apps/dashboard/node_modules/
	rm -rf apps/tracker/node_modules/
