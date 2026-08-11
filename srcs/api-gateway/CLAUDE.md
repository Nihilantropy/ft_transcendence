# CLAUDE.md - API Gateway

## Overview

FastAPI reverse proxy, container `ft_transcendence_api_gateway`, `backend-network` only, host port `8001`
(`docker-compose.yml:294`). No compose profile is declared, so it behaves identically under `local` and
`cloud`. Stateless: the only external state is a Redis counter for rate limiting. Live entry point is the
flat layout at the service root (`main.py`, `config.py`, `routes/`, `middleware/`, `auth/`, `utils/`) —
`Dockerfile:21` runs `uvicorn main:app`. The `src/` directory is **empty** and exists only because
`docker-compose.yml:298` bind-mounts it; nothing imports it, git does not track it, do not put code there.

Read `README.md` first for routes, config table and error codes. This file is only what will trip you up.

## Essential Commands

```bash
# Tests (30, flat tests/ — there is no tests/unit or tests/integration)
docker compose run --rm api-gateway python -m pytest tests/ -v
docker compose run --rm --no-deps api-gateway python -m pytest tests/ -v   # skip starting auth/user/db
docker exec ft_transcendence_api_gateway python -m pytest tests/test_proxy.py -v
./scripts/run-unit-tests.sh --gateway          # same command; its printed "28" is stale and unasserted

# pytest-cov is NOT in requirements.txt
docker exec ft_transcendence_api_gateway pip install pytest-cov
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=term

# Rebuild — required for every file except routes/ and tests/
docker compose build api-gateway && docker compose up -d api-gateway
docker compose restart api-gateway             # enough after editing routes/ only

# Logs / shell
docker compose logs -f api-gateway             # make logs-api-gateway also works
docker exec -it ft_transcendence_api_gateway /bin/sh
# NOTE: `make exec-api-gateway` is broken — it expands to ft_transcendence_api-gateway,
# but the container is ft_transcendence_api_gateway (Makefile:163-164 vs docker-compose.yml:287)

curl http://localhost:8001/health
```

## Code Map

| Path | Responsibility |
|---|---|
| `main.py` | App construction, four exception handlers, hardcoded CORS origins, middleware registration, `GET /health` |
| `config.py` | `Settings(BaseSettings)`; module-level `settings` and `JWT_PUBLIC_KEY` (public key read from disk at import, `:46`) |
| `auth/jwt_utils.py` | `decode_jwt()`, `extract_user_context()`, `JWTValidationError`. Pure functions, no I/O |
| `middleware/auth_middleware.py` | `JWTAuthMiddleware` — cookie → payload → `request.state` → `backend_headers`; hardcoded public-endpoint set |
| `middleware/rate_limit.py` | `RateLimitMiddleware` + module-level **synchronous** `redis_client` (`:10`) |
| `middleware/logging_middleware.py` | `LoggingMiddleware` — one INFO line per request, sets `X-Request-ID` on the response |
| `routes/proxy.py` | `SERVICE_ROUTES`, `SERVICE_TIMEOUTS`, `httpx_client`, `ProxyResponse`, `get_backend_service_url()`, `forward_request()`, the `/api/{path:path}` catch-all |
| `utils/responses.py` | `StandardResponse`/`ErrorDetail` Pydantic models, `success_response()`, `error_response()` |
| `tests/` | Flat `test_*.py` + `conftest.py`; no `__init__.py`, tests do `from conftest import …` |
| `src/` | Empty mount artifact. Not code. |

`success_response()` (`utils/responses.py:18`) is currently dead — nothing imports it. Only
`error_response()` is used, by `main.py`.

## Request / Data Flow

Registration order in `main.py` is CORS(69) → Logging(83) → RateLimit(86) → JWTAuth(92). Starlette's
`add_middleware` inserts at the head, so **execution is the reverse**:

```
JWTAuth ──> RateLimit ──> Logging ──> CORS ──> router
```

Authenticated proxy call:

