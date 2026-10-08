# ELK — Log Management Stack

Elasticsearch + Logstash + Kibana + Vector, started with a single command
(`make elk`) and requiring **no manual configuration**: certificates, service
accounts, retention policy, archiving policy and the Kibana data view are all
generated and installed by a one-shot setup container the first time the
stack comes up. Credentials are random, generated into the gitignored root
`.env`, and printed to the terminal — this is a development-environment
convenience, not a production credential-management story.

Every container log on the host — from every service, in every compose
profile — is picked up automatically. Nothing needs to be pointed at ELK
per-service, and no service changes its log driver: Vector reads the logs
Docker already keeps, over the Docker API. That last part matters. This stack
originally used Filebeat, which harvested
`/var/lib/docker/containers/*/*.log` from the host — a path that only holds
anything when the daemon's data root is on that same filesystem, i.e. a
native Linux Docker Engine. Under Docker Desktop the engine keeps those files
inside its own VM, the bind mount resolved to an empty directory, and
Filebeat ran with zero harvesters while looking perfectly healthy. Reading
the API instead works on both, and leaves `docker logs` / `make logs`
untouched — which switching to the `gelf` log driver would not.

## Architecture

```
                    ┌─────────────┐
 all containers ──▶ │   Vector    │  reads container logs over the Docker
 (stdout/stderr)    │ (docker_logs│  API (json-file driver left in place, so
                    │  source)    │  `docker logs` still works), reshapes to
                    └──────┬──────┘  message + container.name / image
                           │ newline-delimited JSON over TCP, TLS
                           ▼
                    ┌─────────────┐
                    │  Logstash   │  normalises every service onto one
                    │             │  schema (service, level, http.*, url.*)
                    │             │  and redacts OAuth/token query params
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
                    │             │  data view, 4 dashboards, 4 saved searches
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
| `vector` | `ft_transcendence_vector` | Log shipper — reads every container's logs over the Docker API | none |

All five run under the `elk` compose profile only — `make up` never starts
them. All are on `backend-network`, matching every other backend service in
this repo; Kibana is the one exception published to the host, by explicit
request, the same way the API Gateway and Ollama are.

JVM heaps are capped for a resource-constrained dev host: Elasticsearch
512m/1g limit, Logstash 256m/768m limit, Kibana Node `--max-old-space-size`
512m/768m limit, Vector 256m limit. Elasticsearch's first boot builds
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
into a filesystem repository (`backups/elasticsearch/`, a host bind mount so `make downv`
keeps it — see `docs/DISASTER_RECOVERY.md`), retaining 60 days
(min 5 / max 50 snapshots).

```bash
# Trigger a snapshot on demand instead of waiting for 01:30
docker exec ft_transcendence_elasticsearch curl -s --cacert config/certs/ca/ca.crt \
  -u "elastic:$(grep ^ELASTIC_PASSWORD= .env | cut -d= -f2-)" \
  -X POST https://localhost:9200/_slm/policy/smartbreeds-logs-snapshots/_execute
