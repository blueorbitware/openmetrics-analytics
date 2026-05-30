#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:8080"
COLLECTOR_URL="http://localhost:8081"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Analytics Platform - Local Tests${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -n "Testing $name... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" 2>/dev/null)
    fi
    
    status=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status)"
        echo "  Response: $body"
        return 1
    fi
}

# Test infrastructure
echo -e "${YELLOW}1. Testing Infrastructure${NC}"
echo "----------------------------"

echo -n "PostgreSQL... "
if docker exec analytics-postgres pg_isready -U analytics > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ NOT RUNNING${NC}"
    exit 1
fi

echo -n "Redis... "
if docker exec analytics-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ NOT RUNNING${NC}"
    exit 1
fi

echo -n "ClickHouse... "
if docker exec analytics-clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ NOT RUNNING${NC}"
    exit 1
fi

echo ""

# Test API service
echo -e "${YELLOW}2. Testing API Service${NC}"
echo "----------------------------"

test_endpoint "API Health" "$API_URL/health"

# Register a test user
echo ""
echo -e "${YELLOW}3. Testing Authentication${NC}"
echo "----------------------------"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpassword123","name":"Test User"}' 2>/dev/null)

if echo "$REGISTER_RESPONSE" | grep -q "access_token"; then
    echo -e "Register new user... ${GREEN}✓ PASS${NC}"
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
elif echo "$REGISTER_RESPONSE" | grep -q "already registered"; then
    echo -e "Register (user exists)... ${YELLOW}⚠ SKIP${NC} (user already exists, trying login)"
    
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"testpassword123"}' 2>/dev/null)
    
    if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
        echo -e "Login... ${GREEN}✓ PASS${NC}"
        ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    else
        echo -e "Login... ${RED}✗ FAIL${NC}"
        echo "Response: $LOGIN_RESPONSE"
        exit 1
    fi
else
    echo -e "Register... ${RED}✗ FAIL${NC}"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

echo ""
echo -e "${YELLOW}4. Testing Workspaces${NC}"
echo "----------------------------"

WORKSPACES=$(curl -s -X GET "$API_URL/v1/workspaces" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null)

if echo "$WORKSPACES" | grep -q '"id"'; then
    echo -e "List workspaces... ${GREEN}✓ PASS${NC}"
    WORKSPACE_ID=$(echo "$WORKSPACES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  Workspace ID: $WORKSPACE_ID"
else
    echo -e "List workspaces... ${RED}✗ FAIL${NC}"
    echo "Response: $WORKSPACES"
fi

echo ""
echo -e "${YELLOW}5. Testing Projects${NC}"
echo "----------------------------"

PROJECTS=$(curl -s -X GET "$API_URL/v1/projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "X-Workspace-ID: $WORKSPACE_ID" 2>/dev/null)

if echo "$PROJECTS" | grep -q '\['; then
    echo -e "List projects... ${GREEN}✓ PASS${NC}"
    
    if echo "$PROJECTS" | grep -q '"public_key"'; then
        PUBLIC_KEY=$(echo "$PROJECTS" | grep -o '"public_key":"[^"]*"' | head -1 | cut -d'"' -f4)
        PROJECT_ID=$(echo "$PROJECTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "  Project ID: $PROJECT_ID"
        echo "  Public Key: $PUBLIC_KEY"
    fi
else
    echo -e "List projects... ${RED}✗ FAIL${NC}"
fi

# Test collector
echo ""
echo -e "${YELLOW}6. Testing Collector Service${NC}"
echo "----------------------------"

test_endpoint "Collector Health" "$COLLECTOR_URL/health"

if [ -n "$PUBLIC_KEY" ]; then
    # Send test events
    EVENTS_PAYLOAD=$(cat <<EOF
{
    "k": "$PUBLIC_KEY",
    "events": [
        {
            "event": "page_view",
            "type": "page",
            "ts": $(date +%s000),
            "anon_id": "test_anon_$(date +%s)",
            "session_id": "test_session_$(date +%s)",
            "is_new_session": true,
            "url": "http://localhost:8082/",
            "path": "/",
            "referrer": "",
            "title": "Test Page",
            "locale": "en-US",
            "screen_width": 1920,
            "screen_height": 1080
        },
        {
            "event": "button_click",
            "type": "custom",
            "ts": $(date +%s000),
            "anon_id": "test_anon_$(date +%s)",
            "session_id": "test_session_$(date +%s)",
            "is_new_session": false,
            "url": "http://localhost:8082/",
            "path": "/",
            "props": {"button_id": "cta-1", "button_text": "Sign Up"}
        }
    ]
}
EOF
)
    
    test_endpoint "Collect events" "$COLLECTOR_URL/v1/collect" "POST" "$EVENTS_PAYLOAD" "204"
fi

# Test config endpoint
echo ""
echo -e "${YELLOW}7. Testing Config Endpoint${NC}"
echo "----------------------------"

if [ -n "$PUBLIC_KEY" ]; then
    test_endpoint "Get project config" "$API_URL/v1/config/$PUBLIC_KEY"
else
    echo -e "Skipping config test (no public key)${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Services tested:"
echo "  ✓ PostgreSQL"
echo "  ✓ Redis"  
echo "  ✓ ClickHouse"
echo "  ✓ API Service"
echo "  ✓ Collector Service"
echo ""
echo "Access the dashboard at: http://localhost:3000"
echo ""
echo "Test credentials:"
echo "  Email: test@example.com"
echo "  Password: testpassword123"
echo ""
if [ -n "$PUBLIC_KEY" ]; then
    echo "Tracking snippet:"
    echo "  <script async src=\"$COLLECTOR_URL/t.js?k=$PUBLIC_KEY\"></script>"
fi
