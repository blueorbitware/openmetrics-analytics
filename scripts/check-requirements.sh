#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Analytics Platform - Requirements Check"
echo "========================================"
echo ""

MISSING=0

# Check Docker
echo -n "Docker:     "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ $(docker --version)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "  Install: https://docs.docker.com/get-docker/"
    MISSING=$((MISSING + 1))
fi

# Check Docker Compose
echo -n "Compose:    "
if docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓ $(docker compose version --short)${NC}"
elif command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ $(docker-compose --version)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "  Install: https://docs.docker.com/compose/install/"
    MISSING=$((MISSING + 1))
fi

# Check Go
echo -n "Go:         "
if command -v go &> /dev/null; then
    echo -e "${GREEN}✓ $(go version)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "  Install: https://go.dev/doc/install"
    echo "  macOS:   brew install go"
    MISSING=$((MISSING + 1))
fi

# Check Node.js
echo -n "Node.js:    "
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ $(node --version)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "  Install: https://nodejs.org/"
    MISSING=$((MISSING + 1))
fi

# Check npm or pnpm
echo -n "Package Mgr:"
if command -v pnpm &> /dev/null; then
    echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"
elif command -v npm &> /dev/null; then
    echo -e "${GREEN}✓ npm $(npm --version)${NC}"
else
    echo -e "${RED}✗ No package manager found${NC}"
    MISSING=$((MISSING + 1))
fi

echo ""
echo "========================================"

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}All requirements satisfied!${NC}"
    echo ""
    echo "Quick start:"
    echo "  1. make setup     # Install dependencies"
    echo "  2. make infra     # Start databases"
    echo "  3. make api       # In terminal 1"
    echo "  4. make collector # In terminal 2"
    echo "  5. make worker    # In terminal 3"
    echo "  6. make dashboard # In terminal 4"
    exit 0
else
    echo -e "${RED}Missing $MISSING requirement(s)${NC}"
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew install docker go node"
    echo ""
    echo "Then install Docker Desktop from:"
    echo "  https://www.docker.com/products/docker-desktop/"
    exit 1
fi
