#!/bin/bash
# ELK zero-config bootstrap: CA + per-node certs, elastic/kibana_system/logstash_writer
# credentials, ILM + SLM + index template + snapshot repo, Kibana data view.
# Idempotent: safe to re-run against an existing certs/data volume.
set -e

CERTS_DIR=/usr/share/elasticsearch/config/certs
SETUP_DIR=/setup
ES_URL=https://elasticsearch:9200
KIBANA_URL=https://kibana:5601

for v in ELASTIC_PASSWORD KIBANA_SYSTEM_PASSWORD LOGSTASH_WRITER_PASSWORD; do
  if [ -z "${!v}" ]; then
    echo "✗ Missing required env var: $v"
    exit 1
  fi
done

# --- 1. CA + per-node certs -------------------------------------------------
if [ ! -f "${CERTS_DIR}/ca/ca.crt" ]; then
  echo "[1/6] Generating CA..."
  mkdir -p "${CERTS_DIR}"
  bin/elasticsearch-certutil ca --silent --pem -out /tmp/ca.zip
  unzip -q -o /tmp/ca.zip -d /tmp/ca-out
  mkdir -p "${CERTS_DIR}/ca"
  cp /tmp/ca-out/ca/ca.crt "${CERTS_DIR}/ca/ca.crt"
  cp /tmp/ca-out/ca/ca.key "${CERTS_DIR}/ca/ca.key"

  echo "[1/6] Generating node certs (elasticsearch, kibana, logstash)..."
  cat > /tmp/instances.yml <<'YML'
instances:
  - name: elasticsearch
    dns: [elasticsearch, localhost]
  - name: kibana
    dns: [kibana, localhost]
  - name: logstash
    dns: [logstash, localhost]