```
GET /api/v1/users/me  (Cookie: access_token=…)
 1 JWTAuth      path not in public_endpoints (auth_middleware.py:33)
                decode_jwt(cookie, JWT_PUBLIC_KEY, "RS256")      → JWTValidationError ⇒ 401 UNAUTHORIZED
                request.state.{user_id,user_role,user_email,request_id,backend_headers}   (:48-62)
 2 RateLimit    key = rate_limit:user:{user_id}  (state.user_id is already set)
                GET → None ⇒ SETEX key 60 1 | count ≥ limit ⇒ 429 | else INCR          (rate_limit.py:41-54)
 3 Logging      start timer
 4 CORS         adds Access-Control-* on the way out (only for responses that reach here)
 5 proxy_handler   full_path = "/api/" + path
                get_backend_service_url → first SERVICE_ROUTES prefix that `startswith`  (proxy.py:63-70)
                forward_request: headers minus host, cookie stripped (non-/api/v1/auth),
                                 + backend_headers, body only for POST/PUT/PATCH,
                                 timeout 300s under /api/v1/vision else 30s             (proxy.py:94-127)
                httpx.RequestError ⇒ HTTPException(503, dict detail)
                HTML 404 / HTML 500 normalised to the JSON envelope                     (proxy.py:188-241)
                else ProxyResponse(content, status, raw_headers=list(resp.headers.raw))  (proxy.py:244-248)
 ← Logging adds X-Request-ID, RateLimit adds X-RateLimit-Limit/Remaining
```

Public paths (`/health`, `/docs`, `/openapi.json`, `/api/v1/auth/{login,register,refresh}`) short-circuit
step 1 via `call_next`, so `request.state` stays empty: the outbound request carries **no** `X-User-ID` /
`X-Request-ID`, rate limiting falls back to `rate_limit:ip:{client_ip}`, and the log line reads
`"user_id": "anonymous"`, `"request_id": "no-request-id"`.

## Conventions & Patterns

- **Adding a backend service** takes three edits, in order: `.env` + `.env.example` (`NEW_SERVICE_URL=`),
  `config.py` (`NEW_SERVICE_URL: str` — no default, so a missing value fails fast at startup), then a
  `SERVICE_ROUTES` entry in `routes/proxy.py:40-48`. Nothing else; the catch-all handles the rest.
- **Prefix matching is plain `startswith` over dict insertion order** (`proxy.py:63-64`). If a new prefix
  is a prefix of, or prefixed by, an existing one, the more specific string must be inserted **first**.
- **Making a path public** means adding the exact full path to the `self.public_endpoints` set in
  `middleware/auth_middleware.py:22-29`. It is a set-membership test on `request.url.path`, not a prefix
  test — `/api/v1/auth/logout` is protected precisely because it is not listed.
- **Slow endpoints get an entry in `SERVICE_TIMEOUTS`** (`proxy.py:16-18`), never a bump of the 30 s
  default on `httpx_client` (`proxy.py:13`).
- **Gateway-generated error bodies always use the envelope**
  `{"success", "data", "error": {"code","message","details"}, "timestamp"}`. `main.py`'s four handlers call
  `error_response()` (`utils/responses.py:27`); the middlewares and the proxy's HTML-normalisation branches
  hand-build the same dict inline (`auth_middleware.py:73-85`, `rate_limit.py:81-101`,
  `proxy.py:189-241`). Match the shape whichever route you take.
- **New middleware**: subclass `BaseHTTPMiddleware`, take `app: ASGIApp` first, register it in `main.py`
  and remember that later registration = earlier execution.
- **`request.state` is the only channel between middlewares and the proxy handler.** `forward_request`
  reads `getattr(request.state, "backend_headers", {})` (`proxy.py:91`) with a default, so anything you
  add there must also tolerate absence on public paths.

## Gotchas

- **`CORSMiddleware` is innermost.** 401s from `JWTAuthMiddleware` and 429s from `RateLimitMiddleware`
  never pass through it, so they carry no `Access-Control-*` headers. A browser preflight (`OPTIONS`, sent
  without cookies) against any non-public path gets a bare 401. The comment on `main.py:85` claims rate
  limiting runs "before auth" — it does not.
