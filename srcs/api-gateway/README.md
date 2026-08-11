# API Gateway

The API Gateway is the single entry point of the SmartBreeds platform. It is a FastAPI application that
validates the RS256 JWT carried in the `access_token` HTTP-only cookie, applies per-user/per-IP rate
limiting backed by Redis, injects user-context headers, and reverse-proxies every `/api/*` request to
whichever backend service owns the path prefix. It owns no database and no persisted state; backend
services (auth, user, ai, recommendation) publish no host port, so the gateway is the only way in.

---

## Responsibilities

- **Authenticate** — decode/verify the JWT from the `access_token` cookie using the RSA **public key only**
  (`auth/jwt_utils.py:9`, key loaded once at import in `config.py:46`). The gateway cannot mint tokens.
- **Inject user context** — `X-User-ID`, `X-User-Role`, `X-Request-ID`, `X-Correlation-ID`
  (`middleware/auth_middleware.py:57-62`); backend services trust these headers because they are only
  reachable on `backend-network`.
- **Rate limit** — fixed 60-second counter per `user_id` (authenticated) or per client IP
  (`middleware/rate_limit.py:27-72`).
- **Route** — longest-prefix-free `startswith` match against `SERVICE_ROUTES` (`routes/proxy.py:40-48`).
  Backend services can add endpoints under an already-routed prefix without touching the gateway.
- **Shape errors** — every failure the gateway itself produces is emitted in the platform's standard
  envelope (`utils/responses.py:27`, handlers in `main.py:20-66`).
- **Log** — one structured line per request with duration, status, client IP and user id
  (`middleware/logging_middleware.py:44-55`).

---

## Architecture

```
host:8000 ─┐                        proxy-network
host:8443 ─┴─> nginx ──────────────────────┐
                                           │  backend-network
host:8001 ────────────────────────> api-gateway ──┬─> auth-service:3001
                                           │      ├─> user-service:3002
                                        redis:6379├─> ai-service:3003
                                    (rate counters)└─> recommendation-service:3005
```

| Fact | Value | Source |
|------|-------|--------|
| Container name | `ft_transcendence_api_gateway` | `docker-compose.yml:287` |
| Image | `ft_transcendence_api_gateway:local` | `docker-compose.yml:288` |
| Host port | `8001:8001` | `docker-compose.yml:294-295` |
| Networks | `backend-network` **only** | `docker-compose.yml:304-305` |
| Compose profiles | none declared → runs in both `local` and `cloud` | `docker-compose.yml:286-317` |
| `depends_on` | `auth-service` + `user-service`, `condition: service_healthy` | `docker-compose.yml:313-317` |
| Healthcheck | `curl -f http://localhost:8001/health`, 30s/10s/3, 30s start period | `docker-compose.yml:307-312` |

**Nginx is what bridges the networks**, not the gateway: nginx is on `proxy` + `backend-network`
(`docker-compose.yml:14-16`) and proxies `location /api` to `http://api-gateway:8001`
(`srcs/nginx/conf.d/default.conf.template:81`). Host-facing entry points are therefore
`http://localhost:8001` (direct, dev/testing) and `https://localhost:8443` / `http://localhost:8000`
(through nginx; `docker-compose.yml:11-13`).

Callers observed in the repo: nginx, `srcs/recommendation-service/tests/integration/*` (`http://api-gateway:8001`),
and the notebooks in `scripts/jupyter/` (`http://localhost:8001`).

### Middleware order (this is inverted from the registration order)

Registration in `main.py` is CORS (69) → Logging (83) → RateLimit (86) → JWTAuth (92). Starlette's
`add_middleware` pushes onto the front of the stack, so the **last registered runs first**:

```
request  ──> JWTAuth ──> RateLimit ──> Logging ──> CORS ──> router (/health | /api/{path:path})
response <──────────────────────────────────────────────────┘
```

Consequences that matter:

- Rate limiting can key on `request.state.user_id` because auth already ran
  (asserted by `tests/test_rate_limit.py:66-84`).
- A 401 from auth or a 429 from the rate limiter **never reaches `CORSMiddleware`**, so those responses
  carry no `Access-Control-*` headers, and a browser preflight (`OPTIONS`, sent without cookies) to any
  non-public path is answered with 401.
- The comment on `main.py:85` ("before auth") describes the registration order, not the execution order.

---

## API Reference

