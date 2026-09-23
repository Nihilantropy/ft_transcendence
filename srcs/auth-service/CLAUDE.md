# CLAUDE.md - Auth Service

## Overview

Django 5.0.1 + DRF, internal port 3001, container `ft_transcendence_auth_service`, `backend-network` only, no host port. Owns `auth_schema` (`users`, `refresh_tokens`) and the RS256 **private** key in `keys/`. Views are plain `APIView` classes that read JWTs straight out of `request.COOKIES` — there is no DRF authentication class, no permission class, no `request.user`. No compose profile is declared, so it runs identically under `local` and `cloud`.

Read `README.md` first for routes, payloads, error codes and config values. This file is only the things that will trip you up.

## Essential Commands

```bash
# Tests (102). No cross-service calls, so `run --rm` is fine and preferred.
docker compose run --rm auth-service python -m pytest tests/ -v
docker compose run --rm auth-service python -m pytest tests/test_views.py::TestRefreshView -v
./scripts/run-unit-tests.sh --auth          # orchestrator, asserts 102

# After a model change, rebuild the test DB (pytest.ini pins --reuse-db)
docker compose run --rm auth-service python -m pytest tests/ --create-db -v

# Migrations (whole-repo ordering matters: auth first)
make migration                              # scripts/run-migrations.sh
docker exec ft_transcendence_auth_service python manage.py makemigrations
docker exec ft_transcendence_auth_service python manage.py migrate

# Shell / logs / keys
make exec-auth_service                      # underscore: exec-% expands to ft_transcendence_$* (Makefile:163)
make logs-auth-service                      # hyphen: logs-% takes the compose service name
./keys/generate-keys.sh                     # 4096-bit RSA pair, chmod 600/644
make superuser                              # scripts/create-superuser.sh

# Only requirements changes need this — source is bind-mounted
docker compose build auth-service
```

## Code Map

| Path | Responsibility |
|---|---|
| `config/settings.py` | All `decouple` config, `AUTH_USER_MODEL`, `search_path=auth_schema`, password validators, Argon2 hashers, `APPEND_SLASH=False`, `load_jwt_keys()` |
| `config/urls.py` | `/health` + `include('apps.authentication.urls')` under `api/v1/auth/` |
| `config/wsgi.py`, `config/asgi.py` | Stock Django entrypoints; `runserver` loads `config.wsgi.application` via `WSGI_APPLICATION` (`settings.py:61`), `asgi.py` is unused |
| `apps/authentication/views.py` | All 7 `APIView` endpoints + `HealthView`; cookie extraction and token checks live inline in each view |
| `apps/authentication/urls.py` | Flat `path()` list, no router, no trailing slashes |
| `apps/authentication/models.py` | `UserManager`, `User`, `RefreshToken` |
| `apps/authentication/serializers.py` | `UserSerializer` (output), `RegisterSerializer`, `ChangePasswordSerializer`, `LoginSerializer` |
| `apps/authentication/jwt_utils.py` | `generate_access_token`, `generate_refresh_token`, `decode_token`, `hash_token` |
| `apps/authentication/utils.py` | `issue_auth_tokens`, `clear_auth_cookies`, `success_response`, `error_response`, `delete_user_cascade` |
| `apps/authentication/validators.py` | `PasswordValidator` — one letter + one digit |
| `apps/authentication/middleware.py` | `Custom404Middleware` — HTML 404 → JSON `NOT_FOUND` |
| `apps/authentication/migrations/` | `0001_initial` (User), `0002_refreshtoken`. Only two. |
| `tests/` | pytest-django, `conftest.py` is **empty** — fixtures live in `test_views.py` |
| `keys/` | `jwt-private.pem` (gitignored), `jwt-public.pem` (bind-mounted read-only into api-gateway), `generate-keys.sh` |

There is no `admin.py`, no `apps/authentication/tests.py`, no management commands, no `permissions.py`, no service layer.

## Request / Data Flow

**Token-issuing paths** (`register`, `login`, `refresh`, `change-password`) all converge on the same tail:

```
view → parse json.loads(request.body) → Serializer(...).is_valid()
     → success_response(data, status)            # builds a DRF Response
     → issue_auth_tokens(user, response)         # utils.py:11
         ├─ generate_access_token(user)                       # RS256, private key
         ├─ RefreshToken.objects.create(token_hash='placeholder', expires_at=now+N days)
         ├─ generate_refresh_token(user, record.id)           # token_id = record PK
         ├─ record.token_hash = hash_token(jwt); record.save(update_fields=['token_hash'])
         └─ response.set_cookie('access_token', …); set_cookie('refresh_token', …, path='/api/v1/auth/refresh')
     → return response
```

**Token-consuming paths** (`refresh`, `logout`, `verify`, `delete`, `change-password`) all repeat this block inline:

