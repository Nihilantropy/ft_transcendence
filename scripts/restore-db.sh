#!/bin/bash
# make restore [FILE=backups/postgres/daily/smartbreeds-20261008.sql.gz] [YES=1]
#
# Restores a db-backup dump over the live `smartbreeds` database. Runbook: docs/DISASTER_RECOVERY.md.
#   1. stops every writer (and the backup sidecar, so it can't dump a half-restored database)
#   2. streams the dump into the db container in ONE transaction — on any error nothing changes
#   3. restarts the writers, waits for their healthchecks, then checks /health/ready end to end
# Uses the db container, not the sidecar: in a disaster the sidecar may be the thing that's gone.
set -euo pipefail

cd "$(dirname "$0")/.."
FILE="${1:-backups/postgres/last/smartbreeds-latest.sql.gz}"
WRITERS="api-gateway auth-service user-service recommendation-service db-backup"

[ -r "$FILE" ] || { echo "✗ Cannot read ${FILE}. Available dumps:"; ls -1t backups/postgres/*/ 2>/dev/null | head -20; exit 1; }
gzip -t "$FILE" || { echo "✗ ${FILE} is not a valid gzip file"; exit 1; }
real=$(readlink -f "$FILE")

echo "Restore $(basename "$real") ($(du -h "$real" | cut -f1), $(date -r "$real" '+%F %T'))"
echo "over the LIVE database — everything written since that dump is lost."
if [ "${YES:-}" != 1 ]; then
  read -r -p "Type 'restore' to continue: " answer
  [ "$answer" = restore ] || { echo "Aborted."; exit 1; }
fi

docker compose up -d --wait db
echo "Stopping writers..."
docker compose stop $WRITERS

echo "Restoring..."
if ! gunzip -c "$real" | docker exec -i ft_transcendence_db \
    sh -c 'psql -q -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null; then
  echo "✗ Restore failed and was rolled back: the database is as it was. Restarting writers."
  docker compose up -d --wait $WRITERS
  exit 1
fi

echo "Restarting writers..."
docker compose up -d --wait $WRITERS
# nginx resolves api-gateway once at startup; a restarted gateway may have a new IP (→ 502).
docker compose restart nginx >/dev/null 2>&1 || true
for probe in auth-service:3001 user-service:3002 recommendation-service:3005 api-gateway:8001; do
  docker exec ft_transcendence_api_gateway curl -fsS -o /dev/null "http://${probe}/health/ready" \
    || { echo "✗ ${probe%%:*} is not ready after the restore"; exit 1; }
done
echo "✓ Restored $(basename "$real") — all services ready"
