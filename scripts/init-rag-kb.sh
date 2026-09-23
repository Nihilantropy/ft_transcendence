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

# Extract metrics via python3 (consistent with json.tool usage above)
FILES_PROCESSED=$(echo "$JSON_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('files_processed',0))" 2>/dev/null || echo "0")
TOTAL_CHUNKS=$(echo "$JSON_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('total_chunks_created',0))" 2>/dev/null || echo "0")
FILES_SKIPPED=$(echo "$JSON_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('files_skipped',0))" 2>/dev/null || echo "0")

echo "📊 Ingestion Statistics:"
echo "   Files Processed: ${FILES_PROCESSED}"
echo "   Total Chunks Created: ${TOTAL_CHUNKS}"
echo "   Files Skipped: ${FILES_SKIPPED}"

# Show errors if any
if [ "$FILES_SKIPPED" -gt 0 ]; then
    echo ""
    echo "⚠️  Warnings:"
    echo "$JSON_RESPONSE" | python3 -c "import json,sys; [print(f'   - {e}') for e in json.load(sys.stdin).get('data',{}).get('errors',[])]" 2>/dev/null
fi

echo ""
echo "✨ RAG knowledge base is ready!"
