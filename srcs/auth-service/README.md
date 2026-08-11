# Auth Service

Django + Django REST Framework microservice that owns user identity for the SmartBreeds platform. It is the only component holding the RS256 **private** key: it registers and authenticates users, signs access/refresh JWTs, delivers them as HTTP-only cookies, rotates and revokes refresh tokens, and drives cross-service account deletion. Every other service verifies tokens with the public key only and can never mint one.

Runs on internal port **3001** on `backend-network`. It has **no host port** — reach it through the API Gateway (`localhost:8001`) or Nginx (`localhost:8000` / `localhost:8443`, mapped to the container's 80/443 at docker-compose.yml:11-13).

---

## Responsibilities

- Custom `User` model (UUID PK, email as username, Argon2 hashing, `user`/`admin` roles).
- Registration with password confirmation and per-project password rules.
- Login with a **single-session policy**: every prior refresh token is revoked on each login (`views.py:75`).
- RS256 JWT issuance (`jwt_utils.py:7-65`) and validation (`jwt_utils.py:67-87`).
- Refresh-token persistence as SHA-256 hashes only — raw tokens never hit the database (`models.py:90`, `jwt_utils.py:89`).
- Refresh-token **rotation**: the presented token is revoked and a new pair issued (`views.py:230-242`).
- Password change that revokes all sessions and re-issues a fresh pair (`views.py:433-524`).
- Cascade account deletion: deletes user-service data over HTTP first, then auth rows (`utils.py:146-206`).
- Owns the `auth_schema` PostgreSQL schema (`settings.py:73`).

Explicitly **not** here: Django admin (removed), email verification (`is_verified` defaults to `True`, `models.py:54`), password *reset by email*, OAuth, MFA.

---

## Architecture

```
browser ──cookies──> nginx (8000/8443) ──> api-gateway (8001) ──/api/v1/auth/*──> auth-service (3001)
                                                                                      │
                                                             ┌────────────────────────┼──────────────────────┐
                                                             ▼                        ▼                      ▼
                                                      postgres (auth_schema)   user-service:3002    keys/jwt-private.pem
                                                                               (DELETE cascade only)
```

| Aspect | Value |
|---|---|
| Container | `ft_transcendence_auth_service` (docker-compose.yml:179) |
| Image | `ft_transcendence_auth_service:local` |
| Port | 3001, internal only — no `ports:` mapping |
| Networks | `backend-network` only |
| Compose profiles | none declared → runs in **both** `local` and `cloud`; behaviour is identical in the two profiles |
| depends_on | `db` (condition: `service_healthy`) |
| Healthcheck | `curl -f http://localhost:3001/health`, interval 30s, timeout 10s, retries 3, start_period 60s |
| Volume | `./srcs/auth-service:/app:rw` — whole source tree bind-mounted (hot reload) |
| Restart | `on-failure` |

**Inbound.** The API Gateway maps the `/api/v1/auth` prefix to `AUTH_SERVICE_URL` (`srcs/api-gateway/routes/proxy.py:41`) and is the only caller. It forwards cookies **only** for `/api/v1/auth/*` paths (`proxy.py:98-99`) — this service reads tokens straight from `request.COOKIES`, so that exception is load-bearing. Gateway proxy timeout for these routes is the 30 s default (`proxy.py:13`).

Gateway-level public paths are `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` (`srcs/api-gateway/middleware/auth_middleware.py:22-29`). Everything else on this service — including `logout` — must carry a gateway-valid `access_token` cookie or the gateway 401s before the request ever arrives.

**Outbound.**

| Target | When | Client / timeout |
|---|---|---|
| PostgreSQL `auth_schema` | every request touching users/tokens | Django ORM, `ATOMIC_REQUESTS: False` (`settings.py:75`) |
| `USER_SERVICE_URL` `DELETE /api/v1/users/delete` | only from `DELETE /api/v1/auth/delete` | `httpx.Client(timeout=10.0)`, no retries (`utils.py:179`) |

The user-service call goes **direct** to `http://user-service:3002`, not through the API Gateway, carrying `X-User-ID`, `X-User-Role`, `X-Request-ID` headers (`utils.py:170-174`).

**Key distribution.** `keys/jwt-private.pem` stays in this service. `keys/jwt-public.pem` is bind-mounted read-only into the API Gateway at `/app/keys/jwt-public.pem` (docker-compose.yml:303). `keys/generate-keys.sh` produces a **4096-bit** RSA pair (`generate-keys.sh:11`), chmod 600/644. The private key is gitignored (`.gitignore:20`).

---

## API Reference

URL composition: `config/urls.py:9` includes `apps.authentication.urls` under `api/v1/auth/`, and every route in `apps/authentication/urls.py:11-17` is registered without a trailing slash. `APPEND_SLASH = False` (`settings.py:41`), so **a trailing slash is a 404**, not a redirect.

There are no DRF authentication or permission classes configured (`settings.py:116-123`). Each view extracts and decodes the cookie itself.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | none | Create account, auto-login |
| POST | `/api/v1/auth/login` | none | Authenticate, issue cookies |
| POST | `/api/v1/auth/refresh` | `refresh_token` cookie | Rotate token pair |
| POST | `/api/v1/auth/logout` | `refresh_token` cookie (optional) | Revoke token, clear cookies |
| GET | `/api/v1/auth/verify` | `access_token` cookie | Validate access token |
| PUT | `/api/v1/auth/change-password` | `access_token` cookie | Change password, revoke all sessions |
| DELETE | `/api/v1/auth/delete` | `access_token` cookie | Cascade-delete the account |
| GET | `/health` | none | Docker healthcheck |

### Envelope

Every response from `utils.success_response` / `utils.error_response` (`utils.py:66-106`):

```json
{ "success": true,  "data": { }, "error": null, "timestamp": "2026-08-10T12:00:00.000000Z" }
{ "success": false, "data": null,
  "error": { "code": "ERROR_CODE", "message": "Human readable", "details": {} },
  "timestamp": "2026-08-10T12:00:00.000000Z" }
```

Unmatched URLs are converted from Django's HTML 404 to the same JSON shape with code `NOT_FOUND` by `Custom404Middleware` (`middleware.py:11-41`).

The `user` object returned everywhere is `UserSerializer` (`serializers.py:5-11`):

```json
{ "id": "<uuid>", "email": "a@b.c", "first_name": "", "last_name": "", "role": "user", "is_verified": true }
```

### Cookies

Set by `issue_auth_tokens` (`utils.py:42-61`), cleared by `clear_auth_cookies` (`utils.py:109-142`).

| Cookie | Max-Age | Path | HttpOnly | Secure | SameSite | Domain |
|---|---|---|---|---|---|---|
| `access_token` | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60` | `/` (default) | yes | `COOKIE_SECURE` | `COOKIE_SAMESITE` | `COOKIE_DOMAIN`, or `None` when it equals `localhost` |
| `refresh_token` | `JWT_REFRESH_TOKEN_LIFETIME_DAYS * 86400` | `/api/v1/auth/refresh` | yes | `COOKIE_SECURE` | `COOKIE_SAMESITE` | same rule |

### JWT payloads

Access (`jwt_utils.py:20-27`): `user_id`, `email`, `role`, `token_type: "access"`, `iat`, `exp`.
Refresh (`jwt_utils.py:51-57`): `user_id`, `token_id` (the `refresh_tokens.id` UUID), `token_type: "refresh"`, `iat`, `exp`.
Signed with `JWT_KEYS['private']`, verified with `JWT_KEYS['public']`, algorithm `JWT_ALGORITHM`.

---

### POST /api/v1/auth/register

`RegisterSerializer` (`serializers.py:13-57`).

```json
{ "email": "user@example.com", "password": "Password123",
  "password_confirm": "Password123", "first_name": "John", "last_name": "Doe" }
```

`first_name` / `last_name` optional and blank-allowed; the other three required. Email is lowercased and uniqueness-checked case-insensitively (`serializers.py:34-39`).

**201** → `{"user": {…}}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | Serializer email error containing "already exists" (`views.py:108-116`) |
| `VALIDATION_ERROR` | 422 | Any other serializer failure; `details` holds the DRF error dict |

Password rules come from `AUTH_PASSWORD_VALIDATORS` (`settings.py:83-94`): Django's `UserAttributeSimilarityValidator`, `MinimumLengthValidator` with `min_length: 8`, plus the project's `PasswordValidator` requiring at least one letter and one digit (`validators.py:27-37`). Django's `CommonPasswordValidator` and `NumericPasswordValidator` are **not** enabled.

### POST /api/v1/auth/login

`LoginSerializer` (`serializers.py:93-101`): `{"email": "...", "password": "..."}`.

**200** → `{"user": {…}}` plus both cookies. All previously active refresh tokens for the user are revoked first (`views.py:75`).

| Code | Status | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Missing/invalid email or password field |
| `INVALID_CREDENTIALS` | 401 | Unknown email or wrong password (same message for both) |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |

### POST /api/v1/auth/refresh

No body. Reads the `refresh_token` cookie. Validation order (`views.py:149-244`): cookie present → JWT decodes → `token_type == "refresh"` → `refresh_tokens` row exists for `token_id` → row not revoked → stored SHA-256 matches the presented token → user exists → user active. Then the row is marked revoked and a brand-new pair is issued.

**200** → `{"user": {…}}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `MISSING_TOKEN` | 401 | No `refresh_token` cookie |
| `TOKEN_EXPIRED` | 401 | `jwt.ExpiredSignatureError` |
| `INVALID_TOKEN` | 401 | Bad signature, wrong `token_type`, unknown `token_id`, hash mismatch, or deleted user |
| `TOKEN_REVOKED` | 401 | `refresh_tokens.is_revoked` is true |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |

The `refresh_tokens.expires_at` column is **not** consulted here; expiry is enforced solely by the JWT `exp` claim.

### POST /api/v1/auth/logout

Always **200** with `{"message": "Successfully logged out"}` and both cookies cleared. If a decodable refresh token is present its row is revoked; missing, malformed, expired or unknown tokens are swallowed (`views.py:255-276`).

### GET /api/v1/auth/verify

Reads the `access_token` cookie. **200** → `{"user": {…}, "valid": true}`.

| Code | Status | Cause |
|---|---|---|
| `MISSING_TOKEN` | 401 | No `access_token` cookie |
| `TOKEN_EXPIRED` | 401 | Expired signature |
| `INVALID_TOKEN` | 401 | Invalid signature, `token_type != "access"`, or user not found |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |

### PUT /api/v1/auth/change-password

`ChangePasswordSerializer` (`serializers.py:59-90`), all three fields required:

```json
{ "current_password": "Password123", "new_password": "newSecure456",
  "new_password_confirm": "newSecure456" }
```

Token is checked *before* the body is parsed. On success the password is written, **all** non-revoked refresh tokens for the user are revoked, and a fresh pair of cookies is issued (`views.py:511-522`).

**200** → `{"message": "Password changed successfully"}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` | 401 | No `access_token` cookie |
| `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems, as in `verify` |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `VALIDATION_ERROR` | 422 | Wrong `current_password`, mismatched confirmation, or new password failing the validators |

### DELETE /api/v1/auth/delete

Reads the `access_token` cookie, then runs `delete_user_cascade` (`utils.py:146-206`):

1. `DELETE {USER_SERVICE_URL}/api/v1/users/delete` with `X-User-ID`, `X-User-Role`, `X-Request-ID`. Anything other than HTTP 200, or a connection error, raises.
2. `User.objects.filter(id=...).delete()` — `refresh_tokens` rows go with it via `on_delete=CASCADE` (`models.py:89`).

**200** →

```json
{ "message": "User account a@b.c deleted successfully",
  "deleted": { "user_service": { }, "auth_service": { "users": 1, "refresh_tokens": 2 } } }
```

Cookies are cleared on the way out.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` | 401 | No `access_token` cookie |
| `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems; `INVALID_TOKEN` also covers "user not found" |
| `DELETION_FAILED` | 500 | user-service returned non-200, timed out, or was unreachable |

### GET /health

**200** → `{"status": "healthy", "service": "auth-service"}`. No DB check — it answers even when PostgreSQL is down.

---

## Data Model

Schema `auth_schema`, forced by the connection option `-c search_path=auth_schema,public` (`settings.py:73`). The schema itself is created by `srcs/db/init-scripts/01-init-schemas.sql:7`, not by Django. Migrations: `0001_initial` (User), `0002_refreshtoken`.

### `users` — `apps.authentication.User` (`models.py:35-82`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `default=uuid.uuid4`, not editable |
| `email` | varchar(255) | unique; normalised to lowercase by `UserManager.create_user` (`models.py:15`) |
| `password` | varchar(128) | Argon2 (`settings.py:97-100`; PBKDF2 kept as fallback hasher) |
| `first_name`, `last_name` | varchar(150) | blank-allowed |
| `role` | varchar(20) | `user` \| `admin`, default `user` |
| `is_active` | bool | default `true`; false ⇒ 403 `ACCOUNT_DISABLED` |
| `is_verified` | bool | default `true`; no verification flow writes it |
| `is_staff`, `is_superuser` | bool | default `false`; set by `create_superuser` |
| `last_login` | timestamptz | from `AbstractBaseUser`; **no view updates it** |
| `created_at`, `updated_at` | timestamptz | `auto_now_add` / `auto_now` |

Indexes on `email` and `created_at`. `AUTH_USER_MODEL = 'authentication.User'` (`settings.py:80`). Inherits `PermissionsMixin`, so `auth.Group` / `auth.Permission` M2M tables exist even though nothing uses them.

### `refresh_tokens` — `apps.authentication.RefreshToken` (`models.py:85-115`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK; travels in the JWT as `token_id` |
| `user_id` | UUID FK → `users` | `on_delete=CASCADE`, `related_name='refresh_tokens'` |
| `token_hash` | varchar(64) | **unique**, SHA-256 hex of the raw JWT |
| `created_at` | timestamptz | `auto_now_add` |
| `expires_at` | timestamptz | written at creation, never read by any view |
| `last_used_at` | timestamptz null | never written by any code |
| `is_revoked` | bool | default `false` |

Indexes on `token_hash`, `(user, is_revoked)`, `expires_at`. Rows are never pruned — revoked tokens accumulate.

---

## Configuration

Loaded with `python-decouple` from `srcs/auth-service/.env` (gitignored; the compose `env_file` points at it, docker-compose.yml:185). The table below lists the `.env.example` template value and the fallback hardcoded in `config/settings.py` — the fallback applies when the variable is absent.

| Variable | `.env.example` | Code default (`config/settings.py`) | Purpose |
|---|---|---|---|
| `DEBUG` | `False` | `True` (`:12`) | Django debug; also decides whether missing JWT keys are fatal |
| `SECRET_KEY` | `CHANGE_THIS_TO_SECURE_RANDOM_STRING` | `django-insecure-dev-key-change-in-production` (`:11`) | Django signing key |
| `ALLOWED_HOSTS` | `auth-service,localhost` | same (`:13`) | Comma-separated `Csv()`; must include `auth-service` for gateway calls and `localhost` for the healthcheck |
| `DB_NAME` | `smartbreeds` | `smartbreeds` (`:67`) | Shared database |
| `DB_USER` | `smartbreeds_user` | `smartbreeds_user` (`:68`) | |
| `DB_PASSWORD` | `secure_password_here` | `smartbreeds_password` (`:69`) | |
| `DB_HOST` | `db` | `db` (`:70`) | Compose service name |
| `DB_PORT` | `5432` | `5432` (`:71`) | |
| `JWT_ALGORITHM` | `RS256` | `RS256` (`:130`) | Must stay RS256 — the gateway only has the public key |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | `15` | `15` (`:131`) | Access token TTL and `access_token` cookie Max-Age |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | `7` | `7` (`:132`) | Refresh TTL, cookie Max-Age and `refresh_tokens.expires_at` |
| `JWT_PRIVATE_KEY_PATH` | `/app/keys/jwt-private.pem` | `BASE_DIR/keys/jwt-private.pem` (`:133`) | Signing key, read once at startup |
| `JWT_PUBLIC_KEY_PATH` | `/app/keys/jwt-public.pem` | `BASE_DIR/keys/jwt-public.pem` (`:134`) | Verification key |
| `COOKIE_SECURE` | `False` | `False` (`:137`) | `Secure` flag on both cookies |
| `COOKIE_SAMESITE` | `Strict` | `Strict` (`:138`) | `SameSite` on both cookies |
| `COOKIE_DOMAIN` | `localhost` | `localhost` (`:139`) | Literal `localhost` is translated to "no Domain attribute" (`utils.py:49`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | same (`:126`) | `Csv()`; `CORS_ALLOW_CREDENTIALS` is hardcoded `True` (`:127`) |
| `USER_SERVICE_URL` | `http://user-service:3002` | `http://user-service:3002` (`:167`) | Cascade-delete target |
| `PORT` | `3001` | — | **Present in `.env.example` but read by no code.** The listen port is hardcoded in the Dockerfile CMD |

JWT keys are read from disk at import time by `load_jwt_keys()` (`settings.py:142-164`). If either file is missing: with `DEBUG=False` the process dies with `FileNotFoundError`; with `DEBUG=True` it prints a warning and sets `JWT_KEYS` to empty strings, after which every sign/verify operation fails at runtime.

---

## Running

```bash
# From the repository root
make up                      # brings up the whole stack (default profile: cloud, Makefile:9)
make up COMPOSE_PROFILES=local   # auth-service is identical in the local profile

docker compose up auth-service -d   # this service alone (compose starts `db` first)
make logs-auth-service
make exec-auth_service       # note the underscore: exec-% builds ft_transcendence_$* (Makefile:163)
```

Prerequisites, in order:

1. `srcs/auth-service/.env` exists — copy from `.env.example`. Compose fails outright without it.
2. `keys/jwt-private.pem` and `keys/jwt-public.pem` exist — `./keys/generate-keys.sh` if not. The gateway also bind-mounts the public key, so it must exist before `api-gateway` starts.
3. `db` is healthy (enforced by `depends_on`).
4. Migrations applied — `make migration` (`scripts/run-migrations.sh:45-46` runs `makemigrations` then `migrate` for this service **first**). The ordering is enforced by that script only: user-service stores `user_id` as a plain `UUIDField` soft reference, not a database FK to `auth_schema.users` (`srcs/user-service/apps/profiles/models.py:9,14`).

Optional: `make superuser` runs `scripts/create-superuser.sh`, which calls `createsuperuser --no-input` inside the container. Django admin is not installed, so a superuser is only useful for the `admin` role.

Runtime notes: the image runs `python manage.py runserver 0.0.0.0:3001` (Dockerfile:39) — the Django development server, with the auto-reloader. `gunicorn` is in `requirements.txt` but is not used. Because `./srcs/auth-service` is bind-mounted over `/app`, editing Python files reloads in place; only `requirements.txt` changes need `docker compose build auth-service`.

Image facts: `python:3.11-slim`; apt `gcc`, `postgresql-client`, `libpq-dev`, `curl`; installs both `requirements.txt` and `requirements-dev.txt` (test tooling ships in the image); non-root user `authuser` uid 1000; `EXPOSE 3001`.

Pinned dependencies: Django 5.0.1, djangorestframework 3.14.0, PyJWT 2.8.0, cryptography 41.0.7, argon2-cffi 23.1.0, psycopg2-binary 2.9.9, django-cors-headers 4.3.1, python-decouple 3.8, httpx 0.27.0, dj-database-url 2.1.0, gunicorn 21.2.0. Dev: pytest 7.4.3, pytest-django 4.7.0, pytest-cov 4.1.0, factory-boy 3.3.0, freezegun 1.4.0.

---

## Testing

**102 tests**, all unit-level: no HTTP call leaves the process, so `docker compose run --rm` works even when nothing is running.

```bash
# Full suite (102 tests)
docker compose run --rm auth-service python -m pytest tests/ -v

# Via the repo orchestrators (expects 102)
./scripts/run-unit-tests.sh --auth
make test auth

# One file / one test
docker compose run --rm auth-service python -m pytest tests/test_models.py -v
docker compose run --rm auth-service python -m pytest \
  tests/test_views.py::TestLoginView::test_login_with_valid_credentials_returns_200 -v

# Coverage (pytest-cov is already in the image)
docker exec ft_transcendence_auth_service python -m pytest tests/ --cov=apps --cov-report=html
```

| File | Tests | Covers |
|---|---:|---|
| `tests/test_views.py` | 62 | `TestLoginView` 12, `TestRegisterView` 16, `TestRefreshView` 13, `TestLogoutView` 9, `TestChangePasswordView` 12 |
| `tests/test_serializers.py` | 20 | `UserSerializer` output, `RegisterSerializer`, `ChangePasswordSerializer`, `LoginSerializer` |
| `tests/test_models.py` | 9 | User creation/normalisation/uniqueness/superuser, RefreshToken creation, FK relation, hash uniqueness, `revoke()` |
| `tests/test_jwt_utils.py` | 6 | Access/refresh generation and decoding, invalid token, SHA-256 hashing |
| `tests/test_validators.py` | 5 | `PasswordValidator` letter/number rules and help text |

`GET /api/v1/auth/verify` and `DELETE /api/v1/auth/delete` have **no view tests**.

`tests/conftest.py` is empty — fixtures (`client`, `user_data`, `user`, and the per-class `user_with_refresh_token` / `authenticated_client`) live inside `tests/test_views.py`. `pytest.ini` sets `DJANGO_SETTINGS_MODULE=config.settings` and `addopts = --strict-markers --disable-warnings --reuse-db`; `--reuse-db` means pytest-django keeps the `test_smartbreeds` database between runs, so a schema change needs `--create-db`. Custom markers `slow` and `integration` are declared but unused.

Tests sign real JWTs with the real key pair from `keys/` — they need those files present, and they need `db` reachable (which `docker compose run` starts through `depends_on`).

---

## Troubleshooting

**Container starts, every token operation fails.** `keys/jwt-private.pem` or `keys/jwt-public.pem` is missing and `DEBUG=True`, so `settings.py:158-164` fell back to empty key strings after printing `Warning: JWT private key not found at …`. Run `./keys/generate-keys.sh`, then restart. With `DEBUG=False` the same condition kills the process at startup instead.

**Gateway returns 401 on `/api/v1/auth/logout` or `/verify`.** Only `login`, `register` and `refresh` are gateway-public (`srcs/api-gateway/middleware/auth_middleware.py:22-29`). With an expired access token the gateway rejects the logout before this service sees it.

**Logout does not revoke the refresh token in a browser.** The `refresh_token` cookie is scoped to `Path=/api/v1/auth/refresh` (`utils.py:59`), so a browser does not send it to `/api/v1/auth/logout`. The view then falls through its `if refresh_token:` guard and returns 200 without revoking anything. Cookies are still cleared. The tests do not catch this because Django's test client ignores cookie paths.

**404 on an endpoint that clearly exists.** You added a trailing slash. `APPEND_SLASH = False` (`settings.py:41`) disables Django's redirect; the response is the JSON `NOT_FOUND` produced by `Custom404Middleware`.

**400 `DisallowedHost`.** `ALLOWED_HOSTS` must contain `auth-service` (gateway calls it by service name) and `localhost` (the compose healthcheck curls `http://localhost:3001/health`).

**Container stuck `unhealthy`.** The healthcheck needs `curl` and a 60 s `start_period`. It only probes `/health`, which never touches the database — a healthy container can still be failing every real request because PostgreSQL is unreachable. Check `make logs-auth-service` for `psycopg2.OperationalError`.

**500 `DELETION_FAILED` on `DELETE /api/v1/auth/delete`.** user-service returned non-200 or was unreachable within the 10 s `httpx` timeout (`utils.py:179`). Nothing is deleted on the auth side in that case — the auth rows are removed only after the remote call succeeds.

**Auth rows gone but user-service data still there.** The reverse ordering failure: the remote delete succeeded and the local `User.delete()` then failed. There is no compensating transaction; the deletion is not atomic across services.

**`IntegrityError` on `refresh_tokens.token_hash`.** New rows are inserted with the literal placeholder `'placeholder'` and updated with the real hash one statement later (`utils.py:28-39`). Two token issuances interleaving inside that window collide on the unique constraint.

**Regenerating the key pair logs everyone out.** All previously issued access and refresh tokens become unverifiable, and the API Gateway must be restarted to pick up the new public key (it is bind-mounted, but the gateway reads it into settings at startup).