YML
  bin/elasticsearch-certutil cert --silent --pem -out /tmp/certs.zip \
    --in /tmp/instances.yml \
    --ca-cert "${CERTS_DIR}/ca/ca.crt" --ca-key "${CERTS_DIR}/ca/ca.key"
  unzip -q -o /tmp/certs.zip -d /tmp/certs-out
  cp -r /tmp/certs-out/* "${CERTS_DIR}/"
  # Dev-only simplification: world-readable so the three images' differing
  # default UIDs/GIDs can all read the cert material without per-image chown.
  # ponytail: world-readable certs, tighten with per-service chown if this
  # stack is ever pointed at anything but a local dev environment.
  chmod -R a+rX "${CERTS_DIR}"
  echo "✓ Certs ready"
else
  echo "[1/6] Certs already present, skipping"
fi

# A fresh named volume is root-owned; Elasticsearch runs as a non-root user
# and needs write access here for the snapshot repository. Cheap and
# idempotent, so it just runs every time rather than being gated on state.
chmod -R a+rwX /usr/share/elasticsearch/snapshots

# From here on, the healthcheck (test -f ca.crt) is already green, so
# Elasticsearch is starting concurrently with the rest of this script.

# --- 2. Wait for Elasticsearch ----------------------------------------------
echo "[2/6] Waiting for Elasticsearch..."
max_attempts=150
attempt=0
until curl -s --cacert "${CERTS_DIR}/ca/ca.crt" "${ES_URL}" 2>/dev/null | grep -q "missing authentication credentials"; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "✗ Elasticsearch did not become reachable in time"
    exit 1
  fi
  sleep 5
done
echo "✓ Elasticsearch reachable"

CURL_ES="curl -s --cacert ${CERTS_DIR}/ca/ca.crt -u elastic:${ELASTIC_PASSWORD}"

# PUT a JSON body at $1 to ES path $2, fail loudly instead of the response
# silently landing in /dev/null — this is exactly the class of bug that let
# a bad ILM/SLM install order go unnoticed the first time this was written.
put_es_json() {
  local path="$1" body_flag="$2" body_arg="$3" response
  response=$(${CURL_ES} -X PUT "${ES_URL}${path}" -H 'Content-Type: application/json' "${body_flag}" "${body_arg}")
  if echo "$response" | grep -q '"error"'; then
    echo "✗ PUT ${path} failed: ${response}"
    exit 1
  fi
}

# --- 3. Built-in / custom users ---------------------------------------------
echo "[3/6] Setting kibana_system password..."
until ${CURL_ES} -X POST "${ES_URL}/_security/user/kibana_system/_password" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${KIBANA_SYSTEM_PASSWORD}\"}" | grep -q '^{}'; do
  sleep 5
done
echo "✓ kibana_system password set"

echo "[3/6] Creating logstash_writer role + user..."
put_es_json "/_security/role/logstash_writer" -d '{
    "cluster": ["monitor"],
    "indices": [
      {
        "names": ["logs-smartbreeds-*"],
        "privileges": ["write", "create_index", "auto_configure"]
      }
    ]
  }'
put_es_json "/_security/user/logstash_writer" -d "{
    \"password\": \"${LOGSTASH_WRITER_PASSWORD}\",
    \"roles\": [\"logstash_writer\"],
    \"full_name\": \"Logstash ingest user\"
  }"
echo "✓ logstash_writer ready"

# --- 4. Archiving (SLM) + retention (ILM) + index template -----------------
# Order matters: the ILM policy's `wait_for_snapshot` action references the
# SLM policy by name, and the SLM policy references the snapshot repo by
# name — ES validates both references at creation time, so repo -> SLM ->
# ILM -> index template is the only order that doesn't 400.
echo "[4/6] Registering snapshot repo..."
put_es_json "/_snapshot/smartbreeds-snapshots" -d '{
    "type": "fs",
    "settings": { "location": "/usr/share/elasticsearch/snapshots" }
  }'

echo "[4/6] Installing SLM policy..."
put_es_json "/_slm/policy/smartbreeds-logs-snapshots" --data-binary "@${SETUP_DIR}/slm-policy.json"

echo "[4/6] Installing ILM policy..."
put_es_json "/_ilm/policy/smartbreeds-logs" --data-binary "@${SETUP_DIR}/ilm-policy.json"

echo "[4/6] Installing index template..."
put_es_json "/_index_template/smartbreeds-logs" --data-binary "@${SETUP_DIR}/index-template.json"
echo "✓ Snapshot repo + SLM + ILM + template installed"

# --- 5. Wait for Kibana ------------------------------------------------------
echo "[5/6] Waiting for Kibana..."
attempt=0
until [ "$(curl -k -s -o /dev/null -w '%{http_code}' "${KIBANA_URL}/api/status")" = "200" ]; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "✗ Kibana did not become reachable in time"
    exit 1
  fi
  sleep 5
done
echo "✓ Kibana reachable"

CURL_KB="curl -k -s -u elastic:${ELASTIC_PASSWORD} -H kbn-xsrf:true"

# --- 6. Kibana data view + best-effort dashboard import ---------------------
echo "[6/6] Creating Kibana data view..."
kb_response=$(${CURL_KB} -X POST "${KIBANA_URL}/api/data_views/data_view" \
  -H 'Content-Type: application/json' -d '{
    "data_view": {
      "id": "smartbreeds-logs-dataview",
      "title": "logs-smartbreeds-*",
      "timeFieldName": "@timestamp",
      "name": "SmartBreeds Logs"
    },
    "override": true
  }')
if echo "$kb_response" | grep -q '"statusCode"'; then
  echo "✗ Data view creation failed: ${kb_response}"
  exit 1
fi
echo "✓ Data view ready"

if [ -f "/kibana/dashboard.ndjson" ]; then
  echo "[6/6] Importing dashboard (best-effort)..."
  ${CURL_KB} -X POST "${KIBANA_URL}/api/saved_objects/_import?overwrite=true" \
    -F "file=@/kibana/dashboard.ndjson" -o /tmp/import-result.json \
    && echo "✓ Dashboard imported" \
    || echo "⚠ Dashboard import failed (non-fatal, data view still usable)"
fi

touch "${CERTS_DIR}/.setup-complete"
echo "✓ ELK setup complete"

# Stay alive instead of exiting: Elasticsearch's `depends_on: elk-setup
# condition: service_healthy` re-verifies this container's health status on
# every `docker compose up`, and Docker Compose can race a container that
# exits right as that re-check runs, wrongly reporting "dependency failed
# to start" even on a clean exit 0. A container that never exits removes
# the race entirely; scripts/init-elk.sh polls for .setup-complete instead
# of a process exit to know provisioning finished.
exec sleep infinity
