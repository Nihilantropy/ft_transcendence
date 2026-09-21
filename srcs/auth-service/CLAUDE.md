# CLAUDE.md - Auth Service

## Overview

Django 5.0.1 + DRF, internal port 3001, container `ft_transcendence_auth_service`, `backend-network` only, no host port. Owns `auth_schema` (`users`, `refresh_tokens`, `two_factor_auth`, `recovery_codes`) and the RS256 **private** key in `keys/`. Views are plain `APIView` classes that read JWTs straight out of `request.COOKIES` — there is no DRF authentication class, no permission class, no `request.user`. Besides register/login/refresh it now hosts profile update (`PATCH /me`) and TOTP two-factor authentication (`two_factor.py`); README's *Two-factor authentication* section is the reference for the design. No compose profile is declared, so it runs identically under `local` and `cloud`.

Read `README.md` first for routes, payloads, error codes and config values. This file is only the things that will trip you up.

## Essential Commands

```bash
# Tests (353). No cross-service calls, so `run --rm` is fine and preferred.
docker compose run --rm auth-service python -m pytest tests/ -v
docker compose run --rm auth-service python -m pytest tests/test_views.py::TestRefreshView -v
./scripts/run-unit-tests.sh --auth          # orchestrator, prints 353 (a literal label, not asserted)

# After a model change, rebuild the test DB (pytest.ini pins --reuse-db)
docker compose run --rm auth-service python -m pytest tests/ --create-db -v

# Migrations (whole-repo ordering matters: auth first)
make migration                              # scripts/run-migrations.sh
docker exec ft_transcendence_auth_service python manage.py makemigrations
docker exec ft_transcendence_auth_service python manage.py migrate

# Shell / logs / keys
make exec-auth_service                      # underscore: exec-% expands to ft_transcendence_$* (Makefile:167)
make logs-auth-service                      # hyphen: logs-% takes the compose service name
make keys                                   # create the 4096-bit RSA pair if missing (make up does this); idempotent
./keys/generate-keys.sh --force             # ROTATE: new pair, invalidates every issued token
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
| `apps/authentication/views.py` | 12 `APIView` endpoints + `HealthView`. The original 7 keep their inline cookie/token checks; the newer ones (`UpdateProfileView`, `TwoFactorSetup/Enable/DisableView`) call `get_authenticated_user`. Module helpers `second_factor_error` and `validation_error` |
| `apps/authentication/urls.py` | Flat `path()` list, no router, no trailing slashes |
| `apps/authentication/models.py` | `UserManager`, `User` (+ `two_factor_enabled` property), `RefreshToken`, `TwoFactorAuth`, `RecoveryCode` |
| `apps/authentication/two_factor.py` | TOTP maths (RFC 4226/6238, stdlib only), `otpauth://` URI, Fernet encryption of secrets, recovery codes, and `verify_second_factor` (replay guard + per-account lockout) |
| `apps/authentication/serializers.py` | `UserSerializer` (output, incl. `two_factor_enabled`), `RegisterSerializer`, `ChangePasswordSerializer`, `LoginSerializer`, `UpdateProfileSerializer`, `TwoFactorConfirmSerializer`, `TwoFactorLoginSerializer` |
| `apps/authentication/jwt_utils.py` | `generate_access_token`, `generate_refresh_token`, `generate_mfa_token`, `decode_token`, `hash_token` (also used for recovery codes) |
| `apps/authentication/utils.py` | `issue_auth_tokens`, `clear_auth_cookies`, `success_response`, `error_response`, `delete_user_cascade`, `get_authenticated_user`, `parse_json_body` |
| `apps/authentication/validators.py` | `PasswordValidator` — one letter + one digit |
| `apps/authentication/middleware.py` | `Custom404Middleware` — HTML 404 → JSON `NOT_FOUND` |
| `apps/authentication/migrations/` | `0001_initial` (User), `0002_refreshtoken`, `0003_two_factor` |
| `tests/` | pytest-django. `conftest.py` holds the shared fixtures (`client`, `user_data`, `user`, `authenticated_client`, `enable_two_factor`, `frozen_time`); 9 test modules, 353 tests |
| `keys/` | `generate-keys.sh` (tracked, idempotent) and the two generated, gitignored keys: `jwt-private.pem` and `jwt-public.pem` (bind-mounted read-only into api-gateway) |

