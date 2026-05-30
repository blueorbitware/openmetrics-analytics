#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Analytics Platform - Dev Startup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start infrastructure
echo -e "${YELLOW}Starting infrastructure...${NC}"
cd deploy
docker compose up -d clickhouse postgres redis
cd ..

# Wait for services
echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
sleep 5

# Check if databases are healthy
echo -e "${YELLOW}Checking database connections...${NC}"

# PostgreSQL check
until docker exec analytics-postgres pg_isready -U analytics > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Redis check
until docker exec analytics-redis redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done
echo -e "${GREEN}✓ Redis is ready${NC}"

# ClickHouse check
until docker exec analytics-clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do
    echo "Waiting for ClickHouse..."
    sleep 2
done
echo -e "${GREEN}✓ ClickHouse is ready${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Infrastructure is ready!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Services:"
echo "  PostgreSQL: localhost:5432"
echo "  ClickHouse: localhost:8123 (HTTP) / localhost:9000 (Native)"
echo "  Redis:      localhost:6379"
echo ""
echo "Demo credentials (PostgreSQL):"
echo "  User: analytics"
echo "  Password: analytics_secret"
echo "  Database: analytics"
echo ""
echo -e "${YELLOW}Now start the services in separate terminals:${NC}"
echo ""
echo "  Terminal 1: make api        # API on :8080"
echo "  Terminal 2: make collector  # Collector on :8081"
echo "  Terminal 3: make worker     # Worker (background)"
echo "  Terminal 4: make dashboard  # Dashboard on :3000"
echo ""
echo "Or use the test script after services are running:"
echo "  ./scripts/test-local.sh"
