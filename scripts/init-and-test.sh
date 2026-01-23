#!/bin/bash
# Complete initialization and testing workflow
# 1. Build images
# 2. Start services
# 3. Run migrations in correct order
# 4. Run comprehensive tests

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SmartBreeds Init & Test Workflow        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Build images
echo -e "${YELLOW}[1/4] Building Docker images...${NC}"
docker compose build
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# Step 2: Start services
echo -e "${YELLOW}[2/4] Starting services...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Step 3: Run migrations
echo -e "${YELLOW}[3/4] Running migrations...${NC}"
./scripts/run-migrations.sh
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Step 4: Run tests
echo -e "${YELLOW}[4/4] Running comprehensive tests...${NC}"
./scripts/run-tests.sh

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All initialization and tests complete!   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
