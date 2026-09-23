#!/bin/bash
# Complete initialization and testing workflow
# Usage: ./init-and-test.sh [--init] [run-unit-tests.sh options...]
# 1. Build images (only with --init)
# 2. Start services (only with --init)
# 3. Run migrations (only with --init)
# 4. Run tests (all remaining args are forwarded to run-unit-tests.sh)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Extract --init; collect everything else for run-unit-tests.sh
SKIP_INIT=true
TEST_ARGS=()

for arg in "$@"; do
  if [ "$arg" = "--init" ]; then
    SKIP_INIT=false
  else
    TEST_ARGS+=("$arg")
  fi
done

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SmartBreeds Init & Test Workflow        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Initialization phase
if [ "$SKIP_INIT" = false ]; then
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
  "$SCRIPT_DIR/run-migrations.sh"
  echo -e "${GREEN}✓ Migrations complete${NC}"
  echo ""

  echo -e "${YELLOW}[4/4] Running tests...${NC}"
else
  echo -e "${YELLOW}Skipping initialization (pass --init to build, start and migrate)${NC}"
  echo ""
fi

# Run unit tests, forwarding all collected args; let its exit code propagate
echo -e "${BLUE}═══ Running Unit Tests ═══${NC}"
echo ""
bash "$SCRIPT_DIR/run-unit-tests.sh" "${TEST_ARGS[@]}"
exit $?
