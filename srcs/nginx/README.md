# Nginx — Edge Reverse Proxy

Public edge of the platform. Terminates TLS, redirects plain HTTP to HTTPS, applies per-IP
rate/connection limits, serves static error pages, and reverse-proxies `/api` to the API
Gateway. The other containers that publish host ports are the API Gateway (`8001:8001`,
`docker-compose.yml:294-295`) and, in the `local` profile only, Ollama (`11434:11434`,
`docker-compose.yml:68-69`); nginx is the only one attached to both the `proxy` and
`backend-network` Docker networks. The image is
built from this directory; the server config is rendered from a template at container start by
`docker-entrypoint.sh`, which also generates a fresh self-signed certificate on every boot.

## Responsibilities

- Terminate TLS on port 443 (TLSv1.2 + TLSv1.3) — `conf.d/default.conf.template:25,36-43`
- Generate a self-signed RSA-2048 certificate for `${HOST_DOMAIN}` at every container start — `docker-entrypoint.sh:20-27`
- Render `conf.d/default.conf.template` → `/etc/nginx/conf.d/default.conf` via `envsubst` (only `${HOST_DOMAIN}` is substituted) — `docker-entrypoint.sh:16`
- Validate the rendered config (`nginx -t`) before starting the daemon — `docker-entrypoint.sh:32`
- 301-redirect every port-80 request to HTTPS — `conf.d/default.conf.template:154-163`
- Reverse-proxy `/api` to `http://api-gateway:8001` with forwarded-client headers — `conf.d/default.conf.template:73-90`
- Edge rate limiting (200 r/m per IP, burst 20, `nodelay`) on `/api` only — `conf.d/default.conf.template:18,77-78`
- Connection limiting: max 10 concurrent connections per IP — `conf.d/default.conf.template:21,29`
- Serve branded error pages for 429 and 500/502/503/504 — `conf.d/default.conf.template:52-63`, `error_pages/`
- Add CORS headers and answer `OPTIONS` preflight with 204 on `/api` — `conf.d/default.conf.template:92-107`
- Emit security headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`) — `conf.d/default.conf.template:46-50`
- Deny dotfiles and `.env` / `.git` / `.htaccess`-style paths — `conf.d/default.conf.template:139-150`
- gzip compression, `server_tokens off`, WebSocket `Connection: upgrade` map — `nginx.conf:35-62`

## Architecture

```
browser ──https:8443──▶ nginx ──/api──▶ api-gateway:8001 ──▶ auth / user / ai / recommendation
        ──http:8000───▶ nginx (301 → https)
```

| Property | Value | Source |
|----------|-------|--------|
| Container name | `ft_transcendence_nginx` | `docker-compose.yml:4` |
| Image tag | `ft_transcendence_nginx:local` | `docker-compose.yml:5` |
| Host ports | `8000 → 80`, `8443 → 443` | `docker-compose.yml:11-13` |
| Networks | `proxy` + `backend-network` | `docker-compose.yml:14-16` |
| Compose profile | none — runs in **both** `local` and `cloud` | `docker-compose.yml:3-23` |
| `depends_on` | none | `docker-compose.yml:3-23` |
| Restart policy | `on-failure` | `docker-compose.yml:17` |
| Healthcheck | `nginx -t`, 30s interval / 10s timeout / 3 retries / 30s start period | `docker-compose.yml:18-23` |
| Volumes | none (all config baked into the image) | `docker-compose.yml:3-23` |

Notes:

- The healthcheck only validates configuration **syntax**. It stays green while upstreams are down.
- There is no `depends_on`, so nginx can be up before `api-gateway`; `/api` returns 502 (rendered as `50x.html`) until the gateway is healthy.
- Only the `443` and `80` server blocks exist, and each is the sole block for its port, so it acts as the default server: requests with any `Host` header reach it regardless of `server_name ${HOST_DOMAIN}`.
- The frontend `location /` proxy block is commented out (`conf.d/default.conf.template:112-129`); nothing is proxied to a frontend container today.

## Routing Reference

| Method | Path (port 443) | Auth | Behaviour |
|--------|-----------------|------|-----------|
| any | `/health` | none | `200 "healthy\n"`, `Content-Type: text/plain`, access logging off — `:66-70` |
| any | `/api` (prefix) | delegated to API Gateway | `proxy_pass http://api-gateway:8001`, rate limited, CORS headers added — `:73-108` |
| OPTIONS | `/api` (prefix) | none | `204` preflight answered by nginx, never forwarded — `:99-107` |
| GET | `/50x.html` | none | Static error page (block is **not** `internal`, so it is directly fetchable) — `:54-56` |
| GET | `/429.html` | none | `internal` only; served when the rate limiter trips — `:60-63` |
| any | `/.` (dotfiles regex) | none | `403` deny, logging off — `:139-143` |
| any | `*.env`, `*.git`, `*.svn`, `*.htaccess`, `*.htpasswd` | none | `403` deny, logging off — `:146-150` |
| any | `/` (everything else) | none | `200` with a hardcoded JSON body advertising the API — `:132-136` |
| any | any (port 80) | none | `301 https://$host$request_uri` — `:154-163` |