There is no `admin.py`, no `apps/authentication/tests.py`, no management commands, no `permissions.py`, no service layer.

## Request / Data Flow

**Token-issuing paths** (`register`, `login` without 2FA, `login/2fa`, `refresh`, `change-password`, `2fa/enable`, `2fa/disable`, and `PATCH /me` when the email changes) all converge on the same tail:

```
view → parse json.loads(request.body) → Serializer(...).is_valid()
     → success_response(data, status)            # builds a DRF Response
     → issue_auth_tokens(user, response)         # utils.py:13
         ├─ generate_access_token(user)                       # RS256, private key
         ├─ RefreshToken.objects.create(token_hash='placeholder', expires_at=now+N days)
         ├─ generate_refresh_token(user, record.id)           # token_id = record PK
         ├─ record.token_hash = hash_token(jwt); record.save(update_fields=['token_hash'])
         └─ response.set_cookie('access_token', …); set_cookie('refresh_token', …, path='/api/v1/auth/refresh')
     → return response
```

**Token-consuming paths** (`refresh`, `logout`, `verify`, `delete`, `change-password`) all repeat this block inline (the newer authenticated views get the same result from `utils.get_authenticated_user(request)`, which returns `(user, None)` or `(None, error_response)`):

```
request.COOKIES.get('access_token' | 'refresh_token')
  ↓ missing            → 401 MISSING_TOKEN  (verify, refresh)  /  401 UNAUTHORIZED (delete, change-password)
decode_token(token)                                   # jwt_utils.py:88, public key
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
- **Error codes are SCREAMING_SNAKE strings** chosen per situation, not per exception class. Existing vocabulary: `VALIDATION_ERROR` (422), `INVALID_CREDENTIALS` (401), `EMAIL_ALREADY_EXISTS` (409), `MISSING_TOKEN`/`INVALID_TOKEN`/`TOKEN_EXPIRED`/`TOKEN_REVOKED`/`UNAUTHORIZED` (401), `ACCOUNT_DISABLED` (403), `DELETION_FAILED` (500), `NOT_FOUND` (404), and for 2FA `INVALID_2FA_CODE` (401 on `login/2fa`, **422** elsewhere), `RATE_LIMIT_EXCEEDED` (429, account locked), `TWO_FACTOR_ALREADY_ENABLED` / `TWO_FACTOR_NOT_ENABLED` / `TWO_FACTOR_SETUP_REQUIRED` (409). Reuse before inventing.
- **Validation failures are 422, not 400.** DRF's default 400 is never used; views check `is_valid()` themselves and map to 422 with `details=serializer.errors`.
- **Body parsing is manual**: `json.loads(request.body) if request.body else {}` inside a `try/except json.JSONDecodeError` that falls back to `{}`. The original views inline it; new views call `utils.parse_json_body(request)`, which does the same and additionally maps non-object JSON (`[1]`, `null`) to `{}`. Do not switch to `request.data` in one view only.
- **Routes carry no trailing slash.** `APPEND_SLASH = False` (`config/settings.py:41`); add `path('thing', ThingView.as_view(), name='thing')` to `apps/authentication/urls.py` and the full path becomes `/api/v1/auth/thing`.
- **Authenticated views: use the helper.** The original views (`refresh`, `logout`, `verify`, `delete`, `change-password`) repeat the cookie/decode/token_type/user/is_active block inline and were left as they were. A *new* authenticated endpoint calls `user, error = get_authenticated_user(request); if error: return error` (`utils.py`), which yields the `change-password` codes (`UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_TOKEN` → 401, `ACCOUNT_DISABLED` → 403) and refuses refresh and `mfa` tokens. There is still no decorator or mixin.
- **2FA codes go through one function.** Anything that must be gated by the second factor calls `views.second_factor_error(user, code, invalid_status=…)`, which wraps `two_factor.verify_second_factor`. Pass `invalid_status=401` only where no session exists yet (`login/2fa`), **422** on authenticated endpoints, or a frontend that logs out on any 401 will sign the user out over a typo. Never compare codes anywhere else — that would bypass the replay guard and the lockout.
- **Bulk revocation uses `.update()`, not `.save()`**: `RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)`. `RefreshToken.revoke()` and `.is_valid()` exist on the model but no production code path calls them.
- **Emails are always lowercased** — in `UserManager.create_user` (`models.py:15`), in `RegisterSerializer.validate_email` and `UpdateProfileSerializer.validate_email`, and again in `LoginView`. Lookups use `email__iexact`.
- **Passwords go through `django.contrib.auth.password_validation.validate_password`**. `RegisterSerializer` attaches it as a field validator (which cannot see the user, so the similarity validator is inert there); `ChangePasswordSerializer` calls it from `validate_new_password` *with* `user=`, which is what makes `UserAttributeSimilarityValidator` work.

## Gotchas

- **`refresh_token` cookie is path-scoped to `/api/v1/auth/refresh`** (`utils.py:61`). A real browser therefore never sends it to `/api/v1/auth/logout`, so `LogoutView`'s revocation branch is dead in production while the tests pass — Django's test client ignores cookie paths. Do not "fix" the tests; changing the path affects the gateway and the frontend contract.
- **`COOKIE_DOMAIN` has a magic value.** `domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None` appears four times (`utils.py:51,60,127,139`). Literal `localhost` means "emit no Domain attribute". Change all four together.
- **`RefreshToken.token_hash` is unique and is inserted as the literal `'placeholder'`** before being updated with the real hash (`utils.py:30-41`). Two concurrent issuances inside that window collide with `IntegrityError`. Also: it means a row briefly exists that no token matches.
- **Refresh expiry is enforced only by the JWT `exp`.** `refresh_tokens.expires_at` is written at creation and never read (`RefreshView`, `views.py:323-338`, checks revocation and hash only). `last_used_at` is never written at all.
- **`DeleteUserView` does not check `user.is_active`** — unlike every other authenticated view. Disabled users can still delete themselves.
- **Cascade delete is not atomic.** user-service is called first; if the subsequent local `User.delete()` fails, the remote data is already gone. There is no compensation and no retry (single `httpx` call, 10 s timeout, `utils.py:253`).
- **`.delete()` returns `(total_rows, {label: count})`** and `total_rows` includes cascaded rows. Always index the dict: `deleted_counts.get('authentication.User', 0)` (`utils.py:273-278`).
- **Missing JWT key files are silent when `DEBUG=True`.** `settings.py:168-174` catches `FileNotFoundError`, prints a warning and sets `JWT_KEYS = {'private': '', 'public': ''}`. The service boots and passes its healthcheck while every token operation fails. With `DEBUG=False` it raises instead.
- **`/health` never touches the database.** Container health says nothing about DB connectivity.
- **`GET /api/v1/auth/verify` and `DELETE /api/v1/auth/delete` have zero view tests.** Changing `views.py` around them is unguarded — add tests when you touch them.
- **Gateway public paths are only `login`, `login/2fa`, `register`, `refresh`** (`srcs/api-gateway/middleware/auth_middleware.py:22-30`). Any new unauthenticated endpoint here also needs adding there, or the gateway 401s first. That file is outside this service.
- **The 2FA challenge token is only safe because the gateway checks `token_type`.** `generate_mfa_token` signs with the same key as access tokens and carries a `user_id`. `srcs/api-gateway/auth/jwt_utils.py::extract_user_context` rejects anything but `token_type == "access"` (ROADMAP `GW-01`); revert that and the challenge token, returned after the *password* step alone, becomes a full session on every gateway route. The challenge token is returned in the JSON body and must never be put in a cookie.
- **A wrong 2FA code is 422 on authenticated endpoints, 401 only on `login/2fa`.** Deliberate: a frontend 401-interceptor would otherwise log the user out for a typo. Keep new 2FA-gated endpoints on 422.
- **`login` does not revoke sessions when 2FA is on** — only `login/2fa` does, after the code is accepted. Moving `RefreshToken … .update(is_revoked=True)` above the challenge branch would let anyone with the password log the owner out.
- **`verify_second_factor` writes even on failure** (attempt counter, lock). It relies on `transaction.atomic()` + `select_for_update()` because `ATOMIC_REQUESTS` is `False`; do not call it inside a block you later roll back, or the failure count rolls back with it.
- **`User.two_factor_enabled` is a database query**, and `UserSerializer` includes it, so every serialised user costs one extra `EXISTS`. A pending setup (`is_enabled=False`) does not count.
- **Changing `SECRET_KEY` (or `TWO_FACTOR_ENCRYPTION_KEY`) makes every stored TOTP secret undecryptable.** With the key derived from `SECRET_KEY` (the default) that is one env var away from locking all 2FA users out with 500s. There is no rotation support.
- **`2fa/enable` accepts only a TOTP code**, not a recovery code (there is none yet at that point), and the code that confirms setup is marked spent, so the very next login needs the *next* 30 s step. Tests that do enable → login in one go must `frozen_time.tick()` between them.
- **The JWT key pair is generated per machine and tracked nowhere.** `make up`, `make test`, `scripts/init-and-test.sh --init` and `scripts/run-unit-tests.sh` run `keys/generate-keys.sh`: no private key → create the pair; private key present → only rewrite a public key that does not match it. (The old failure mode, a committed public key next to a locally generated private key, made every token unverifiable and ~25 tests fail with `InvalidSignatureError`.) Only `--force` rotates, and it invalidates every issued token. The gateway mounts the public key as a *file*, so `docker-compose.yml` sets `create_host_path: false`: with the key missing compose errors out instead of letting Docker create a root-owned directory at that path (the script detects such a directory and tells you to `sudo rm -rf` it). `srcs/auth-service/.dockerignore` (`keys/*.pem`) stops `COPY . .` baking the private key into an image layer; the bind mount supplies it at run time. The private key is mode 600 and the container runs as uid 1000, so a Linux host user with another uid needs `chmod 644` on it.
- **`PORT` in `.env.example` is read by nothing.** The listen port is hardcoded in `Dockerfile:39` (`runserver 0.0.0.0:3001`).
- **`gunicorn` is pinned in `requirements.txt` but unused** — the container runs Django's dev server.
- **Auth migrations run before user-service migrations** (`scripts/run-migrations.sh:43-46`). That ordering is a script convention, not a database constraint: `user_schema` holds `user_id` as a plain `UUIDField` soft reference, with no FK to `auth_schema.users` (`srcs/user-service/apps/profiles/models.py:9,14`).
- **`success_response` emits `…isoformat() + 'Z'` but `Custom404Middleware` emits `…isoformat()` without the `Z`** (`utils.py:83` vs `middleware.py:36`). Timestamps are not uniform across 404s and everything else.

## Testing Notes

- `docker compose run --rm auth-service python -m pytest tests/ -v` is the right command: all 353 tests are unit-level, nothing resolves another service hostname. `docker exec` is only needed when you specifically want the running container (e.g. coverage against a live process).
- **No rebuild is needed for new test files or source edits.** `docker-compose.yml:188` bind-mounts the entire `./srcs/auth-service` over `/app`. Only `requirements.txt` changes require `docker compose build auth-service`. This differs from most other services in the repo.
- **Shared fixtures live in `tests/conftest.py`**: `client` (Django `Client`), `user_data` (dict), `user` (via `User.objects.create_user`, password `testpass123`), `authenticated_client` (`access_token` cookie set), `enable_two_factor` (factory: `enable_two_factor(user) → (secret, recovery_codes)`) and `frozen_time` (freezegun pinned to the current instant; `.tick(timedelta(...))` moves the clock). `TestRefreshView` and `TestLogoutView` still define a local `user_with_refresh_token` fixture returning `(user, raw_token, record)`. Build a valid TOTP with `two_factor.totp(secret)`.
- **Anything that mints a TOTP or checks a lock needs `frozen_time`** (or `freeze_time`), otherwise a step boundary makes the test flaky; freeze at *now*, not at a fixed past date, when tokens are involved, because PyJWT rejects an `iat` in the future.
- **Every DB-touching class needs `@pytest.mark.django_db`** on the class (that is the existing style — not per-function).
- **Tests sign real JWTs with the key pair from `keys/`** (or `JWT_*_KEY_PATH`); there is no key mocking, and the pair must match (`make keys` guarantees it, see the key-pair gotcha above). `freezegun` is used for TOTP steps, lock timers and expired tokens (`with freeze_time('2026-01-01'): token = generate_access_token(user)`); older tests still build expired tokens by hand with `jwt.encode` and a past `exp`.
- **Almost nothing is mocked** — no httpx stubs, which is why `delete_user_cascade` (the only outbound HTTP call) has no tests. The single `unittest.mock.patch.object(User, 'save', side_effect=IntegrityError)` in `test_views_me.py` simulates losing a race on the unique email.
- `pytest.ini` sets `--reuse-db`: after changing a model or migration, add `--create-db` or the run fails against a stale `test_smartbreeds`.
- Markers `slow` and `integration` are declared in `pytest.ini` with `--strict-markers`; any other marker name errors out.
- Cookie assertions read `response.cookies['access_token']['httponly'] | ['max-age'] | ['path'] | ['samesite']` and `.value`. Follow that pattern rather than parsing `Set-Cookie` strings.

## Config & Thresholds

Everything tunable is a `decouple.config(...)` call in `config/settings.py` with a hardcoded fallback; nothing is read from the environment anywhere else in the codebase (`apps/` only ever reads `django.conf.settings`).

| Value | Where |
|---|---|
| Access token TTL / `access_token` Max-Age | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `settings.py:131` → `jwt_utils.py:18`, `utils.py:47` |
| Refresh token TTL / Max-Age / `expires_at` | `JWT_REFRESH_TOKEN_LIFETIME_DAYS`, `settings.py:132` → `jwt_utils.py:49`, `utils.py:33,55` |
| Signing algorithm | `JWT_ALGORITHM`, `settings.py:130` — must stay `RS256`; the gateway holds only the public key |
| Key paths | `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`, `settings.py:133-134`, loaded once by `load_jwt_keys()` at import |
| Cookie flags | `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN`, `settings.py:147-149` |
| Minimum password length (8) | `AUTH_PASSWORD_VALIDATORS`, `settings.py:89` — a Django validator option, not an env var |
| Letter + digit requirement | `validators.py:27-37`, wired at `settings.py:92` |
| user-service cascade timeout (10 s) | hardcoded in `utils.py:253` — the one literal that is *not* configurable |
| user-service base URL | `USER_SERVICE_URL`, `settings.py:177` |
| 2FA issuer label | `TWO_FACTOR_ISSUER` (`SmartBreeds`) |
| Fernet key for TOTP secrets | `TWO_FACTOR_ENCRYPTION_KEY`; empty ⇒ derived from `SECRET_KEY` |
| TOTP drift window (steps of 30 s) | `TWO_FACTOR_WINDOW` (`1`) |
| 2FA lockout | `TWO_FACTOR_MAX_ATTEMPTS` (`5`), `TWO_FACTOR_LOCKOUT_MINUTES` (`15`) |
| Login challenge lifetime | `TWO_FACTOR_CHALLENGE_LIFETIME_MINUTES` (`5`) |
| TOTP protocol parameters (SHA-1, 6 digits, 30 s) | constants in `two_factor.py`, deliberately **not** configurable — Google Authenticator and Microsoft Authenticator ignore anything else |
| DB schema (`auth_schema`) | `settings.py:73`, `OPTIONS.options` search_path |

When adding a tunable, put it in `config/settings.py` with a sane default, document it in `.env.example`, and reference it via `django.conf.settings` — do not call `decouple.config` from `apps/`.