### Routes the gateway owns

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | no | Liveness probe (`main.py:101`) |
| `GET` | `/docs` | no | Swagger UI (FastAPI default; public per `middleware/auth_middleware.py:24`) |
| `GET` | `/openapi.json` | no | OpenAPI schema (public per `middleware/auth_middleware.py:25`) |
| `GET` | `/redoc` | **yes** | FastAPI default page, *not* in the public set → 401 without a cookie |
| `GET POST PUT DELETE PATCH` | `/api/{path:path}` | yes, except the public auth paths | Catch-all proxy (`routes/proxy.py:159`) |

`HEAD` and `OPTIONS` are not in the catch-all's method list, so a cookie-carrying `OPTIONS /api/...`
without `Access-Control-Request-Method` is a 405 from the router. A real preflight is short-circuited by
`CORSMiddleware` instead — but only on public paths, since `JWTAuthMiddleware` 401s cookieless requests
before CORS runs.

**`GET /health`** — 200, unauthenticated, not rate-limit exempt:

```json
{"status": "healthy", "service": "api-gateway", "timestamp": "2026-08-10T12:00:00.000000"}
```

The OpenAPI schema only describes `/health` and the catch-all, so `/docs` is not a usable index of
backend endpoints.

### Public paths (exact string match)

`middleware/auth_middleware.py:22-29`, compared with `request.url.path in self.public_endpoints`
(`:33`) — an **exact** match. `request.url.path` excludes the query string, so `/health?x=1` still
matches, but `/health/` does not, and prefixes never do:

```
/health   /docs   /openapi.json
/api/v1/auth/login   /api/v1/auth/register   /api/v1/auth/refresh
```

Everything else, including `/api/v1/auth/logout`, `/api/v1/auth/verify`, `/api/v1/auth/delete` and
`/api/v1/auth/change-password`, requires a valid `access_token` cookie.

### Prefix routing table

`routes/proxy.py:40-48`. The URLs come from required settings; the values below are the `.env.example`
defaults, not live config.

| Path prefix | Setting | `.env.example` target | Owner |
|-------------|---------|----------------------|-------|
| `/api/v1/auth` | `AUTH_SERVICE_URL` | `http://auth-service:3001` | auth-service |
| `/api/v1/users` | `USER_SERVICE_URL` | `http://user-service:3002` | user-service |
| `/api/v1/pets` | `USER_SERVICE_URL` | `http://user-service:3002` | user-service |
| `/api/v1/vision` | `AI_SERVICE_URL` | `http://ai-service:3003` | ai-service |
| `/api/v1/recommendations` | `RECOMMENDATION_SERVICE_URL` | `http://recommendation-service:3005` | recommendation-service |
| `/api/v1/admin/products` | `RECOMMENDATION_SERVICE_URL` | `http://recommendation-service:3005` | recommendation-service |

Anything under `/api/` that matches no prefix returns 404 `NOT_FOUND` from
`get_backend_service_url` (`routes/proxy.py:67-70`). Currently unreachable through the gateway for that
reason:

- `/api/v1/analyses*` — registered in user-service (`srcs/user-service/apps/profiles/urls.py`) but absent
  from `SERVICE_ROUTES`.
- `/api/v1/rag*` and `/api/v1/admin/rag*` — ai-service internals, deliberately not exposed
  (`routes/proxy.py:38,45`).

### What the gateway does to a request

| Step | Behaviour | Source |
|------|-----------|--------|
| Headers | all inbound headers forwarded, `host` removed | `routes/proxy.py:94-95` |
| Cookies | `cookie` header **stripped** unless the path starts with `/api/v1/auth` | `routes/proxy.py:98-99` |
| Context | `X-User-ID`, `X-User-Role`, `X-Request-ID`, `X-Correlation-ID` merged in — only present for authenticated requests | `auth_middleware.py:57-62`, `proxy.py:91,102` |
| Body | read and forwarded for `POST`/`PUT`/`PATCH` only; a `DELETE` body is dropped | `routes/proxy.py:109-110` |
| Query | `dict(request.query_params)` — repeated keys collapse to the last value | `routes/proxy.py:125` |
| Timeout | 30 s default, 300 s for paths under `/api/v1/vision` | `routes/proxy.py:13,16-18,113-116` |

### What the gateway does to a response

- Backend status code, body bytes and **raw headers** are copied verbatim through `ProxyResponse`
  (`routes/proxy.py:21-35,244-248`); the custom class exists so multiple `Set-Cookie` headers survive.
