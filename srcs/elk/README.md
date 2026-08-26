# ELK — Log Management Stack

Elasticsearch + Logstash + Kibana + Filebeat, started with a single command
(`make elk`) and requiring **no manual configuration**: certificates, service
accounts, retention policy, archiving policy and the Kibana data view are all
generated and installed by a one-shot setup container the first time the
stack comes up. Credentials are random, generated into the gitignored root
`.env`, and printed to the terminal — this is a development-environment
convenience, not a production credential-management story.

Every container log on the host — from every service, in every compose
profile — is picked up automatically. Nothing needs to be pointed at ELK
per-service; Filebeat reads Docker's own log files directly.

## Architecture

```
                    ┌─────────────┐
 all containers ──▶ │  Filebeat   │  reads /var/lib/docker/containers/*/*.log
 (stdout/stderr)    │ (+docker    │  (json-file driver), enriches with
                    │  metadata)  │  container.name / image / labels
                    └──────┬──────┘
                           │ beats protocol, TLS
                           ▼
                    ┌─────────────┐
                    │  Logstash   │  json filter (api-gateway, ai-service,
                    │             │  nginx already emit JSON) + grok
                    │             │  fallback for plain-text loggers
                    └──────┬──────┘
                           │ HTTPS, logstash_writer user
                           ▼
                    ┌─────────────┐
                    │Elasticsearch│  data stream logs-smartbreeds-default
                    │             │  ILM: hot → warm(2d) → delete(30d, only
                    │             │  after an SLM snapshot exists)
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Kibana    │  https://localhost:5601
                    │             │  data view + a starter saved search
                    └─────────────┘
```