```
request.COOKIES.get('access_token' | 'refresh_token')
  ↓ missing            → 401 MISSING_TOKEN  (verify, refresh)  /  401 UNAUTHORIZED (delete, change-password)
decode_token(token)                                   # jwt_utils.py:67, public key
  ↓ jwt.ExpiredSignatureError → 401 TOKEN_EXPIRED
  ↓ jwt.InvalidTokenError     → 401 INVALID_TOKEN
payload['token_type'] != expected → 401 INVALID_TOKEN
User.objects.get(id=payload['user_id']) → DoesNotExist → 401 INVALID_TOKEN
user.is_active is False → 403 ACCOUNT_DISABLED         # not in DeleteUserView
```

`DELETE /api/v1/auth/delete` additionally: `delete_user_cascade` → `httpx.Client(timeout=10.0).delete(USER_SERVICE_URL + '/api/v1/users/delete')` **direct to user-service, not through the gateway** → then `User.objects.filter(id=…).delete()`.

Inbound is always the API Gateway, which strips `Cookie` for every prefix **except** `/api/v1/auth/*` (`srcs/api-gateway/routes/proxy.py:98-99`). Do not add a cookie-reading endpoint outside that prefix.

## Conventions & Patterns

- **Never return a bare `Response`.** Every view returns `success_response(data, status=…)` or `error_response(code, message, details=None, status=…)` from `apps/authentication/utils.py`. Both already return a DRF `Response`; wrapping them again raises `TypeError: Object of type Response is not JSON serializable`.
- **Error codes are SCREAMING_SNAKE strings** chosen per situation, not per exception class. Existing vocabulary: `VALIDATION_ERROR` (422), `INVALID_CREDENTIALS` (401), `EMAIL_ALREADY_EXISTS` (409), `MISSING_TOKEN`/`INVALID_TOKEN`/`TOKEN_EXPIRED`/`TOKEN_REVOKED`/`UNAUTHORIZED` (401), `ACCOUNT_DISABLED` (403), `DELETION_FAILED` (500), `NOT_FOUND` (404). Reuse before inventing.
- **Validation failures are 422, not 400.** DRF's default 400 is never used; views check `is_valid()` themselves and map to 422 with `details=serializer.errors`.
- **Body parsing is manual**: `json.loads(request.body) if request.body else {}` inside a `try/except json.JSONDecodeError` that falls back to `{}`. Do not switch to `request.data` in one view only — match the surrounding style.
- **Routes carry no trailing slash.** `APPEND_SLASH = False` (`config/settings.py:41`); add `path('thing', ThingView.as_view(), name='thing')` to `apps/authentication/urls.py` and the full path becomes `/api/v1/auth/thing`.
- **Auth checks are copy-pasted per view, deliberately.** There is no decorator or mixin. A new authenticated endpoint duplicates the cookie/decode/token_type/user/is_active block from `VerifyView` (`views.py:287-338`).
- **Bulk revocation uses `.update()`, not `.save()`**: `RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)`. `RefreshToken.revoke()` and `.is_valid()` exist on the model but no production code path calls them.
- **Emails are always lowercased** — in `UserManager.create_user` (`models.py:15`), in `RegisterSerializer.validate_email`, and again in `LoginView`. Lookups use `email__iexact`.
- **Passwords go through `django.contrib.auth.password_validation.validate_password`** attached as a serializer field validator, never called by hand.

## Gotchas

- **`refresh_token` cookie is path-scoped to `/api/v1/auth/refresh`** (`utils.py:59`). A real browser therefore never sends it to `/api/v1/auth/logout`, so `LogoutView`'s revocation branch is dead in production while the tests pass — Django's test client ignores cookie paths. Do not "fix" the tests; changing the path affects the gateway and the frontend contract.
- **`COOKIE_DOMAIN` has a magic value.** `domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None` appears four times (`utils.py:49,60,127,139`). Literal `localhost` means "emit no Domain attribute". Change all four together.
- **`RefreshToken.token_hash` is unique and is inserted as the literal `'placeholder'`** before being updated with the real hash (`utils.py:28-39`). Two concurrent issuances inside that window collide with `IntegrityError`. Also: it means a row briefly exists that no token matches.
- **Refresh expiry is enforced only by the JWT `exp`.** `refresh_tokens.expires_at` is written at creation and never read (`RefreshView`, `views.py:194-209`, checks revocation and hash only). `last_used_at` is never written at all.
- **`DeleteUserView` does not check `user.is_active`** — unlike every other authenticated view. Disabled users can still delete themselves.
- **Cascade delete is not atomic.** user-service is called first; if the subsequent local `User.delete()` fails, the remote data is already gone. There is no compensation and no retry (single `httpx` call, 10 s timeout, `utils.py:179`).
- **`.delete()` returns `(total_rows, {label: count})`** and `total_rows` includes cascaded rows. Always index the dict: `deleted_counts.get('authentication.User', 0)` (`utils.py:199-204`).
- **Missing JWT key files are silent when `DEBUG=True`.** `settings.py:158-164` catches `FileNotFoundError`, prints a warning and sets `JWT_KEYS = {'private': '', 'public': ''}`. The service boots and passes its healthcheck while every token operation fails. With `DEBUG=False` it raises instead.
- **`/health` never touches the database.** Container health says nothing about DB connectivity.
- **`GET /api/v1/auth/verify` and `DELETE /api/v1/auth/delete` have zero view tests.** Changing `views.py` around them is unguarded — add tests when you touch them.
- **Gateway public paths are only `login`, `register`, `refresh`** (`srcs/api-gateway/middleware/auth_middleware.py:22-29`). Any new unauthenticated endpoint here also needs adding there, or the gateway 401s first. That file is outside this service.
- **`PORT` in `.env.example` is read by nothing.** The listen port is hardcoded in `Dockerfile:39` (`runserver 0.0.0.0:3001`).
- **`gunicorn` is pinned in `requirements.txt` but unused** — the container runs Django's dev server.
- **Auth migrations run before user-service migrations** (`scripts/run-migrations.sh:43-46`). That ordering is a script convention, not a database constraint: `user_schema` holds `user_id` as a plain `UUIDField` soft reference, with no FK to `auth_schema.users` (`srcs/user-service/apps/profiles/models.py:9,14`).
- **`success_response` emits `…isoformat() + 'Z'` but `Custom404Middleware` emits `…isoformat()` without the `Z`** (`utils.py:81` vs `middleware.py:36`). Timestamps are not uniform across 404s and everything else.

