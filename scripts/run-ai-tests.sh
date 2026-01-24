#!/bin/bash
# AI Service Test Runner
# Runs unit tests, integration tests, or all tests for the AI service

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
VERBOSE=""
COVERAGE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            shift
            ;;
        --all)
            TEST_TYPE="all"
            shift
            ;;
        --verbose|-v)
            VERBOSE="-v"
            shift
            ;;
        --coverage)
            COVERAGE="--cov=. --cov-report=html --cov-report=term"
            shift
            ;;
        --help|-h)
            echo "AI Service Test Runner"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --unit           Run only unit tests (fast, mocked dependencies)"
            echo "  --integration    Run only integration tests (requires Ollama)"
            echo "  --all            Run all tests (default)"
            echo "  --verbose, -v    Verbose output"
            echo "  --coverage       Generate coverage report"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Run all tests"
            echo "  $0 --unit               # Run only unit tests"
            echo "  $0 --integration        # Run only integration tests"
            echo "  $0 --coverage           # Run with coverage report"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Service Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AI service container is built
if ! docker images | grep -q "ft_transcendence-ai-service"; then
    echo -e "${YELLOW}AI service image not found. Building...${NC}"
    docker compose build ai-service
    echo ""
fi

# Run tests based on type
case $TEST_TYPE in
    unit)
        echo -e "${GREEN}Running unit tests...${NC}"
        echo -e "${YELLOW}(Tests with mocked dependencies)${NC}"
        echo ""
        docker compose run --rm ai-service python -m pytest tests/ \
            -m "not integration and not slow" \
            $VERBOSE $COVERAGE
        ;;

    integration)
        echo -e "${GREEN}Running integration tests...${NC}"
        echo -e "${YELLOW}(Requires Ollama service to be running)${NC}"
        echo ""

        # Check if Ollama is running
        if ! docker compose ps | grep -q "ollama.*Up"; then
            echo -e "${YELLOW}Warning: Ollama service not running. Starting it now...${NC}"
            docker compose up ollama -d
            echo -e "${YELLOW}Waiting for Ollama to be ready...${NC}"
            sleep 5
        fi

        docker compose run --rm ai-service python -m pytest tests/ \
            -m "integration" \
            $VERBOSE $COVERAGE
        ;;

    all)
        echo -e "${GREEN}Running all tests...${NC}"
        echo -e "${YELLOW}(Unit tests + Integration tests)${NC}"
        echo ""

        # Check if Ollama is running for integration tests
        if ! docker compose ps | grep -q "ollama.*Up"; then
            echo -e "${YELLOW}Warning: Ollama service not running.${NC}"
            echo -e "${YELLOW}Integration tests will be skipped.${NC}"
            echo -e "${YELLOW}To run integration tests, start Ollama: docker compose up ollama -d${NC}"
            echo ""
        fi

        docker compose run --rm ai-service python -m pytest tests/ \
            $VERBOSE $COVERAGE
        ;;
esac

EXIT_CODE=$?

echo ""
echo -e "${BLUE}========================================${NC}"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed!${NC}"
fi

echo -e "${BLUE}========================================${NC}"

exit $EXIT_CODE
