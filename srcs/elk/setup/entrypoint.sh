#!/bin/bash
# ELK zero-config bootstrap: CA + per-node certs, elastic/kibana_system/logstash_writer
# credentials, ILM + SLM + index template + snapshot repo, Kibana data view,
# saved searches and dashboards.
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

# Clear the completion marker up front: it lives in the persistent elk-certs
# volume, so a marker left by an earlier successful run would otherwise make
# scripts/init-elk.sh declare "ELK Stack Ready" the instant this run starts —
# even if this run goes on to fail, and even if it prints a password that no
# longer works. The marker must only ever describe the current run.
rm -f "${CERTS_DIR}/.setup-complete" 2>/dev/null || true

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

# Logstash's tcp input — unlike the beats input it replaced — rejects the
# PKCS#1 key that elasticsearch-certutil emits ("BEGIN RSA PRIVATE KEY").
# Convert once so the Vector -> Logstash hop can still be TLS.
if [ ! -f "${CERTS_DIR}/logstash/logstash.pkcs8.key" ]; then
  openssl pkcs8 -topk8 -nocrypt \
    -in "${CERTS_DIR}/logstash/logstash.key" \
    -out "${CERTS_DIR}/logstash/logstash.pkcs8.key"
  chmod a+r "${CERTS_DIR}/logstash/logstash.pkcs8.key"
  echo "✓ PKCS#8 key written for the Logstash tcp input"
fi

# Only now is every cert generated AND readable. The container healthcheck
# gates on this marker, so Elasticsearch — which waits on
# `elk-setup: condition: service_healthy` — cannot start before its own
# cert/key exist. Gating on ca.crt instead raced: the CA lands several
# seconds and one certutil run before the node certs do.
touch "${CERTS_DIR}/.certs-ready"

# A fresh named volume is root-owned; Elasticsearch runs as a non-root user
# and needs write access here for the snapshot repository. Cheap and
# idempotent, so it just runs every time rather than being gated on state.
chmod -R a+rwX /usr/share/elasticsearch/snapshots

# From here on, the healthcheck (test -f .certs-ready) is already green, so
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
# Bounded: a stale es-data volume whose `elastic` password no longer matches
# ELASTIC_PASSWORD answers 401 forever, and an unbounded loop here hung the
# whole provisioning run silently.
attempt=0
until response=$(${CURL_ES} -X POST "${ES_URL}/_security/user/kibana_system/_password" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${KIBANA_SYSTEM_PASSWORD}\"}") && echo "$response" | grep -q '^{}'; do
  # An unassignable .security shard never heals by waiting: every retry burns the full 1 min
  # shard timeout, and the 401 hint below would blame the password. Ask Elasticsearch why and
  # stop with that reason (in practice: the Docker disk is past the disk watermark).
  if echo "$response" | grep -q 'unavailable_shards_exception'; then
    explain=$(${CURL_ES} "${ES_URL}/_cluster/allocation/explain" 2>/dev/null || true)
    if echo "$explain" | grep -q '"can_allocate":"no"'; then
      echo "✗ Elasticsearch cannot allocate the .security index, so no user can be created."
      echo "$explain" | grep -o '"explanation":"[^"]*"' | sort -u | sed 's/^/  /'
      echo "  If the reason mentions disk usage / watermark: free space in Docker's data root"
      echo "  ('docker info -f {{.DockerRootDir}}'; 'docker builder prune -af' is usually the big one),"
      echo "  then run 'make elk' again."
      exit 1
    fi
  fi
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "✗ Could not set the kibana_system password. Last response: ${response}"
    echo "  The 'elastic' password is most likely out of sync with the es-data"
    echo "  volume — that happens when the root .env was regenerated against an"
    echo "  existing cluster. Either restore the old ELASTIC_PASSWORD, or wipe"
    echo "  the stack with 'make downv' and run 'make elk' again."
    exit 1
  fi
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

# A template only applies to indices created after it. When the mapping changes, roll the
# data stream over so the new write index uses it — otherwise an existing cluster keeps the
# old mapping until the next daily rollover. The probe is the template's `_meta.schema_version`
# (bump it in index-template.json with every mapping change), NOT the presence of a field:
# Logstash may already have written the new fields into the old index, dynamically mapped.
schema_version=$(grep -o '"schema_version": *[0-9]*' "${SETUP_DIR}/index-template.json" | grep -o '[0-9]*$')
write_index=$(${CURL_ES} "${ES_URL}/_data_stream/logs-smartbreeds-default" 2>/dev/null \
  | grep -o '"index_name":"[^"]*"' | tail -1 | cut -d'"' -f4)
if [ -n "$write_index" ] && ! ${CURL_ES} "${ES_URL}/${write_index}/_mapping" \
    | grep -q "\"schema_version\":${schema_version}[,}]"; then
  ${CURL_ES} -X POST "${ES_URL}/logs-smartbreeds-default/_rollover" >/dev/null
  echo "✓ Data stream rolled over onto the updated template"
fi

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

# --- 6. Kibana data view, space features, dashboards ----------------------
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

# SLOs are a Platinum feature; this cluster runs the free basic license, so every
# Observability page that lists SLOs showed "Something went wrong while fetching SLOs /
# Forbidden" (the API answers 403 "Platinum license or higher is needed"). Hide the
# feature in the default space. Not `xpack.slo.enabled: false` in kibana.yml: the Logs
# Explorer plugin requires the slo plugin, so that would take Logs Explorer down too.
echo "[6/6] Disabling the Platinum-only SLO feature in the default space..."
kb_response=$(${CURL_KB} -X PUT "${KIBANA_URL}/api/spaces/space/default" \
  -H 'Content-Type: application/json' -d '{
    "id": "default",
    "name": "Default",
    "description": "This is your default space!",
    "color": "#00bfb3",
    "disabledFeatures": ["slo"]
  }')
if echo "$kb_response" | grep -q '"statusCode"'; then
  echo "✗ Updating the default space failed: ${kb_response}"
  exit 1
fi
echo "✓ SLO feature hidden"

# Saved searches + dashboards, generated by /kibana/build_dashboards.py. A failed import
# used to be swallowed (curl only fails on transport errors, never on Kibana's per-object
# errors), so check Kibana's own verdict.
echo "[6/6] Importing saved searches and dashboards..."
import_result=$(${CURL_KB} -X POST "${KIBANA_URL}/api/saved_objects/_import?overwrite=true" \
  -F "file=@/kibana/dashboard.ndjson")
if ! echo "$import_result" | grep -q '"success":true'; then
  echo "✗ Dashboard import failed: ${import_result}"
  exit 1
fi
echo "✓ Dashboards imported: $(echo "$import_result" | grep -o '"successCount":[0-9]*' | cut -d: -f2) saved objects"

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