- **`OPTIONS` is not in the catch-all's method list** (`proxy.py:159`), so an `OPTIONS /api/...` that
  carries a valid cookie but no `Access-Control-Request-Method` reaches the router and 405s. A real
  preflight never gets that far — `CORSMiddleware` would short-circuit it, but `JWTAuthMiddleware` 401s
  it first because preflights carry no cookies.
- **`timestamp` is frozen in `error_response()` output.** `utils/responses.py:16` declares
  `timestamp: str = datetime.utcnow().isoformat()` as a Pydantic field default, which is evaluated once at
  class-definition time. Every envelope built by `main.py`'s handlers therefore reports the worker's start
  time. The inline dicts in the middlewares and `proxy.py` call `utcnow()` per request and are correct.
- **The 503 path leaks a stringified dict.** `proxy.py:146-157` raises `HTTPException(503, detail={...})`
  with a dict; `main.py:20-30` does `str(exc.detail)` for non-`str` details, so the client sees
  `error.code = "HTTP_ERROR"` and a Python repr in `error.message`. The intended `SERVICE_UNAVAILABLE`
  code never reaches the wire. 404 is unaffected — Starlette prefers the status-code handler
  (`main.py:44`) for `HTTPException`.
- **Redis calls are synchronous inside async middleware.** `redis.from_url` (`rate_limit.py:10`) is the
  blocking client and is called 2–3 times per request on the event loop. Do not add more calls there
  without switching to `redis.asyncio`.
- **Rate limiting is a fixed window, not sliding** — `SETEX key 60 1` then `INCR` (`rate_limit.py:45,54`).
  A caller can burst `2 × limit` across a window boundary.
- **Redis failure fails open**: `except redis.RedisError` merely prints (`rate_limit.py:56-58`); requests
  proceed unlimited.
- **Cookies are stripped for every prefix except `/api/v1/auth`** (`proxy.py:98-99`). Any new endpoint
  that needs to read a cookie downstream must live under that prefix, or the stripping rule must change.
- **Query parameters are flattened**: `params=dict(request.query_params)` (`proxy.py:125`) keeps only the
  last value of a repeated key.
- **`DELETE` bodies are dropped** — the body is only read for `POST`/`PUT`/`PATCH` (`proxy.py:109-110`).
- **Backend response headers are copied raw** (`proxy.py:247`), including `Content-Length` and
  `Content-Encoding`, while `raw_response.content` has already been transparently decoded by httpx. No
  backend enables gzip today (neither Django service lists `GZipMiddleware`), but enabling one would ship
  a decoded body under a stale `Content-Encoding`.
- **`/api/v1/analyses*` is unreachable.** user-service registers it
  (`srcs/user-service/apps/profiles/urls.py`) but there is no matching `SERVICE_ROUTES` prefix, so it 404s
  at the gateway. `/api/v1/rag*` and `/api/v1/admin/rag*` are excluded on purpose (`proxy.py:38,45`).
- **`/redoc` requires auth** while `/docs` and `/openapi.json` do not — `/redoc` was simply never added to
  the public set.
- **`httpx_client` is a module-level `AsyncClient` that is never closed**; there is no lifespan handler.
- **`PORT`, `HOST`, `DEBUG`, `LOG_LEVEL` are declared in `config.py:8-11` and read by nothing.** The port
  comes from `Dockerfile:21`, the log level from `logging.basicConfig(level=logging.INFO)`
  (`logging_middleware.py:10`).
- **Only `routes/` and `tests/` are bind-mounted** (`docker-compose.yml:299,301`). Editing `main.py`,
  `config.py`, `middleware/`, `auth/` or `utils/` requires `docker compose build api-gateway`. uvicorn runs
  without `--reload`, so even mounted `routes/` changes need a container restart.
