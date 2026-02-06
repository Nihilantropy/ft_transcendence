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

usage() {
  echo -e "${BLUE}Usage: $0 [OPTIONS]${NC}"
  echo ""
  echo "  --all              Run all test suites (default)"
  echo "  --gateway          API Gateway tests"
  echo "  --auth             Auth Service tests"
  echo "  --user             User Service tests"
  echo "  --ai               AI Service tests"
  echo "  --classification   Classification Service tests"
  echo "  --recommendation   Recommendation Service tests"
  echo "  -h, --help         Show this help message"
  echo ""
  echo "Multiple flags can be combined, e.g.: $0 --auth --user --ai"
  exit 0
}

# Parse arguments
RUN_GATEWAY=false
RUN_AUTH=false
RUN_USER=false
RUN_AI=false
RUN_CLASSIFICATION=false
RUN_RECOMMENDATION=false
SPECIFIC_SUITE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      shift
      ;;
    --gateway)
      RUN_GATEWAY=true; SPECIFIC_SUITE=true; shift
      ;;
    --auth)
      RUN_AUTH=true; SPECIFIC_SUITE=true; shift
      ;;
    --user)
      RUN_USER=true; SPECIFIC_SUITE=true; shift
      ;;
    --ai)
      RUN_AI=true; SPECIFIC_SUITE=true; shift
      ;;
    --classification)
      RUN_CLASSIFICATION=true; SPECIFIC_SUITE=true; shift
      ;;
    --recommendation)
      RUN_RECOMMENDATION=true; SPECIFIC_SUITE=true; shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      usage
      ;;
  esac
done

# Default to all if no specific suite requested
if [ "$SPECIFIC_SUITE" = false ]; then
  RUN_GATEWAY=true
  RUN_AUTH=true
  RUN_USER=true
  RUN_AI=true
  RUN_CLASSIFICATION=true
  RUN_RECOMMENDATION=true
fi

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

[ "$RUN_GATEWAY" = true ] && run_test_suite "API Gateway" \
  "docker compose run --rm api-gateway python -m pytest tests/ -v" \
  28

[ "$RUN_AUTH" = true ] && run_test_suite "Auth Service" \
  "docker compose run --rm auth-service python -m pytest tests/ -v" \
  102

[ "$RUN_USER" = true ] && run_test_suite "User Service" \
  "docker compose run --rm user-service python -m pytest tests/ -v" \
  91

[ "$RUN_AI" = true ] && run_test_suite "AI Service" \
  "docker compose run --rm ai-service python -m pytest tests/ -v" \
  37

[ "$RUN_CLASSIFICATION" = true ] && run_test_suite "Classification Service" \
  "docker compose run --rm classification-service python -m pytest tests/ -v" \
  28

[ "$RUN_RECOMMENDATION" = true ] && run_test_suite "Recommendation Service" \
  "docker compose run --rm recommendation-service python -m pytest tests/unit/ -v" \
  42

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
