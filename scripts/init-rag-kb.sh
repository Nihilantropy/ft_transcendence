#!/bin/bash

# RAG Knowledge Base Initialization Script
# Calls the admin endpoint to ingest all markdown files from knowledge_base directory

set -e

CONTAINER_NAME="ft_transcendence_ai_service"
ENDPOINT="http://localhost:3003/api/v1/admin/rag/initialize"

echo "🔧 Initializing RAG Knowledge Base..."
echo "======================================"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: Container ${CONTAINER_NAME} is not running"
    echo "   Run 'make up' or 'docker compose up -d' first"
    exit 1
fi

# Call the initialization endpoint
echo "📡 Calling initialization endpoint..."
RESPONSE=$(docker exec "${CONTAINER_NAME}" curl -s -w "\n%{http_code}" -X POST "${ENDPOINT}")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

# Extract JSON response (all but last line)
JSON_RESPONSE=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "HTTP Status: ${HTTP_CODE}"
echo ""

# Check HTTP status code
if [ "$HTTP_CODE" -ne 200 ]; then
    echo "❌ Initialization Failed"
    echo "================================"

    # Try to parse error message
    ERROR_MSG=$(echo "$JSON_RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"\(.*\)"/\1/' || echo "Unknown error")
    echo "Error: ${ERROR_MSG}"

    # Print full response for debugging
    echo ""
    echo "Full Response:"
    echo "$JSON_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$JSON_RESPONSE"

    exit 1
fi

# Parse success response
echo "✅ Initialization Successful"
echo "============================"
echo ""

# Extract metrics using grep and sed (fallback to jq if available)
if command -v jq &> /dev/null; then
    FILES_PROCESSED=$(echo "$JSON_RESPONSE" | jq -r '.data.files_processed // 0')
    TOTAL_CHUNKS=$(echo "$JSON_RESPONSE" | jq -r '.data.total_chunks_created // 0')
    FILES_SKIPPED=$(echo "$JSON_RESPONSE" | jq -r '.data.files_skipped // 0')
    ERRORS=$(echo "$JSON_RESPONSE" | jq -r '.data.errors // []')
else
    FILES_PROCESSED=$(echo "$JSON_RESPONSE" | grep -o '"files_processed":[0-9]*' | cut -d':' -f2 || echo "0")
    TOTAL_CHUNKS=$(echo "$JSON_RESPONSE" | grep -o '"total_chunks_created":[0-9]*' | cut -d':' -f2 || echo "0")
    FILES_SKIPPED=$(echo "$JSON_RESPONSE" | grep -o '"files_skipped":[0-9]*' | cut -d':' -f2 || echo "0")
fi

echo "📊 Ingestion Statistics:"
echo "   Files Processed: ${FILES_PROCESSED}"
echo "   Total Chunks Created: ${TOTAL_CHUNKS}"
echo "   Files Skipped: ${FILES_SKIPPED}"

# Show errors if any
if [ "$FILES_SKIPPED" -gt 0 ]; then
    echo ""
    echo "⚠️  Warnings:"
    if command -v jq &> /dev/null; then
        echo "$JSON_RESPONSE" | jq -r '.data.errors[]' | sed 's/^/   - /'
    else
        echo "   Run with jq installed for detailed error messages"
    fi
fi

echo ""
echo "✨ RAG knowledge base is ready!"
