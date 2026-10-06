#!/bin/bash
# Step 2 of make trash — refuse to start (and, above all, to delete anything) unless the host has
# the required tools and the root .env holds a usable MISTRAL_API_KEY.
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

fail() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# --disk: run by make trash AFTER the purge (so the space it frees counts). Measured on a full run:
# 13.1 GB of free space consumed at the peak (~14.8 GB of images, 1.5 GB of volumes; the build cache
# is pruned at the end). 20 GB leaves Elasticsearch room to run afterwards. A fuller disk does not
# fail at build time but later and silently: Elasticsearch stops allocating shards and ELK hangs.
MIN_FREE_GB=20
if [ "${1:-}" = "--disk" ]; then
  root="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null)"
  free_gb="$(df -Pk "$root" | awk 'NR==2 {print int($4 / 1024 / 1024)}')"
  if [ "${free_gb:-0}" -lt "$MIN_FREE_GB" ]; then
    df -h "$root" >&2
    docker system df >&2 || true
    fail "Only ${free_gb} GB free in Docker's data root ($root); at least ${MIN_FREE_GB} GB is needed.
  Free space there (other projects' images: 'docker image prune -a', 'docker system df' to see
  what is using it) and re-run. Your data is already deleted, so re-running is safe."
  fi
  echo -e "${GREEN}✓ ${free_gb} GB free in Docker's data root${NC}"
  exit 0
fi

echo -e "${YELLOW}Checking prerequisites...${NC}"
for tool in docker openssl curl python3; do
  command -v "$tool" >/dev/null || fail "$tool is required but not installed"
done
docker info >/dev/null 2>&1 || fail "Cannot reach the Docker daemon (is it running, and is your user allowed to use it?)"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 ('docker compose') is required"
echo -e "${GREEN}✓ docker, docker compose, openssl, curl, python3${NC}"

key="$(grep -m1 '^MISTRAL_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true)"
if [ -z "$key" ]; then
  fail "MISTRAL_API_KEY is empty in $ENV_FILE
  The default (cloud) stack sends every LLM call to Mistral; without a key the vision
  analysis and the RAG answers fail. Get a free key at https://console.mistral.ai/api-keys
  and either set it in .env:   MISTRAL_API_KEY=your-key
  or pass it once:             MISTRAL_API_KEY=your-key make trash
  Nothing has been deleted."
fi

# Catch a mistyped or revoked key now, rather than as a 500 on the first photo upload.
# Only a definite rejection is fatal: no network or a Mistral outage merely warns.
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -H "Authorization: Bearer $key" https://api.mistral.ai/v1/models || true)"
case "$code" in
  200) echo -e "${GREEN}✓ MISTRAL_API_KEY accepted by api.mistral.ai${NC}" ;;
  401|403) fail "Mistral rejected MISTRAL_API_KEY (HTTP $code). Check the key in $ENV_FILE. Nothing has been deleted." ;;
  *) echo -e "${YELLOW}⚠ Could not verify MISTRAL_API_KEY (HTTP ${code:-none}); continuing${NC}" ;;
esac