`elk-setup` (not pictured above — it's not in the data path) is a one-shot
provisioning container built from the Elasticsearch image, since that image
already ships `elasticsearch-certutil`, `curl` and `openssl`. It generates a
CA and per-node certs into the shared `elk-certs` volume, waits for
Elasticsearch, sets up users/roles/policies, waits for Kibana, and creates
the data view. It **stays running** (`sleep infinity`) after finishing rather
than exiting — see [Gotchas](#gotchas) for why that matters.

## Containers

| Service | Container | Role | Host port |
|---|---|---|---|
| `elk-setup` | `ft_transcendence_elk_setup` | One-shot provisioning (see above) | none |
| `elasticsearch` | `ft_transcendence_elasticsearch` | Storage + indexing | none |
| `logstash` | `ft_transcendence_logstash` | Parse + route to ES | none |
| `kibana` | `ft_transcendence_kibana` | UI | `5601` |
| `filebeat` | `ft_transcendence_filebeat` | Log shipper (all containers) | none |

All five run under the `elk` compose profile only — `make up` never starts
them. All are on `backend-network`, matching every other backend service in
this repo; Kibana is the one exception published to the host, by explicit
request, the same way the API Gateway and Ollama are.

JVM heaps are capped for a resource-constrained dev host: Elasticsearch
512m/1g limit, Logstash 256m/768m limit, Kibana Node `--max-old-space-size`
512m/768m limit, Filebeat 256m limit. Elasticsearch's first boot builds
~90 built-in index templates and can take several minutes on a slow host —
the healthcheck budget is generous (up to ~17 minutes) specifically for that
cold start; a warm restart is seconds.

## Retention and Archiving

One ILM policy ties both together, `smartbreeds-logs`
(`setup/ilm-policy.json`):

| Phase | Trigger | Action |
|---|---|---|
| hot | — | rollover at 1 day or 1GB primary shard |
| warm | 2 days | force-merge to 1 segment |
| delete | 30 days | **wait for a snapshot to exist, then delete** |

The `wait_for_snapshot` action in the delete phase is what makes this
"retention *and* archiving" rather than two disconnected policies — an index
is never deleted before it has been captured. The SLM policy
`smartbreeds-logs-snapshots` (`setup/slm-policy.json`) runs daily at 01:30
into a filesystem repository (`elk-snapshots` volume), retaining 60 days
(min 5 / max 50 snapshots).

```bash
# Trigger a snapshot on demand instead of waiting for 01:30
docker exec ft_transcendence_elasticsearch curl -s --cacert config/certs/ca/ca.crt \
  -u "elastic:$(grep ^ELASTIC_PASSWORD= .env | cut -d= -f2-)" \
  -X POST https://localhost:9200/_slm/policy/smartbreeds-logs-snapshots/_execute
```

## Security

- **TLS everywhere**: Elasticsearch's HTTP and transport layers, Kibana's
  server, and the Filebeat→Logstash beats connection all use certificates
  signed by a CA generated at first boot (`setup/entrypoint.sh` step 1),
  shared via the `elk-certs` volume. Self-signed, dev-only — the same trust
  model nginx already uses in this repo.
- **Per-component least privilege**: `elastic` (superuser, for you/Kibana
  login), `kibana_system` (built-in, Kibana's own ES connection),
  `logstash_writer` (custom role: cluster `monitor` plus
  `write`/`create_index`/`auto_configure` on `logs-smartbreeds-*` only —
  nothing else).
- **Dev-only simplification**: cert files are `chmod a+rX` rather than
  chowned per-image UID, because Elasticsearch/Kibana/Logstash's default
  container users don't share a UID/GID scheme. Tighten this with per-image
  ownership if this ever runs anywhere but a local dev box.

## Configuration

Nothing to configure by hand. `make elk` (`scripts/init-elk.sh`) generates
four secrets into the root `.env` the first time it runs, and reuses them on
every subsequent run:

| Variable | Length | Purpose |
|---|---|---|
| `ELASTIC_PASSWORD` | 24 | Superuser — the Kibana login `make elk` prints |
| `KIBANA_SYSTEM_PASSWORD` | 24 | Built-in `kibana_system` user |
| `LOGSTASH_WRITER_PASSWORD` | 24 | Custom `logstash_writer` user |
| `KIBANA_ENCRYPTION_KEY` | 32 | Kibana saved-object encryption (Kibana rejects anything shorter — see Gotchas) |

See `.env.example` in this directory for more detail. `STACK_VERSION`
(default `8.17.0`) is a Makefile variable, not an env var — override with
`make elk STACK_VERSION=8.16.0` if ever needed.

## Running

```bash
make elk              # the one command: generate creds, start, provision, print creds
make elk-creds         # reprint the credentials without redeploying
make logs-elasticsearch / make logs-kibana / make logs-logstash / make logs-filebeat
make exec-elasticsearch   # shell into ft_transcendence_elasticsearch
```

`make all` (`build up elk show logs`) brings up the whole platform including
ELK; `make up` alone never touches it, so the default dev loop stays light.
`make down` / `make downv` / `make purge` tear ELK down along with everything
else regardless of which profile is currently active.

## Verification

```bash
PASS=$(grep '^ELASTIC_PASSWORD=' .env | cut -d= -f2-)

# Auth is enforced
docker exec ft_transcendence_elasticsearch curl -s -o /dev/null -w '%{http_code}\n' \
  --cacert config/certs/ca/ca.crt https://localhost:9200        # 401

# Logs are flowing
docker exec ft_transcendence_elasticsearch curl -s --cacert config/certs/ca/ca.crt \
  -u "elastic:$PASS" 'https://localhost:9200/logs-smartbreeds-default/_count'

# Policies installed
docker exec ft_transcendence_elasticsearch curl -s --cacert config/certs/ca/ca.crt \
  -u "elastic:$PASS" https://localhost:9200/_ilm/policy/smartbreeds-logs
docker exec ft_transcendence_elasticsearch curl -s --cacert config/certs/ca/ca.crt \
  -u "elastic:$PASS" https://localhost:9200/_slm/policy/smartbreeds-logs-snapshots
```

Open `https://localhost:5601` (self-signed cert, same as nginx), log in with
`elastic` / the password `make elk` printed, and check **Discover** — the
"All Logs" saved search is pre-created against the `logs-smartbreeds-*` data
view.

## Gotchas

- **`elk-setup` never exits — this is deliberate.** Elasticsearch's
  `depends_on: elk-setup: condition: service_healthy` re-verifies that
  condition on every `docker compose up`, and Compose can race a container
  that exits right as that check runs, misreporting a clean `exit 0` as
  "dependency failed to start". Keeping the container alive (`sleep
  infinity` after provisioning finishes) removes the race entirely.
  `scripts/init-elk.sh` polls for a `.setup-complete` marker file instead of
  a process exit to know provisioning is done.
- **SLM before ILM, and the snapshot repo before both.** The ILM policy's
  `wait_for_snapshot` delete-phase action references the SLM policy by name,
  and the SLM policy references the snapshot repo by name — Elasticsearch
  validates both references at creation time, so installing them in any
  other order 400s. `setup/entrypoint.sh` installs repo → SLM → ILM → index
  template, in that order, on purpose.
- **The `elk-snapshots` volume needs an explicit `chmod`.** A fresh named
  Docker volume is root-owned; Elasticsearch runs as a non-root user and
  can't write into it otherwise. `elk-setup` (which runs as root) fixes this
  during its cert-generation phase, every run — cheap and idempotent, so
  it's unconditional rather than gated on first-run state.
- **`KIBANA_ENCRYPTION_KEY` must be ≥32 characters.** Kibana's config
  validation rejects anything shorter at startup with a fatal error — this
  is the one secret generated at a different length than the other three.
- **PUT calls to Elasticsearch check the response for `"error"`.** An
  earlier version of the setup script piped every provisioning call to
  `/dev/null` and declared success unconditionally; a bad ILM/SLM install
  order failed silently and was only caught by manually re-running the
  calls. `put_es_json()` in `setup/entrypoint.sh` now fails loudly instead.
- **Kibana saved-object ndjson is fragile across versions.** The
  `migrationVersion` field (present in older exports) is rejected outright
  by Kibana 8.17's saved-objects index mapping. `kibana/dashboard.ndjson`
  uses only `coreMigrationVersion`/`typeMigrationVersion`. The import is
  best-effort — a failure logs a warning but does not fail `make elk`; the
  data view (created via a separate, more stable API call) is what actually
  matters for using Kibana.
