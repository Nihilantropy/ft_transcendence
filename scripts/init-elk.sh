#!/bin/bash
# make elk / make elk-creds — brings up the ELK logging stack with zero
# manual configuration: generates credentials into the root .env on first
# run, starts the elk-profiled services, waits for provisioning to finish,
# and prints the credential banner.
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

CREDS_ONLY=false
if [ "$1" = "--creds-only" ]; then
  CREDS_ONLY=true
fi

random_secret() {
  local length="${1:-24}"
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
}

ensure_secret() {
  local var_name="$1"
  local length="${2:-24}"
  if ! grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
    echo "${var_name}=$(random_secret "$length")" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Generated ${var_name}${NC}"
  fi
}

print_creds() {
  local elastic_pw
  elastic_pw=$(grep '^ELASTIC_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ELK Stack Ready${NC}"
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo "  Kibana:    https://localhost:5601"
  echo "  Username:  elastic"
  echo "  Password:  ${elastic_pw}"
  echo ""
  echo "  Retention: 30d  |  Snapshots: daily, 60d"
  echo "  Credentials stored in ./.env — reprint with 'make elk-creds'"
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo ""
}

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}[0/3] No root .env found, seeding from .env.example...${NC}"
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

if [ "$CREDS_ONLY" = true ]; then
  if ! grep -q '^ELASTIC_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
    echo -e "${RED}✗ No ELK credentials found — run 'make elk' first${NC}"
    exit 1
  fi
  print_creds
  exit 0
fi

echo -e "${YELLOW}[1/3] Ensuring ELK credentials exist...${NC}"
ensure_secret ELASTIC_PASSWORD 24
ensure_secret KIBANA_SYSTEM_PASSWORD 24
ensure_secret LOGSTASH_WRITER_PASSWORD 24
ensure_secret KIBANA_ENCRYPTION_KEY 32
echo -e "${GREEN}✓ Credentials ready${NC}"

echo -e "${YELLOW}[2/3] Starting ELK services...${NC}"
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-cloud},elk"
cd "$ROOT_DIR"
docker compose -f docker-compose.yml up -d elasticsearch logstash kibana filebeat elk-setup

echo -e "${YELLOW}[2/3] Waiting for provisioning (elk-setup) to finish...${NC}"
# elk-setup stays running after it finishes (see srcs/elk/setup/entrypoint.sh
# for why), so "done" is a marker file, not the container exiting. A real
# failure still makes the container exit non-zero (`set -e`), so that's
# checked on every iteration too.
max_attempts=200
attempt=0
while true; do
  if docker exec ft_transcendence_elk_setup test -f /usr/share/elasticsearch/config/certs/.setup-complete 2>/dev/null; then
    break
  fi
  status=$(docker inspect -f '{{.State.Status}}' ft_transcendence_elk_setup 2>/dev/null || echo "missing")
  if [ "$status" = "exited" ]; then
    echo -e "${RED}✗ elk-setup failed (exit $(docker inspect -f '{{.State.ExitCode}}' ft_transcendence_elk_setup))${NC}"
    docker logs --tail 50 ft_transcendence_elk_setup 2>&1 || true
    exit 1
  fi
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo -e "${RED}✗ elk-setup did not finish in time${NC}"
    docker logs --tail 50 ft_transcendence_elk_setup 2>&1 || true
    exit 1
  fi
  sleep 5
done
echo -e "${GREEN}✓ ELK provisioning complete${NC}"

echo -e "${YELLOW}[3/3] Done${NC}"
print_creds