- `text/html` **404** responses are rewritten to a JSON `NOT_FOUND` envelope (`routes/proxy.py:188-203`).
- `text/html` **500** responses are rewritten to `NOT_FOUND` (404) when the body contains `Not Found`
  or `DoesNotExist`, otherwise to `INTERNAL_ERROR` (500) (`routes/proxy.py:206-241`).
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` (`middleware/rate_limit.py:64-68`) and `X-Request-ID`
  (`middleware/logging_middleware.py:58`) are appended on the way out.

### Error envelope

```json
{
  "success": false,
  "data": null,
  "error": {"code": "ERROR_CODE", "message": "…", "details": {}},
  "timestamp": "2026-08-10T12:00:00.000000"
}
```

| Status | `error.code` | Raised by |
|--------|-------------|-----------|
| 401 | `UNAUTHORIZED` | missing / expired / invalid-signature cookie — `middleware/auth_middleware.py:71-85` |
| 404 | `NOT_FOUND` | unmatched path prefix, or backend HTML 404 — `main.py:44`, `routes/proxy.py:188` |
| 422 | `VALIDATION_ERROR` | FastAPI request-validation failure — `main.py:32` |
| 429 | `RATE_LIMIT_EXCEEDED` | quota exhausted; adds `Retry-After` — `middleware/rate_limit.py:74-101` |
| 500 | `INTERNAL_ERROR` | unhandled exception, or backend HTML 500 — `main.py:56`, `routes/proxy.py:227` |
| 503 | `HTTP_ERROR` | backend unreachable (`httpx.RequestError`) — see note below |

Note on `timestamp`: envelopes produced by `main.py`'s handlers go through `error_response()`, whose model
declares `timestamp: str = datetime.utcnow().isoformat()` as a class-level Pydantic default
(`utils/responses.py:16`). That expression is evaluated once when the module is imported, so those bodies
report the worker's start time rather than the time of the error. The envelopes built inline by the
middlewares and by `routes/proxy.py` compute `utcnow()` per request and are accurate.

Note on 503: `routes/proxy.py:146-157` raises `HTTPException(503, detail={…"code": "SERVICE_UNAVAILABLE"…})`
with a **dict** detail, while the generic handler at `main.py:20-30` stringifies any non-`str` detail. The
client therefore receives `error.code = "HTTP_ERROR"` and a Python-repr of the intended payload in
`error.message`. The 404 path is unaffected because Starlette resolves `HTTPException` by status code
first and `main.py:44` registers a dedicated 404 handler.

---

## Data Model

Stateless — no database, no migrations, no ORM. The only persisted structure is the Redis counter used
for rate limiting (`middleware/rate_limit.py:33,37,45`):

| Key | Value | TTL |
|-----|-------|-----|
| `rate_limit:user:{user_id}` | integer request count in the current window | 60 s (`:25,45`) |
| `rate_limit:ip:{client_ip}` | same, for requests with no resolved user | 60 s |

It is a **fixed** window, not a sliding one: the first request of a window does `SETEX key 60 1`, later
requests `INCR`, and the key simply expires.

---

## Configuration

Loaded by pydantic-settings from process env first, then `./.env` (`config.py:29-33`, `case_sensitive=True`).
In Docker the values come from `env_file: ./srcs/api-gateway/.env` (`docker-compose.yml:292-293`).

| Variable | Required | Default in `config.py` | `.env.example` value | Purpose |
|----------|----------|------------------------|----------------------|---------|
| `JWT_PUBLIC_KEY_PATH` | **yes** | none (`:14`) | `/app/keys/jwt-public.pem` | RSA public key read at import (`:46`); missing file → `FileNotFoundError` at startup |
| `JWT_ALGORITHM` | no | `RS256` (`:15`) | `RS256` | Passed to `JWTAuthMiddleware` (`main.py:95`), which hands it to `jwt.decode` (`auth/jwt_utils.py:27-31`) |
| `AUTH_SERVICE_URL` | **yes** | none (`:18`) | `http://auth-service:3001` | Routing target |
| `USER_SERVICE_URL` | **yes** | none (`:19`) | `http://user-service:3002` | Routing target |
| `AI_SERVICE_URL` | **yes** | none (`:20`) | `http://ai-service:3003` | Routing target |
| `RECOMMENDATION_SERVICE_URL` | **yes** | none (`:21`) | `http://recommendation-service:3005` | Routing target |
| `REDIS_URL` | no | `redis://redis:6379/0` (`:24`) | `redis://redis:6379/0` | Rate-limit store (`middleware/rate_limit.py:10`) |
| `RATE_LIMIT_PER_MINUTE` | no | `60` (`:27`) | `60` | Requests per 60 s window (`main.py:88`) |
| `PORT` | no | `8001` (`:8`) | `8001` | **Declared but never read** — the port is hardcoded in `Dockerfile:21` |
| `HOST` | no | `0.0.0.0` (`:9`) | `0.0.0.0` | Declared but never read |
| `DEBUG` | no | `False` (`:10`) | `false` | Declared but never read |
| `LOG_LEVEL` | no | `info` (`:11`) | `info` | Declared but never read; logging is fixed at INFO (`middleware/logging_middleware.py:10`) |

