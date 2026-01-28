#!/bin/bash
# Unit tests for SmartBreeds microservices

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
TOTAL_TESTS=0
FAILED_TESTS=0

# Function to run tests and track results
run_test_suite() {
  local service_name=$1
  local test_command=$2
  local expected_tests=$3

  echo -e "${YELLOW}Testing ${service_name}...${NC}"
  if eval "$test_command"; then
    echo -e "${GREEN}✓ ${service_name} tests passed (${expected_tests} tests)${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + expected_tests))
  else
    echo -e "${RED}✗ ${service_name} tests failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  echo ""
}

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      SmartBreeds Unit Test Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "API Gateway" \
  "docker compose run --rm api-gateway python -m pytest tests/ -v" \
  28

run_test_suite "Auth Service" \
  "docker compose run --rm auth-service python -m pytest tests/ -v" \
  77

run_test_suite "User Service" \
  "docker compose run --rm user-service python -m pytest tests/ -v" \
  73

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Unit Tests Summary                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Unit Tests Passed: ${GREEN}${TOTAL_TESTS} tests${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All unit tests completed successfully${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAILED_TESTS test suite(s) failed${NC}"
  exit 1
fi