### `/api` proxy details

Headers set toward the gateway (`:82-86`): `Host $host`, `X-Real-IP $remote_addr`,
`X-Forwarded-For $proxy_add_x_forwarded_for`, `X-Forwarded-Proto $scheme`,
`X-Forwarded-Host $host`.

Timeouts (`:87-89`): `proxy_connect_timeout 5s`, `proxy_send_timeout 30s`, `proxy_read_timeout 30s`.

CORS headers added on every `/api` response (`:92-96`): `Access-Control-Allow-Origin https://${HOST_DOMAIN}`,
`Allow-Methods GET, POST, PUT, DELETE, OPTIONS`, a fixed `Allow-Headers` list,
`Expose-Headers Content-Length,Content-Range`, `Allow-Credentials true`.

### Rate & connection limits

| Zone | Rate | Size | Applied where |
|------|------|------|---------------|
| `general_limit` | 200 r/m per IP | 10 MB | `location /api`, `burst=20 nodelay`, `limit_req_status 429` — `:18,77-78` |
| `api_limit` | 100 r/m per IP | 10 MB | **declared but never used** — `:16` |
| `auth_limit` | 5 r/m per IP | 10 MB | **declared but never used** — `:17` |
| `addr` (conn) | 10 concurrent per IP | 10 MB | server-level `limit_conn addr 10` — `:21,29` |

This is the outer of two rate-limiting layers; the API Gateway applies its own per-user limit
(`RATE_LIMIT_PER_MINUTE`, default 60 in `srcs/api-gateway/.env.example`).

## TLS

| Setting | Value | Source |
|---------|-------|--------|
| Certificate / key path | `/etc/nginx/ssl/selfsigned.crt` / `.key` | `conf.d/default.conf.template:36-37` |
| Generation | `openssl req -x509 -nodes -days 365 -newkey rsa:2048`, subject `/C=IY/ST=State/L=City/O=42/CN=${HOST_DOMAIN}` | `docker-entrypoint.sh:20-23` |
| File modes | `644` cert, `600` key | `docker-entrypoint.sh:26-27` |
| Protocols | TLSv1.2, TLSv1.3 | `conf.d/default.conf.template:38` |
| Ciphers | ECDHE-ECDSA/RSA AES128/256-GCM set, `ssl_prefer_server_ciphers off` | `conf.d/default.conf.template:39-40` |
| Session | `shared:SSL:10m`, 10m timeout, tickets off | `conf.d/default.conf.template:41-43` |

The certificate is **regenerated on every container start** and is not persisted to a volume,
so its fingerprint changes on each restart. The checked-in `ssl/selfsigned.crt` and
`ssl/selfsigned.key` are **not used**: the `Dockerfile` never copies `ssl/` and no volume mounts
it — the runtime files come exclusively from the entrypoint.

## Configuration

Environment comes from `env_file: ./srcs/nginx/.env` (`docker-compose.yml:9-10`), which is
gitignored. `.env.example` is the template.

| Variable | `.env.example` value | Code fallback | Purpose |
|----------|----------------------|---------------|---------|
| `HOST_DOMAIN` | `ft-transcendence.local` (`.env.example:3`) | `localhost` (`docker-entrypoint.sh:12`) | `server_name` for both server blocks, certificate CN, `Access-Control-Allow-Origin` value, and the `api_endpoint` string in the root JSON response |

`HOST_DOMAIN` is the only variable expanded into the config — `envsubst '${HOST_DOMAIN}'`
(`docker-entrypoint.sh:16`) whitelists it explicitly, so every other `$var` in the template stays
a literal nginx variable.

## Files and Image Layout

| Repo file | Destination in image | Notes |
|-----------|----------------------|-------|
| `nginx.conf` | `/etc/nginx/nginx.conf` | `Dockerfile:22` — global http block |
| `conf.d/default.conf.template` | `/etc/nginx/conf.d/default.conf.template` | `Dockerfile:23`; rendered to `default.conf` at start |
| `error_pages/` | `/usr/share/nginx/html/error_pages/` | `Dockerfile:24` — `50x.html`, `429.html`, `404.html` |
| `docker-entrypoint.sh` | `/docker-entrypoint.sh` (ENTRYPOINT) | `Dockerfile:27-28,34` |
| `ssl/` | **not copied** | Certificates are generated at runtime instead |

`error_pages/404.html` is shipped but no `error_page 404` directive references it.

Image facts (`Dockerfile`):

| Fact | Value |
|------|-------|
| Base image | `nginx:1.25-alpine` (`:5`) |
| System packages | `curl`, `openssl`, `gettext` (`:8-12`) |
| Directories created | `/etc/nginx/conf.d`, `/etc/nginx/ssl`, `/usr/share/nginx/html/error_pages`, `/var/log/nginx`, `/var/cache/nginx` (`:15-19`) |
| Ownership | `nginx:nginx` on logs, cache, html (`:31`) |
| `USER` directive | none — the master process runs as root; workers run as `nginx` per `nginx.conf:7` |
| `EXPOSE` | none in this Dockerfile |
| `HEALTHCHECK` | none in this Dockerfile (defined in compose instead) |
| Entrypoint | `/docker-entrypoint.sh` → `exec nginx -g 'daemon off;'` |

