#!/bin/bash

# RAG auto-ingestion demo
# Copies the demo document into the knowledge base directory and watches the
# ai-service logs until the periodic sync has ingested it. Nothing is restarted
# and `make rag` is not called: the point is that ai-service picks it up alone.
#
#   DEMO/ingest.sh            # wait up to 7 minutes
#   DEMO/ingest.sh 120        # wait up to 120 seconds

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_NAME="ft_transcendence_ai_service"
DOC_NAME="golden_retriever_conservation.md"
SOURCE="${ROOT}/DEMO/${DOC_NAME}"
# Path as ai-service logs it: relative to the knowledge base root.
SOURCE_FILE="spiecies/dogs/purebreeds/${DOC_NAME}"
TARGET="${ROOT}/srcs/ai/data/knowledge_base/${SOURCE_FILE}"
TIMEOUT="${1:-420}"

echo "RAG auto-ingestion demo"
echo "=========================="

if [ ! -f "$SOURCE" ]; then
    echo "❌ Error: ${SOURCE} not found"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: Container ${CONTAINER_NAME} is not running"
    echo "   Run 'make up' first"
    exit 1
fi

# An identical copy already in place is not a change: the sync skips it and
# there would be nothing to wait for.
if [ -f "$TARGET" ] && cmp -s "$SOURCE" "$TARGET"; then
    echo "ℹ️  ${SOURCE_FILE} is already in the knowledge base, unchanged."
    echo "   Remove it (and wait for the next sync) to run the demo again:"
    echo "   rm ${TARGET}"
    exit 0
fi

# Only log lines written from now on count.
SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cp "$SOURCE" "$TARGET"
echo "✅ Copied ${DOC_NAME} → srcs/ai/data/knowledge_base/${SOURCE_FILE}"
echo "👀 Watching ${CONTAINER_NAME} logs (timeout ${TIMEOUT}s)..."
echo ""

shown=0
start=$(date +%s)
while true; do
    # The sync lines since the copy; print the ones not shown yet.
    lines=$(docker logs --since "$SINCE" "${CONTAINER_NAME}" 2>&1 \
        | grep -E "RAG sync|Ingested |Failed to ingest" || true)
    total=$(printf '%s' "$lines" | grep -c '' || true)
    if [ "$total" -gt "$shown" ]; then
        printf '%s\n' "$lines" | tail -n "$((total - shown))" \
            | sed -E 's/.*"timestamp": "([^"]*)".*"message": "([^"]*)".*/   \1  \2/'
        shown=$total
    fi

    if printf '%s' "$lines" | grep -q "Ingested ${SOURCE_FILE}"; then
        break
    fi

    if printf '%s' "$lines" | grep -q "Failed to ingest .*${DOC_NAME}"; then
        echo ""
        echo "❌ ai-service could not ingest ${DOC_NAME} (see the line above)"
        exit 1
    fi

    elapsed=$(( $(date +%s) - start ))
    if [ "$elapsed" -ge "$TIMEOUT" ]; then
        echo ""
        echo "❌ Not ingested within ${TIMEOUT}s"
        echo "   Check RAG_SYNC_ENABLED / RAG_SYNC_INTERVAL_MINUTES in srcs/ai/.env,"
        echo "   or force a run with 'make rag'"
        exit 1
    fi

    sleep 2
done

echo ""
echo "✨ Ingested after $(( $(date +%s) - start ))s, without restarting anything."
echo "   To undo: rm ${TARGET}"