## Testing Notes

- `docker compose run --rm auth-service python -m pytest tests/ -v` is the right command: all 102 tests are unit-level, nothing resolves another service hostname. `docker exec` is only needed when you specifically want the running container (e.g. coverage against a live process).
- **No rebuild is needed for new test files or source edits.** `docker-compose.yml:188` bind-mounts the entire `./srcs/auth-service` over `/app`. Only `requirements.txt` changes require `docker compose build auth-service`. This differs from most other services in the repo.
- **`tests/conftest.py` is empty.** Fixtures are module-level in `tests/test_views.py`: `client` (Django `Client`), `user_data` (dict), `user` (created via `User.objects.create_user`). `TestRefreshView` and `TestLogoutView` each define a local `user_with_refresh_token` fixture returning `(user, raw_token, record)`; `TestChangePasswordView` defines `authenticated_client`, which just sets `client.cookies['access_token']`.
- **Every DB-touching class needs `@pytest.mark.django_db`** on the class (that is the existing style — not per-function).
- **Tests sign real JWTs with the real `keys/` pair.** There is no key mocking and no `freezegun` usage despite it being installed. Expiry tests build tokens by hand with `jwt.encode` and a past `exp`.
- **Nothing is mocked anywhere in this suite** — no `unittest.mock`, no httpx stubs. That is why `delete_user_cascade` (the only outbound HTTP call) has no tests.
- `pytest.ini` sets `--reuse-db`: after changing a model or migration, add `--create-db` or the run fails against a stale `test_smartbreeds`.
- Markers `slow` and `integration` are declared in `pytest.ini` with `--strict-markers`; any other marker name errors out.
- Cookie assertions read `response.cookies['access_token']['httponly'] | ['max-age'] | ['path'] | ['samesite']` and `.value`. Follow that pattern rather than parsing `Set-Cookie` strings.

## Config & Thresholds

Everything tunable is a `decouple.config(...)` call in `config/settings.py` with a hardcoded fallback; nothing is read from the environment anywhere else in the codebase (`apps/` only ever reads `django.conf.settings`).

| Value | Where |
|---|---|
| Access token TTL / `access_token` Max-Age | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `settings.py:131` → `jwt_utils.py:18`, `utils.py:45` |
| Refresh token TTL / Max-Age / `expires_at` | `JWT_REFRESH_TOKEN_LIFETIME_DAYS`, `settings.py:132` → `jwt_utils.py:49`, `utils.py:31,55` |
| Signing algorithm | `JWT_ALGORITHM`, `settings.py:130` — must stay `RS256`; the gateway holds only the public key |
| Key paths | `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`, `settings.py:133-134`, loaded once by `load_jwt_keys()` at import |
| Cookie flags | `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN`, `settings.py:137-139` |
| Minimum password length (8) | `AUTH_PASSWORD_VALIDATORS`, `settings.py:89` — a Django validator option, not an env var |
| Letter + digit requirement | `validators.py:27-37`, wired at `settings.py:92` |
| user-service cascade timeout (10 s) | hardcoded in `utils.py:179` — the one literal that is *not* configurable |
| user-service base URL | `USER_SERVICE_URL`, `settings.py:167` |
| DB schema (`auth_schema`) | `settings.py:73`, `OPTIONS.options` search_path |

When adding a tunable, put it in `config/settings.py` with a sane default, document it in `.env.example`, and reference it via `django.conf.settings` — do not call `decouple.config` from `apps/`.