## Logging

`log_format main` (`nginx.conf:23-36`) emits one JSON object per access line (`escape=json`), with
`request_time`, `upstream_addr` and `upstream_response_time` fields for separating nginx latency
from gateway latency. Both `access_log` and `error_log` go to `/dev/stdout` / `stderr`
(`nginx.conf:9,39`), the same as every other service — no per-vhost files, no log volume. This
also means the container's logs are picked up by the ELK stack (`make elk`) with no grok pattern
needed on the nginx side.

## Running

```bash
make up                          # whole stack, default profile from the Makefile / root .env
docker compose up nginx -d       # this container only
docker compose build nginx       # required after ANY change under srcs/nginx (config is baked in)
make logs-nginx                  # docker compose logs -f nginx
make exec-nginx                  # shell into ft_transcendence_nginx
```

- Runs in both compose profiles; no GPU, no profile gating.
- For `/api` to work, `api-gateway` must be up and reachable on `backend-network`.
- There are **no volume mounts**: editing `nginx.conf`, `conf.d/default.conf.template`, the
  entrypoint or the error pages requires `docker compose build nginx` followed by
  `docker compose up -d nginx`. A plain `restart` re-runs the entrypoint but keeps the old files.

## Testing

This directory contains no automated test suite (no test files exist under `srcs/nginx`).
Manual verification, using the published host ports from `docker-compose.yml:11-13`:

```bash
# Config syntax (same command the compose healthcheck runs)
docker exec ft_transcendence_nginx nginx -t

# TLS endpoint (-k: the certificate is self-signed)
curl -k https://localhost:8443/health          # -> healthy
curl -k https://localhost:8443/                # -> the hardcoded API-info JSON

# HTTP -> HTTPS redirect
curl -I http://localhost:8000/                 # -> 301, Location: https://localhost/

# Proxy path (needs api-gateway up)
curl -k -i https://localhost:8443/api/v1/auth/login \
     -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# Rate limiter (200 r/m, burst 20) -> expect 429 + the 429.html body
for i in $(seq 1 60); do curl -k -s -o /dev/null -w '%{http_code}\n' https://localhost:8443/api/v1/auth/login; done

# Rendered config actually in use
docker exec ft_transcendence_nginx cat /etc/nginx/conf.d/default.conf

# Per-vhost logs (not on stdout)
docker exec ft_transcendence_nginx tail -f /var/log/nginx/api_access.log
```

## Troubleshooting

| Symptom | Cause | Where |
|---------|-------|-------|
| `502` on `/api`, rendered as `50x.html` | `api-gateway` down or not on `backend-network` | `conf.d/default.conf.template:53,81` |
| `504` after ~30s on `/api/v1/vision/analyze` | `proxy_read_timeout 30s` at the edge, while the gateway allows 300s for `/api/v1/vision` (`srcs/api-gateway/routes/proxy.py:16-18`) and the AI service uses `LLM_TIMEOUT=300` (`srcs/ai/src/config.py:17`). Long LLM inference cannot complete through nginx | `conf.d/default.conf.template:89` |
| `429` with the styled page | `general_limit` 200 r/m per IP, burst 20 | `:18,77-78` |
| `503` with no upstream in the log | `limit_conn addr 10` — more than 10 concurrent connections from one IP (nginx's default `limit_conn_status` is 503, which the `error_page 500 502 503 504` rule renders as `50x.html`) | `:29,53` |
| HTTP redirect lands on the wrong port | `return 301 https://$host$request_uri` targets the default 443, but the host mapping is `8443:443` | `:162`, `docker-compose.yml:13` |
| Browser CORS error on `/api` from `https://localhost:8443` | nginx sends `Access-Control-Allow-Origin: https://${HOST_DOMAIN}`, and the API Gateway independently sets its own CORS headers for its whitelist (`http://localhost:5173`, `http://localhost:3000`, `https://smartbreeds.local` — `srcs/api-gateway/main.py:71-75`). Mismatched or duplicated `Access-Control-Allow-Origin` headers are rejected by browsers | `:92-96` |
| Security headers missing on `/api` responses | `add_header` in `location /api` replaces the inherited server-level `add_header` set; nginx only inherits when the inner level declares none | `:46-50` vs `:92-96` |
| New TLS warning after every restart | The certificate is regenerated by the entrypoint on each start and never persisted | `docker-entrypoint.sh:20-23` |
| Config edits appear to have no effect | Config is baked into the image; no bind mounts. Rebuild the image | `Dockerfile:22-24` |
| Container reports healthy while everything 502s | The healthcheck is `nginx -t` (syntax only) | `docker-compose.yml:19` |
| `404` returns nginx's built-in page | `error_pages/404.html` is not wired to any `error_page` directive | `conf.d/default.conf.template:52-63` |
| Container exits at startup | The entrypoint runs `set -e` then `nginx -t`; a template that renders to invalid config aborts the boot. Read the startup output: `docker compose logs nginx` | `docker-entrypoint.sh:9,32` |
