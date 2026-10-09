# Disaster recovery

How SmartBreeds' data is backed up, how to check those backups, and how to rebuild the platform from them.

| | |
|---|---|
| **RPO** (data you can lose) | ≤ 1 hour for the database (hourly dumps); ≤ 1 day for logs (daily snapshots) |
| **RTO** (time to recover) | a few minutes for a database restore on a running stack (`make restore`); ~15 min for a bare host, mostly image builds and model downloads |
| **Proof** | every dump is restored into a scratch database right after it is taken. A dump that does not restore is reported as `BACKUP_VERIFY FAILED` in the logs and on the Kibana status page. `make gate` takes and verifies one too |

## What is protected

| Data | Where it lives | Backup | Retention |
|---|---|---|---|
| Postgres `smartbreeds` (users, 2FA, pets, analyses, products) | `db-data` volume | `db-backup` sidecar: hourly `pg_dump` → `backups/postgres/` | 24 h of hourly dumps, 7 daily, 4 weekly, 6 monthly |
| Application logs | `es-data` volume | Elasticsearch SLM, daily at 01:30 → `backups/elasticsearch/` | 60 days |
| **Secrets** (see below) | `.env` files, `srcs/auth-service/keys/` | **none, kept by hand** | — |
| ChromaDB (RAG knowledge) | `ai-chroma-data` | not needed: rebuilt from `srcs/ai/data/knowledge_base` with `make rag` | — |
| HuggingFace weights | `huggingface-cache` | not needed: re-downloaded on first start (~1.3 GB) | — |
| Redis | `redis-data` | not needed: holds only rate-limit counters with a 60 s TTL | — |
| TLS certificate | `nginx-ssl` | not needed: self-signed, regenerated on every nginx start | — |

`backups/` is a **host directory**, not a Docker volume, so `make downv`, `make purge` and `make trash` cannot delete it. Under rootful Docker its files are owned by root (the sidecar runs as root), so a stray `rm` will not remove them either. It is gitignored.

### Secrets: back these up yourself

A database restore is useless without these. Keep a copy off the machine, in a password manager or a vault:

- `srcs/auth-service/.env`. Most important are `SECRET_KEY` and `TWO_FACTOR_ENCRYPTION_KEY`.
  - TOTP secrets are encrypted with `TWO_FACTOR_ENCRYPTION_KEY`, or with a key derived from `SECRET_KEY` when that variable is empty.
  - Restore the database with a different key and every 2FA user is locked out: their secrets can no longer be decrypted.
- `srcs/auth-service/keys/jwt-private.pem` (+ `jwt-public.pem`). With a new key pair, every existing session becomes invalid. That is survivable: users log in again.
- `srcs/*/.env` and the root `.env`. They hold the database password, `MISTRAL_API_KEY`, `LITELLM_MASTER_KEY`, the ELK passwords and the OAuth 42 client secret.

## Day-to-day commands

```bash
make backup                 # dump now + verify (same job the hourly schedule runs)
make backup-verify          # re-verify the latest dump without taking a new one
ls -lt backups/postgres/last/           # hourly dumps; *-latest.sql.gz → newest
ls backups/postgres/{daily,weekly,monthly}/
docker logs ft_transcendence_db_backup | grep BACKUP_VERIFY
```

Kibana (`make elk`, then https://localhost:5601) shows the backups too: open **Dashboards → SmartBreeds · Service Status**. Look at the *Backups verified* and *Backup failures* tiles and the *Backup runs* table.

### How verification works

`srcs/db/backup/50-verify` runs as the sidecar's post-backup hook:

1. It gunzips the dump and restores it into a scratch database, `restore_check`, as one transaction with `ON_ERROR_STOP`.
2. It checks that the three application schemas exist and counts the tables and users.
3. It drops the scratch database.

A failed run, whether the dump itself or the verification, leaves an `ERROR: BACKUP_VERIFY FAILED <reason>` line. That line raises the error count on the Kibana dashboards.

## Scenario 1: bad data, stack still running

Examples: a bad migration, a buggy deploy that corrupted rows, an accidental delete.

```bash
ls -lt backups/postgres/last/ backups/postgres/daily/      # pick a dump from before the incident
make restore FILE=backups/postgres/last/smartbreeds-20261008-140000.sql.gz
# (no FILE → the latest dump)
```

`scripts/restore-db.sh` does the following:

1. It asks you to type `restore`. `YES=1` skips the prompt.
2. It stops the API gateway, auth, user and recommendation services, and the backup sidecar, so nothing writes while it restores.
3. It replays the dump in a single transaction. If anything fails, it rolls back and the database is left as it was.
4. It restarts the services and waits until each one reports ready on `/health/ready`, which runs a real `SELECT 1`.

Everything written after the chosen dump is lost.

## Scenario 2: the database volume is gone

Examples: `make downv` or `make trash` was run, or the volume got corrupted.

```bash
make up                     # empty db, init scripts recreate the schemas and role
make restore                # latest dump; it recreates every table, then the services restart
```

Do **not** run `make migration` before the restore: the dump already contains the `django_migrations` rows. If you migrate an empty database first, the restore simply drops and recreates the same tables, which wastes time but does no harm.

You may also want to restore the logs. The snapshot repository is re-registered on every `make elk`, so the existing snapshots in `backups/elasticsearch/` are visible again:

```bash
make elk
curl -sk -u elastic:$ELASTIC_PASSWORD https://localhost:9200/_snapshot/smartbreeds-snapshots/_all | jq '.snapshots[].snapshot'
# restore one: POST _snapshot/smartbreeds-snapshots/<name>/_restore {"indices":"logs-smartbreeds-*"}
```

(`docker exec ft_transcendence_elasticsearch curl …` if 9200 is not published.)

## Scenario 3: the host is gone

What you need:

- a copy of `backups/`;
- your secrets, as listed above;
- the git repository.

```bash
git clone <repo> && cd ft_transcendence
# put the secrets back: srcs/*/.env, root .env, srcs/auth-service/keys/*.pem
# put the dumps back:   backups/postgres/…  (and backups/elasticsearch/… for logs)
make build && make up
make restore FILE=backups/postgres/daily/smartbreeds-YYYYMMDD.sql.gz YES=1
make rag                    # rebuild the RAG knowledge base
make elk                    # optional: log stack + status page
```

The host directory is the only copy. Shipping `backups/` to off-site storage, for example `restic` or `rclone` on a cron to an S3 bucket, is the next step once a bucket exists. Until then, a dead disk loses both the database and its backups.

## Restore drill

Run it after any change to the schema or the backup setup, and before an evaluation:

```bash
make backup                                            # → "INFO: BACKUP_VERIFY OK …"
# register a user in the app (https://localhost:8443)
make backup                                            # the dump now contains that user
make downv && make up                                  # wipes db-data
make restore YES=1                                     # → "✓ Restored … all services ready"
# log in with the user created above
```

## Known limits

- **No point-in-time recovery.** You can restore to any of the dumps, not to an arbitrary second. If 1 h RPO stops being enough, the next step is continuous WAL archiving with WAL-G or pgBackRest. That needs a custom Postgres image and an object store.
- **Single copy on the same disk** until an off-site sync exists (see Scenario 3).
- **The sidecar's major version must match Postgres**: `postgres-backup-local:15` goes with `postgres:15-alpine`. Upgrade both together.
