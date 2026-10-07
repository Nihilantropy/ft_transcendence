#!/bin/bash

# RAG Knowledge Base Initialization Script
# Calls the admin endpoint that synchronises ChromaDB with the knowledge_base
# directory (new / modified / deleted markdown files). Safe to run repeatedly:
# ai-service runs the same synchronisation by itself at startup and then every
# RAG_SYNC_INTERVAL_MINUTES; this script forces a run now and waits for it.

set -e

CONTAINER_NAME="ft_transcendence_ai_service"
ENDPOINT="http://localhost:3003/api/v1/admin/rag/initialize"

echo "🔧 Initializing RAG Knowledge Base..."
echo "======================================"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: Container ${CONTAINER_NAME} is not running"
    echo "   Run 'make up' first"
    exit 1
fi

# The container can be up before uvicorn finishes starting (embedder model load,
# RAG service init) — 'make init' chains straight from 'up' into 'rag' with no
# wait, so poll the same endpoint the compose healthcheck uses instead of
# racing it.
echo "⏳ Waiting for AI Service to be ready..."
READY=false
for _ in $(seq 1 75); do
    if docker exec "${CONTAINER_NAME}" curl -sf http://localhost:3003/health >/dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 2
done

if [ "$READY" != "true" ]; then
    echo "❌ Error: AI Service did not become ready within 150s"
    exit 1
fi

# Call the initialization endpoint. 409 means a synchronisation is already
# running — typically the one ai-service starts by itself at boot, which
# 'make init' races. It is not a failure: wait for it and ask again, so that
# the knowledge base is complete when this script returns.
echo "📡 Calling initialization endpoint..."
for _ in $(seq 1 120); do
    RESPONSE=$(docker exec "${CONTAINER_NAME}" curl -s -w "\n%{http_code}" -X POST "${ENDPOINT}")

    # Extract HTTP status code (last line)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" != "409" ]; then
        break
    fi
    echo "⏳ An ingestion is already running, waiting for it..."
    sleep 5
done

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
FILES_UNCHANGED=$(echo "$JSON_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('files_unchanged',0))" 2>/dev/null || echo "0")
FILES_REMOVED=$(echo "$JSON_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('files_removed',0))" 2>/dev/null || echo "0")

echo "📊 Ingestion Statistics:"
echo "   Files Processed: ${FILES_PROCESSED}"
echo "   Total Chunks Created: ${TOTAL_CHUNKS}"
echo "   Files Unchanged: ${FILES_UNCHANGED}"
echo "   Files Removed: ${FILES_REMOVED}"
echo "   Files Skipped: ${FILES_SKIPPED}"

# Show errors if any
if [ "$FILES_SKIPPED" -gt 0 ]; then
    echo ""
    echo "⚠️  Warnings:"
    echo "$JSON_RESPONSE" | python3 -c "import json,sys; [print(f'   - {e}') for e in json.load(sys.stdin).get('data',{}).get('errors',[])]" 2>/dev/null
fi

echo ""
echo "✨ RAG knowledge base is ready!"