Values not in `.env`:

- **CORS origins** are hardcoded in `main.py:71-75`: `http://localhost:5173`, `http://localhost:3000`,
  `https://smartbreeds.local`; credentials allowed, all methods/headers allowed, exposed headers
  `X-Request-ID`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` (`main.py:76-79`).
- **Public endpoint set** is hardcoded in `middleware/auth_middleware.py:22-29`.
- **Per-service timeouts** are hardcoded in `routes/proxy.py:16-18`.

The public key reaches the container through a read-only bind mount of the auth-service key,
`./srcs/auth-service/keys/jwt-public.pem:/app/keys/jwt-public.pem:ro` (`docker-compose.yml:303`).

---

## Running

```bash
# whole platform (profile comes from COMPOSE_PROFILES; the gateway runs under both)
make up

# just the gateway and its declared dependencies (auth-service, user-service, db)
docker compose up api-gateway -d

# rebuild after changing anything except routes/ and tests/
docker compose build api-gateway && docker compose up -d api-gateway

docker compose logs -f api-gateway     # or: make logs-api-gateway
docker exec -it ft_transcendence_api_gateway /bin/sh
```

Prerequisites: `srcs/auth-service/keys/jwt-public.pem` must exist (generated by
`srcs/auth-service/keys/generate-keys.sh`), and `auth-service` + `user-service` must report healthy —
compose blocks the gateway on them (`docker-compose.yml:313-317`). `redis` is **not** a declared
dependency and `redis.from_url` connects lazily, so the gateway starts without it; rate limiting just
fails open.

Smoke test:

```bash
curl http://localhost:8001/health
curl -k https://localhost:8443/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"…","password":"…"}'
```

### Image facts (`Dockerfile`)

| | |
|---|---|
| Base | `python:3.11-slim` (`:1`) |
| System deps | `curl` (needed by the healthcheck) (`:6`) |
| Python deps | `requirements.txt`, installed at build time (`:9-10`) |
| App code | `COPY . .` — the whole build context, `.env` included (there is no `.dockerignore`) (`:13`) |
| User | non-root `gateway`, uid 1000 (`:16-17`) |
| Exposed port | 8001 (`:19`) |
| CMD | `uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4` (`:21`) — no `--reload` |

`main.py` at the repo-root level of the service is the live entry point. The `src/` directory is empty
and is only there because `docker-compose.yml:298` bind-mounts `./srcs/api-gateway/src` to `/app/src`;
nothing imports it and it is not tracked by git.

---

## Testing

Layout is flat — `tests/*.py`, no `unit/` or `integration/` subdirectories. **30 tests.**

```bash
# all 30 (works even when the container is not running)
docker compose run --rm api-gateway python -m pytest tests/ -v

# skip starting auth-service/user-service/db first
docker compose run --rm --no-deps api-gateway python -m pytest tests/ -v

# one file / one test (container must be running)
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py -v
docker exec ft_transcendence_api_gateway python -m pytest tests/test_proxy.py::test_proxy_forwards_to_auth_service -v

# coverage (pytest-cov is NOT in requirements.txt — install it first)
docker exec ft_transcendence_api_gateway pip install pytest-cov
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=term
```

| File | Tests | Covers |
|------|-------|--------|
| `tests/test_auth_middleware.py` | 4 | valid / missing / expired cookie, `/health` bypass — against a standalone app carrying only `JWTAuthMiddleware` |
| `tests/test_config.py` | 3 | settings load from env, required attributes present, public key readable |
| `tests/test_cors.py` | 3 | preflight on `/health`: allow-origin, allow-credentials, allow-headers |
| `tests/test_error_handling.py` | 5 | 404 on unrouted prefix, 404 on unknown API version, 401 before route resolution, envelope shape on a malformed login body (asserts only the `success`/`error` keys — the call is unmocked, so it actually 503s); one empty placeholder (`test_500_returns_standardized_error`) |
| `tests/test_health.py` | 2 | status code and body shape |
| `tests/test_jwt_utils.py` | 4 | decode valid, expired, wrong key, malformed |
| `tests/test_logging.py` | 3 | request logged, duration logged, `user_id` + `X-Request-ID` on a proxied call |
| `tests/test_proxy.py` | 3 | routing to auth-service and user-service, context headers on the outbound call |
| `tests/test_rate_limit.py` | 3 | under-limit passthrough + headers, 429 body shape, user-keyed counter |

`scripts/run-unit-tests.sh --gateway` runs the same command but prints a stale hardcoded count of 28
(`scripts/run-unit-tests.sh:107-109`); the number is cosmetic and is not asserted.

`tests/conftest.py` generates a fresh 2048-bit RSA pair per session, writes the public key to a temp file
and exports `JWT_PUBLIC_KEY_PATH`, `JWT_ALGORITHM`, `AUTH_SERVICE_URL`, `USER_SERVICE_URL`,
`AI_SERVICE_URL`, `REDIS_URL`, `RATE_LIMIT_PER_MINUTE=100` before `config` is imported. It does **not**
set `RECOMMENDATION_SERVICE_URL`, so that one still has to come from the container environment — running
pytest on the host without it fails at import with a pydantic `ValidationError`.

`pytest.ini` sets `asyncio_mode = auto` and `--strict-markers`, and registers an `integration` marker that
no test currently uses.

---

## Troubleshooting

| Symptom | Cause | Check |
|---------|-------|-------|
| Container exits immediately, `FileNotFoundError: JWT public key not found` | `JWT_PUBLIC_KEY_PATH` points nowhere; the key is read at import (`config.py:38-39,46`) | `docker exec ft_transcendence_api_gateway ls -l /app/keys/jwt-public.pem`; regenerate with `srcs/auth-service/keys/generate-keys.sh` |
| Container exits with pydantic `ValidationError` | one of the four `*_SERVICE_URL` settings or `JWT_PUBLIC_KEY_PATH` is absent (no defaults, `config.py:14,18-21`) | compare `srcs/api-gateway/.env` against `.env.example` |
| Every request 401 `UNAUTHORIZED` | no `access_token` cookie, expired token, or a token signed by a different key pair | send with `-b 'access_token=…'`; confirm the gateway's mounted public key matches `srcs/auth-service/keys/jwt-private.pem` |
| `/api/v1/auth/logout` returns 401 | only login/register/refresh are public (`middleware/auth_middleware.py:26-28`) | send the access-token cookie |
| Browser reports a CORS failure on a protected endpoint | preflight `OPTIONS` carries no cookies → 401 from the auth middleware, which sits outside `CORSMiddleware` | reproduce with `curl -i -X OPTIONS http://localhost:8001/api/v1/users/me` |
| 404 `NOT_FOUND` for an endpoint that exists in a backend | its prefix is not in `SERVICE_ROUTES` (e.g. `/api/v1/analyses`) | `routes/proxy.py:40-48` |
| 503 with `error.code = "HTTP_ERROR"` and a dict-looking message | backend unreachable; `httpx.RequestError` wrapped in an `HTTPException` with a dict detail | `docker compose ps`; verify the `*_SERVICE_URL` hostnames resolve on `backend-network` |
| Vision request dies at ~30 s through nginx but works on :8001 | the gateway allows 300 s for `/api/v1/vision` (`routes/proxy.py:16-18`), nginx caps `/api` at `proxy_read_timeout 30s` (`srcs/nginx/conf.d/default.conf.template:89`) | call `http://localhost:8001` directly for long AI runs |
| Rate limiting never triggers | Redis unreachable — the middleware swallows `redis.RedisError` and lets the request through (`middleware/rate_limit.py:56-58`) | `docker exec ft_transcendence_redis redis-cli ping`; look for `Redis error in rate limiting` in the gateway logs |
| 429 sooner than `RATE_LIMIT_PER_MINUTE` | nginx has its own limiter, 200 r/m with `burst=20` on `/api` (`srcs/nginx/conf.d/default.conf.template:18,77`) | hit `http://localhost:8001` to isolate the gateway layer |
| Source edit has no effect | only `routes/` and `tests/` are bind-mounted (`docker-compose.yml:299,301`); everything else is baked in at `Dockerfile:13`, and uvicorn runs without `--reload` | `docker compose build api-gateway` for other files; `docker compose restart api-gateway` after editing `routes/` |
| Log line shows `"user_id": "anonymous"`, `"request_id": "no-request-id"` | public endpoints skip the auth middleware, so `request.state` is never populated | expected for `/health`, `/docs`, `/api/v1/auth/{login,register,refresh}` |
