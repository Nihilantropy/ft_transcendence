#!/bin/bash
# make env (also step 1 of make trash) — create every missing .env from its .env.example,
# with the secrets that several files must agree on generated once and written consistently.
#
# Never overwrites an existing .env. The one exception is MISTRAL_API_KEY: when it is set in the
# calling shell (`MISTRAL_API_KEY=... make trash`), it is stored in the root .env, because that is
# where compose reads it from on every later `make up`.
#
# Why not a plain `cp .env.example .env`: the examples do not agree with each other.
# auth-service ships DB_PASSWORD=secure_password_here while db ships smartbreeds_password, so a
# verbatim copy gives an auth-service that cannot log in to its database. Here every value that
# must match is derived from a single source:
#   DB password        srcs/db/.env POSTGRES_PASSWORD  -> auth/user DB_PASSWORD, recommendation DATABASE_URL
#   LiteLLM master key .env LITELLM_MASTER_KEY         -> srcs/ai/.env LLM_API_KEY
# and a final check refuses to continue if existing files disagree.
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v openssl >/dev/null || { echo -e "${RED}✗ openssl is required${NC}" >&2; exit 1; }

hex_secret() { openssl rand -hex "${1:-32}"; }
# Fernet key: urlsafe base64 of 32 random bytes
fernet_key() { openssl rand -base64 32 | tr '+/' '-_'; }

# Value of KEY in FILE, without surrounding quotes or a trailing ` # comment`
get_var() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -m1 "^${key}=" "$file" | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true
}

# Set KEY=VALUE in FILE (replace the line, or append it). Writes through the existing inode so the
# file keeps its mode: auth-service and user-service bind-mount their whole directory and
# python-decouple reads /app/.env as uid 1000, so a 600 file would crash Django at startup.
set_var() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  K="$key" V="$value" awk '
    index($0, ENVIRON["K"] "=") == 1 { print ENVIRON["K"] "=" ENVIRON["V"]; done = 1; next }
    { print }
    END { if (!done) print ENVIRON["K"] "=" ENVIRON["V"] }
  ' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

created=()

# Copy FILE's .env.example to FILE if FILE is missing. Returns 0 only when it created the file.
create_from_example() {
  local file="$1"
  [ -f "$file" ] && return 1
  if [ ! -f "$file.example" ]; then
    echo -e "${RED}✗ $file.example not found${NC}" >&2
    exit 1
  fi
  cp "$file.example" "$file"
  created+=("$file")
  return 0
}

echo -e "${YELLOW}Ensuring every .env file exists...${NC}"

# --- Sources of the shared secrets first -------------------------------------
if create_from_example .env; then
  set_var .env COMPOSE_PROFILES cloud
  set_var .env LITELLM_MASTER_KEY "sk-$(hex_secret 24)"
fi
LITELLM_KEY="$(get_var .env LITELLM_MASTER_KEY)"
LITELLM_KEY="${LITELLM_KEY:-sk-smartbreeds-local}"   # compose's own default when unset

if [ -n "${MISTRAL_API_KEY:-}" ] && [ "$(get_var .env MISTRAL_API_KEY)" != "$MISTRAL_API_KEY" ]; then
  set_var .env MISTRAL_API_KEY "$MISTRAL_API_KEY"
  echo -e "${GREEN}✓ Stored MISTRAL_API_KEY from the environment in .env${NC}"
fi

if create_from_example srcs/db/.env; then
  set_var srcs/db/.env POSTGRES_PASSWORD "$(hex_secret 24)"
fi
DB_PASSWORD="$(get_var srcs/db/.env POSTGRES_PASSWORD)"
DB_USER="$(get_var srcs/db/.env POSTGRES_USER)"
DB_NAME="$(get_var srcs/db/.env POSTGRES_DB)"

# --- Every env_file docker-compose.yml declares ------------------------------
# Read from the compose file so a new service cannot be forgotten here.
for file in $(grep -oE '\./srcs/[^/]+/\.env' docker-compose.yml | sed 's|^\./||' | sort -u); do
  create_from_example "$file" || continue
  case "$file" in
    srcs/auth-service/.env)
      set_var "$file" SECRET_KEY "$(hex_secret 32)"
      set_var "$file" DB_PASSWORD "$DB_PASSWORD"
      set_var "$file" TWO_FACTOR_ENCRYPTION_KEY "$(fernet_key)"
      ;;
    srcs/user-service/.env)
      set_var "$file" SECRET_KEY "$(hex_secret 32)"
      set_var "$file" DB_PASSWORD "$DB_PASSWORD"
      ;;
    srcs/recommendation-service/.env)
      set_var "$file" DATABASE_URL "postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}"
      ;;
    srcs/ai/.env)
      set_var "$file" LLM_API_KEY "$LITELLM_KEY"
      ;;
  esac
done

for file in "${created[@]+"${created[@]}"}"; do
  echo -e "${GREEN}✓ Created $file${NC}"
done
if [ ${#created[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All .env files already present (left untouched)${NC}"
fi

# --- Consistency check (catches hand-edited or stale files) ------------------
errors=0
mismatch() { echo -e "${RED}✗ $1${NC}" >&2; errors=$((errors + 1)); }

for file in srcs/auth-service/.env srcs/user-service/.env; do
  [ "$(get_var "$file" DB_PASSWORD)" = "$DB_PASSWORD" ] \
    || mismatch "$file DB_PASSWORD differs from srcs/db/.env POSTGRES_PASSWORD"
done
case "$(get_var srcs/recommendation-service/.env DATABASE_URL)" in
  *":${DB_PASSWORD}@"*) ;;
  *) mismatch "srcs/recommendation-service/.env DATABASE_URL does not use srcs/db/.env POSTGRES_PASSWORD" ;;
esac
[ "$(get_var srcs/ai/.env LLM_API_KEY)" = "$LITELLM_KEY" ] \
  || mismatch "srcs/ai/.env LLM_API_KEY differs from .env LITELLM_MASTER_KEY"

if [ "$errors" -gt 0 ]; then
  echo -e "${RED}Fix the values above (or delete the offending .env files to regenerate them) and re-run.${NC}" >&2
  exit 1
fi
echo -e "${GREEN}✓ Shared secrets consistent across .env files${NC}"