- **There is no `.dockerignore`**, so `Dockerfile:13` (`COPY . .`) bakes the local `.env` into the image.
  Runtime `env_file` values win over it (env beats dotfile in pydantic-settings), but do not put secrets
  in that file.
- **Long AI calls die at nginx, not here.** The gateway allows 300 s for `/api/v1/vision`, nginx caps
  `/api` at `proxy_read_timeout 30s` (`srcs/nginx/conf.d/default.conf.template:89`).

## Testing Notes

- `tests/conftest.py` generates a 2048-bit RSA pair at **import time**, writes the public key to a temp
  file, and sets `JWT_PUBLIC_KEY_PATH`, `JWT_ALGORITHM`, `AUTH_SERVICE_URL`, `USER_SERVICE_URL`,
  `AI_SERVICE_URL`, `REDIS_URL`, `RATE_LIMIT_PER_MINUTE=100` in `os.environ` before `config` is first
  imported. It does **not** set `RECOMMENDATION_SERVICE_URL` — that one comes from the container env
  (`env_file`), which is why running pytest on the host fails with a pydantic `ValidationError`.
- **Sign every test token with `TEST_PRIVATE_KEY_PEM` and `algorithm="RS256"`**
  (`from conftest import TEST_PRIVATE_KEY_PEM`). HS256 or a hardcoded secret will always 401.
- **Mock backends by patching `routes.proxy.httpx_client.request` with an `AsyncMock` returning a real
  `httpx.Response`** — see `tests/test_proxy.py:32`. Patching the module attribute, not the class, is what
  the whole suite does.
- **Mock Redis by patching `middleware.rate_limit.redis_client` with a `MagicMock`**; `ttl` must return an
  int because `_rate_limit_response` interpolates it (`tests/test_rate_limit.py:31`).
- Most files instantiate `TestClient(main.app)` at module scope and therefore exercise the full middleware
  stack. `tests/test_auth_middleware.py` is the exception: it builds a bare `FastAPI()` and attaches only
  `JWTAuthMiddleware`, so use that pattern for middleware-only assertions.
- `pytest.ini` sets `asyncio_mode = auto` (no `@pytest.mark.asyncio` needed, though `test_proxy.py` still
  uses it) and `--strict-markers`; the `integration` marker is registered but unused — a new marker must be
  declared there or collection fails.
- **`docker compose run --rm` is fine here** — `conftest.py` points the service URLs at unresolvable
  `*-test` hostnames, and every test that needs a backend body patches `routes.proxy.httpx_client.request`;
  no sibling hostname is ever resolved. It does start `auth-service`/`user-service`/`db` first because of
  `depends_on`; add `--no-deps` to skip that.
- `tests/` is bind-mounted, so new or edited test files need **no** rebuild.
- `tests/test_error_handling.py:69-73` is an empty placeholder (`pass`) and counts toward the 30.

## Config & Thresholds

Everything tunable that is genuinely environment-dependent lives in `.env` and is declared on
`Settings` in `config.py:4-33`; `.env.example` is the contract. Five settings have **no default** and will
abort startup if unset: `JWT_PUBLIC_KEY_PATH`, `AUTH_SERVICE_URL`, `USER_SERVICE_URL`, `AI_SERVICE_URL`,
`RECOMMENDATION_SERVICE_URL`. Never read `os.environ` directly — import `settings`.

Values that are deliberately hardcoded, and where to change them:

| Value | Location |
|---|---|
| CORS origins / exposed headers | `main.py:71-79` |
| Public (unauthenticated) endpoints | `middleware/auth_middleware.py:22-29` |
| Rate-limit window (60 s) | `middleware/rate_limit.py:25` |
| Default backend timeout (30 s) | `routes/proxy.py:13` and the fallback in `:113-116` |
| Per-prefix timeout overrides | `routes/proxy.py:16-18` |
| Path prefix → service map | `routes/proxy.py:40-48` |
| Listen port / worker count | `Dockerfile:21` |

If you need one of these to vary per environment, promote it to a `Settings` field with a default plus an
`.env.example` line — do not add a second source of truth.
