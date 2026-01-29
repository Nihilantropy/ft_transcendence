#!/bin/bash

set -e

echo "================================"
echo "AI Service Integration Tests"
echo "================================"
echo ""
echo "REQUIREMENTS:"
echo "- docker compose up classification-service ollama ai-service"
echo "- ChromaDB populated with breed knowledge"
echo ""
echo "These tests are SLOW (~30-60 seconds total)"
echo ""

# Check if services are running
echo "Checking service health..."

if ! curl -sf http://localhost:3004/health > /dev/null; then
    echo "ERROR: classification-service not responding at localhost:3004"
    echo "Run: docker compose up classification-service -d"
    exit 1
fi

if ! curl -sf http://localhost:11434/api/tags > /dev/null; then
    echo "ERROR: ollama not responding at localhost:11434"
    echo "Run: docker compose up ollama -d"
    exit 1
fi

echo "✓ Services healthy"
echo ""
echo "Running integration tests..."
echo ""

# Run integration tests with verbose output
docker compose run --rm ai-service python -m pytest \
    tests/integration/ \
    -v \
    -m integration \
    --timeout=60 \
    --tb=short

echo ""
echo "Integration tests complete!"