```

## Security

- **TLS everywhere**: Elasticsearch's HTTP and transport layers, Kibana's
  server, and the Vector→Logstash connection all use certificates
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
make logs-elasticsearch / make logs-kibana / make logs-logstash / make logs-vector
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
`elastic` / the password `make elk` printed, and open **Dashboards** — the four
`SmartBreeds · …` dashboards below are pre-created. **Discover** has the saved
searches against the `logs-smartbreeds-*` data view.

## Dashboards

Provisioned by `elk-setup` on every run (`overwrite=true`), from
`kibana/dashboard.ndjson`. That file is **generated** — edit
`kibana/build_dashboards.py` (stdlib Python) and re-run it, never the ndjson:

```bash
python3 srcs/elk/kibana/build_dashboards.py   # rewrites kibana/dashboard.ndjson
make elk                                       # re-imports
```

| Dashboard | Answers | Filter controls |
|---|---|---|
| SmartBreeds · Platform Overview | volume, errors and warnings per service; latest problem lines | service, level |
| SmartBreeds · HTTP Traffic | edge requests by status class, latency p50/p95/p99, top endpoints and clients, slowest gateway routes | method, status class, path |
| SmartBreeds · Security & Auth | login successes/failures, 401/403/429 over time, routes and clients that get rejected, active users | status, client IP |
| SmartBreeds · AI Pipeline | vision analyses by outcome (422 = image rejected), latency, classification stages, LLM calls via LiteLLM | service |

Saved searches (Discover, also embedded in the dashboards): *All Logs*,
*Errors & Warnings*, *Security Events*, *AI Pipeline Problems*. Status colours
are fixed across every panel: 2xx green, 3xx grey, 4xx amber, 5xx red; levels
INFO grey, WARNING amber, ERROR orange, CRITICAL red.

### The log schema the dashboards query

Every service logs in its own shape (JSON from nginx and the gateway, uvicorn
and Django access lines, Python logging, PostgreSQL, Redis). `logstash/pipeline.conf`
maps them all onto these fields — its header comment is the reference:

| Field | Values |
|---|---|
| `service` | compose name from the container: `api-gateway`, `nginx`, `db`, … |
| `level` | `DEBUG` `INFO` `WARNING` `ERROR` `CRITICAL`. For access lines it is derived from the status (5xx → ERROR, 4xx → WARNING), whatever the logger printed |
| `log_type` | `access` (one line per HTTP request) or `app` |
| `http.layer` | `edge` (nginx), `gateway` (the gateway's JSON request log), `service` (a backend's own access line) |
| `http.method` `http.status` `http.status_class` `http.duration_ms` | `http.duration_ms` is set for `edge` and `gateway` only |
| `url.path` / `url.original` | path without / with the query string |
| `client.ip` `user.id` `healthcheck` | `healthcheck: true` for `/health*` probes |

One request is logged once **per layer it crosses** — nginx, then the
gateway, then the backend — so a panel that counts requests must pin one
`http.layer`, or it counts the same request two or three times. The
dashboards use `edge` for user-facing traffic and `gateway` for per-route
latency and user IDs, and exclude `healthcheck:true`.

Query strings are scrubbed before storage: `code`, `state`, `token`,
`access_token`, `refresh_token` and `mfa_token` values become `[REDACTED]`
(the 42 OAuth callback carries a one-time code and the CSRF state).

## Status page (Heartbeat)

`heartbeat` (same `elk` profile) probes every service on the schedule in
`heartbeat/heartbeat.yml` and writes one document per check into `heartbeat-*`.
The application services are probed on **`/health/ready`**, which round-trips to
Postgres (`SELECT 1`; auth, user, recommendation) or Redis (`PING`; gateway) and
answers 503 when it can't — the database heartbeat. Their Docker healthchecks
deliberately stay on the shallow `/health`: a database blip must not mark every
container unhealthy and wedge `depends_on` / `up --wait`.

Two views over the same data:

- **Dashboards → SmartBreeds · Service Status** (generated, `build_dashboards.py`):
  availability, failed checks, p95 response time per monitor, and the Postgres
  backup runs (`BACKUP_VERIFY OK/FAILED` lines from `db-backup`).
- **Observability → Uptime**: Elastic's own app. Deprecated since 8.15 and
  hidden without recent data, so elk-setup turns on
  `observability:enableLegacyUptimeApp`. Elastic's successor, the Synthetics
  app, needs Fleet Server + Elastic Agent private locations — not worth a
  second agent system for the same up/down data.

`elk-setup` provisions the `heartbeat_writer` user (publish + set up its own
`heartbeat-*` template only), the `heartbeat` ILM policy (rollover daily, delete
after 14 days — installed *before* Heartbeat starts, which waits for it, or
Heartbeat would install its never-delete default) and the `heartbeat-*` data view.
To add a monitor: edit `heartbeat.yml`, then `docker compose restart heartbeat`.

## Gotchas

- **Logstash waits for its own credentials before starting.** Elasticsearch
  being healthy does not mean `logstash_writer` exists: `elk-setup` creates it
  only after Elasticsearch is up, at the same time Logstash starts. A Logstash
  that won that race got a 401, exited, crash-looped into Docker's restart
  backoff, and `vector` failed with "dependency failed to start". The compose
  `entrypoint` now polls Elasticsearch as `logstash_writer` and only then
  `exec`s the image's own `docker-entrypoint`.
- **Disk watermarks are absolute (2gb / 1gb / 512mb free).** The default 85/90/95 %
  thresholds hit on any dev disk that is 90 % full even with gigabytes free.
  Past the high watermark Elasticsearch refuses to allocate the `.security`
  index, every user/password call answers `unavailable_shards_exception`, and
  provisioning used to hang for ~12 minutes before failing with a misleading
  "password out of sync" message. `setup/entrypoint.sh` now detects an
  unassignable shard, prints Elasticsearch's own allocation explanation and
  exits.
- **Vector mounts the socket of the daemon in use** (`DOCKER_SOCK`, set by
  `scripts/init-elk.sh` from `docker context inspect`). Under rootless Docker
  that is `/run/user/<uid>/docker.sock`; `/var/run/docker.sock` would belong
  to a different daemon running none of these containers.
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
- **The snapshot directory needs an explicit `chmod`.** A bind-mount source
  Docker creates is root-owned; Elasticsearch runs as a non-root user and
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
  by Kibana 8.17's saved-objects index mapping. The generated ndjson uses only
  `coreMigrationVersion`/`typeMigrationVersion`, set to what 8.17 stamps
  (dashboard 10.2.0, lens 8.9.0, search 10.5.0). The import now **fails
  `make elk`** when Kibana reports any per-object error: curl only fails on
  transport errors, so the old "best-effort" import reported success no
  matter what Kibana answered.
- **Lens panels are by reference, not by value.** Lens embedded by value in
  an imported dashboard stayed on "loading" forever in 8.17 — no error
  anywhere — while the identical state opened fine in the Lens editor. Each
  chart is therefore its own `lens` saved object (`<dashboard-id>-pN`, also
  listed in the Visualize Library) that the dashboard references.
- **"Something went wrong while fetching SLOs — Forbidden".** SLOs are a
  Platinum feature and this cluster runs the free basic license, so the SLO
  API answers 403 "Platinum license or higher is needed". `elk-setup` hides
  the `slo` feature in the default space. Not `xpack.slo.enabled: false`:
  the Logs Explorer plugin lists `slo` as a required plugin, so disabling it
  takes Logs Explorer down too.
- **A mapping change needs a rollover, and the probe is `_meta.schema_version`.**
  The index template only applies to indices created after it. `elk-setup`
  rolls the data stream over when the write index's `_meta.schema_version`
  differs from `setup/index-template.json` — **bump it with every mapping
  change**. Probing for a field instead raced: Logstash, restarted with the
  new pipeline, had already written the new fields into the old index with
  dynamic `text` mappings. Those documents stay behind in the old backing
  index, and since Kibana merges the mappings of every index behind the data
  view, a field that is `keyword` in one index and `text` in another can no
  longer be aggregated until that index ages out (30 days). On a dev cluster
  delete the old backing index (`DELETE .ds-logs-smartbreeds-default-…-000001`)
  or `make downv`; a fresh install never meets this.
