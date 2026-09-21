# Auth Service

Django + Django REST Framework microservice that owns user identity for the SmartBreeds platform. It is the only component holding the RS256 **private** key: it registers and authenticates users (with optional TOTP two-factor authentication), lets them update their name and email, signs access/refresh JWTs, delivers them as HTTP-only cookies, rotates and revokes refresh tokens, and drives cross-service account deletion. Every other service verifies tokens with the public key only and can never mint one.

Runs on internal port **3001** on `backend-network`. It has **no host port** — reach it through the API Gateway (`localhost:8001`) or Nginx (`localhost:8000` / `localhost:8443`, mapped to the container's 80/443 at docker-compose.yml:11-13).

---

## Responsibilities

- Custom `User` model (UUID PK, email as username, Argon2 hashing, `user`/`admin` roles).
- Registration with password confirmation and per-project password rules.
- Login with a **single-session policy**: every prior refresh token is revoked on each login (`views.py:130`).
- RS256 JWT issuance — access, refresh and the 2FA challenge token (`jwt_utils.py:7-86`) — and validation (`jwt_utils.py:88-108`).
- Refresh-token persistence as SHA-256 hashes only — raw tokens never hit the database (`models.py:95`, `jwt_utils.py:120`).
- Refresh-token **rotation**: the presented token is revoked and a new pair issued (`views.py:359-371`).
- Password change that revokes all sessions and re-issues a fresh pair (`views.py:562-659`).
- Profile update (`PATCH /me`): first name, last name and email. An email change re-authenticates with the current password (plus a 2FA code when 2FA is on) and re-issues the session because the access token embeds the email.
- TOTP two-factor authentication for authenticator apps (Aegis, Microsoft Authenticator, Google Authenticator, …): setup, enable with single-use recovery codes, disable, and a two-step login. See [Two-factor authentication](#two-factor-authentication).
- Cascade account deletion: deletes user-service data over HTTP first, then auth rows (`utils.py:220-280`).
- Owns the `auth_schema` PostgreSQL schema (`settings.py:73`).

Explicitly **not** here: Django admin (removed), email verification (`is_verified` defaults to `True`, `models.py:54`) — including verification of a *new* address on email change, password *reset by email*, OAuth, WebAuthn/SMS factors, and a recovery-code regeneration endpoint (disable then re-enable 2FA to get a new set).

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

Gateway-level public paths are `/api/v1/auth/login`, `/api/v1/auth/login/2fa`, `/api/v1/auth/register`, `/api/v1/auth/refresh` (`srcs/api-gateway/middleware/auth_middleware.py:22-30`). Everything else on this service — including `logout` — must carry a gateway-valid `access_token` cookie or the gateway 401s before the request ever arrives. "Gateway-valid" means the JWT verifies **and** has `token_type == "access"`: the gateway rejects refresh and two-factor challenge tokens even though this service signed them.

**Outbound.**

| Target | When | Client / timeout |
|---|---|---|
| PostgreSQL `auth_schema` | every request touching users/tokens | Django ORM, `ATOMIC_REQUESTS: False` (`settings.py:75`) |
| `USER_SERVICE_URL` `DELETE /api/v1/users/delete` | only from `DELETE /api/v1/auth/delete` | `httpx.Client(timeout=10.0)`, no retries (`utils.py:253`) |

The user-service call goes **direct** to `http://user-service:3002`, not through the API Gateway, carrying `X-User-ID`, `X-User-Role`, `X-Request-ID` headers (`utils.py:244-248`).

**Key distribution.** `keys/jwt-private.pem` stays in this service. `keys/jwt-public.pem` is bind-mounted read-only into the API Gateway at `/app/keys/jwt-public.pem` (docker-compose.yml:310). `keys/generate-keys.sh` produces a **4096-bit** RSA pair (`generate-keys.sh:40`), chmod 600/644. **Neither key is tracked by git** (`.gitignore:20-21`) and `.dockerignore` keeps them out of image layers; `make up` runs the script for you. It is idempotent: with no private key it creates the pair; with one it only rewrites a public key that does not match it (existing tokens stay valid); `--force` replaces both and invalidates every issued token. The gateway mount uses `create_host_path: false`, so starting it without the public key is an error rather than Docker silently creating a root-owned *directory* at that path.

---

## API Reference

URL composition: `config/urls.py:9` includes `apps.authentication.urls` under `api/v1/auth/`, and every route in `apps/authentication/urls.py:11-17` is registered without a trailing slash. `APPEND_SLASH = False` (`settings.py:41`), so **a trailing slash is a 404**, not a redirect.

There are no DRF authentication or permission classes configured (`settings.py:116-123`). Each view extracts and decodes the cookie itself.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | none | Create account, auto-login |
| POST | `/api/v1/auth/login` | none | Authenticate, issue cookies — or, with 2FA on, a challenge token |
| POST | `/api/v1/auth/login/2fa` | challenge token in body | Second login step: code → cookies |
| POST | `/api/v1/auth/refresh` | `refresh_token` cookie | Rotate token pair |
| POST | `/api/v1/auth/logout` | `refresh_token` cookie (optional) | Revoke token, clear cookies |
| GET | `/api/v1/auth/verify` | `access_token` cookie | Validate access token |
| PUT | `/api/v1/auth/change-password` | `access_token` cookie | Change password, revoke all sessions |
| PATCH | `/api/v1/auth/me` | `access_token` cookie | Update first name, last name, email |
| POST | `/api/v1/auth/2fa/setup` | `access_token` cookie | Stage a TOTP secret, return the `otpauth://` URI |
| POST | `/api/v1/auth/2fa/enable` | `access_token` cookie | Confirm the setup, return recovery codes |
| POST | `/api/v1/auth/2fa/disable` | `access_token` cookie | Turn 2FA off |
| DELETE | `/api/v1/auth/delete` | `access_token` cookie | Cascade-delete the account |
| GET | `/health` | none | Docker healthcheck |

### Envelope

Every response from `utils.success_response` / `utils.error_response` (`utils.py:68-108`):

```json
{ "success": true,  "data": { }, "error": null, "timestamp": "2026-08-10T12:00:00.000000Z" }
{ "success": false, "data": null,
  "error": { "code": "ERROR_CODE", "message": "Human readable", "details": {} },
  "timestamp": "2026-08-10T12:00:00.000000Z" }
```

Unmatched URLs are converted from Django's HTML 404 to the same JSON shape with code `NOT_FOUND` by `Custom404Middleware` (`middleware.py:11-41`).

The `user` object returned everywhere is `UserSerializer` (`serializers.py:18-26`):

```json
{ "id": "<uuid>", "email": "a@b.c", "first_name": "", "last_name": "", "role": "user", "is_verified": true,
  "two_factor_enabled": false }
```

### Cookies

Set by `issue_auth_tokens` (`utils.py:44-63`), cleared by `clear_auth_cookies` (`utils.py:183-216`).

| Cookie | Max-Age | Path | HttpOnly | Secure | SameSite | Domain |
|---|---|---|---|---|---|---|
| `access_token` | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60` | `/` (default) | yes | `COOKIE_SECURE` | `COOKIE_SAMESITE` | `COOKIE_DOMAIN`, or `None` when it equals `localhost` |
| `refresh_token` | `JWT_REFRESH_TOKEN_LIFETIME_DAYS * 86400` | `/api/v1/auth/refresh` | yes | `COOKIE_SECURE` | `COOKIE_SAMESITE` | same rule |

### JWT payloads

Access (`jwt_utils.py:20-27`): `user_id`, `email`, `role`, `token_type: "access"`, `iat`, `exp`.
Refresh (`jwt_utils.py:51-57`): `user_id`, `token_id` (the `refresh_tokens.id` UUID), `token_type: "refresh"`, `iat`, `exp`.
Two-factor challenge (`generate_mfa_token`): `user_id`, `token_type: "mfa"`, `iat`, `exp` (`TWO_FACTOR_CHALLENGE_LIFETIME_MINUTES`, default 5). Nothing else — no role, no email. It is returned in a JSON body, **never** set as a cookie.
Signed with `JWT_KEYS['private']`, verified with `JWT_KEYS['public']`, algorithm `JWT_ALGORITHM`. `token_type` is what tells the three apart, and every consumer must check it (this service's views and the API Gateway both do).

---

### POST /api/v1/auth/register

`RegisterSerializer` (`serializers.py:28-72`).

```json
{ "email": "user@example.com", "password": "Password123",
  "password_confirm": "Password123", "first_name": "John", "last_name": "Doe" }
```

`first_name` / `last_name` optional and blank-allowed; the other three required. Email is lowercased and uniqueness-checked case-insensitively (`serializers.py:49-54`).

**201** → `{"user": {…}}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | Serializer email error containing "already exists" (`views.py:237-245`) |
| `VALIDATION_ERROR` | 422 | Any other serializer failure; `details` holds the DRF error dict |

Password rules come from `AUTH_PASSWORD_VALIDATORS` (`settings.py:83-94`): Django's `UserAttributeSimilarityValidator`, `MinimumLengthValidator` with `min_length: 8`, plus the project's `PasswordValidator` requiring at least one letter and one digit (`validators.py:27-37`). Django's `CommonPasswordValidator` and `NumericPasswordValidator` are **not** enabled.

### POST /api/v1/auth/login

`LoginSerializer` (`serializers.py:193-201`): `{"email": "...", "password": "..."}`.

**200** → `{"user": {…}}` plus both cookies. All previously active refresh tokens for the user are revoked first (`views.py:130`).

**200, account has 2FA enabled** → the password alone does not open a session:

```json
{ "mfa_required": true, "mfa_token": "<JWT, token_type mfa, 5 min>" }
```

No cookies are set, no `user` is returned, and **existing sessions are not revoked** — otherwise anyone who knows the password could log the owner out just by retrying. Send `mfa_token` and a code to [`POST /login/2fa`](#post-apiv1authlogin2fa) to finish. An account whose 2FA setup was started but never confirmed logs in normally.

| Code | Status | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Missing/invalid email or password field |
| `INVALID_CREDENTIALS` | 401 | Unknown email or wrong password (same message for both) |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |

### POST /api/v1/auth/login/2fa

Public at the gateway (the caller has no cookie yet). `TwoFactorLoginSerializer`:

```json
{ "mfa_token": "<from POST /login>", "code": "123456" }
```

`code` is a 6-digit TOTP code (spaces tolerated: `123 456`) **or** a recovery code (`ABCD-EFGH-JKMN`, case and dashes ignored). It must be a JSON *string*. Checks, in order: body valid → `mfa_token` decodes → `token_type == "mfa"` → user exists → user active → 2FA still enabled → code verified (see [verification rules](#verification-rules)). On success previous refresh tokens are revoked (single-session policy) and both cookies are issued.

**200** → `{"user": {…}}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Missing/blank `mfa_token` or `code`, or `code` longer than 32 characters |
| `TOKEN_EXPIRED` | 401 | Challenge older than `TWO_FACTOR_CHALLENGE_LIFETIME_MINUTES` — log in again |
| `INVALID_TOKEN` | 401 | Bad signature, a token that is not an `mfa` token (access/refresh tokens are refused), deleted user, or 2FA switched off since the challenge |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `INVALID_2FA_CODE` | 401 | Wrong, replayed or already-used code |
| `RATE_LIMIT_EXCEEDED` | 429 | Account locked after too many failures |

### POST /api/v1/auth/refresh

No body. Reads the `refresh_token` cookie. Validation order (`views.py:278-373`): cookie present → JWT decodes → `token_type == "refresh"` → `refresh_tokens` row exists for `token_id` → row not revoked → stored SHA-256 matches the presented token → user exists → user active. Then the row is marked revoked and a brand-new pair is issued.

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

Always **200** with `{"message": "Successfully logged out"}` and both cookies cleared. If a decodable refresh token is present its row is revoked; missing, malformed, expired or unknown tokens are swallowed (`views.py:384-405`).

### GET /api/v1/auth/verify

Reads the `access_token` cookie. **200** → `{"user": {…}, "valid": true}`.

| Code | Status | Cause |
|---|---|---|
| `MISSING_TOKEN` | 401 | No `access_token` cookie |
| `TOKEN_EXPIRED` | 401 | Expired signature |
| `INVALID_TOKEN` | 401 | Invalid signature, `token_type != "access"`, or user not found |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |

### PUT /api/v1/auth/change-password

`ChangePasswordSerializer` (`serializers.py:74-116`), the first three fields required:

```json
{ "current_password": "Password123", "new_password": "newSecure456",
  "new_password_confirm": "newSecure456", "code": "123456" }
```

`code` (TOTP or recovery code) is **required only when the account has 2FA enabled**. The new password must pass every validator *with the user in scope* (so `UserAttributeSimilarityValidator` really rejects passwords resembling the email or name), must differ from the current one, and may not exceed 128 characters (OWASP ASVS 2.1.2).

Token is checked *before* the body is parsed. On success the password is written, **all** non-revoked refresh tokens for the user are revoked, and a fresh pair of cookies is issued (`views.py:646-657`).

**200** → `{"message": "Password changed successfully"}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` | 401 | No `access_token` cookie |
| `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems, as in `verify` |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `VALIDATION_ERROR` | 422 | Wrong `current_password`, mismatched confirmation, new password failing the validators, equal to the current one or over 128 characters, or `code` missing while 2FA is on |
| `INVALID_2FA_CODE` | 422 | 2FA is on and the `code` is wrong, replayed or spent (422, not 401: see [status codes](#status-codes-on-authenticated-2fa-endpoints)) |
| `RATE_LIMIT_EXCEEDED` | 429 | 2FA lockout is active for the account |

### PATCH /api/v1/auth/me

Update the authenticated user's profile. `UpdateProfileSerializer`; every field optional but at least one of the first three is required:

```json
{ "first_name": "Ada", "last_name": "Lovelace",
  "email": "ada@example.com", "current_password": "Password123", "code": "123456" }
```

- **Names**: trimmed, at most 150 characters, blank allowed (clears the value). No password needed; sessions and cookies are untouched.
- **Email**: lowercased, must be unique case-insensitively. Changing it needs `current_password`, and `code` too when 2FA is on. Order of checks: password → 2FA code → uniqueness, so an address cannot be probed without the password. Re-sending the current address is a no-op. On success **all refresh tokens are revoked and fresh cookies are issued** (the access token embeds the email, so the old one would go stale).
- Only `first_name`, `last_name` and `email` can be written. `role`, `is_staff`, `is_verified`, `is_active`, `id`, `password`… in the body are ignored.
- A concurrent registration taking the address between the check and the write is caught (`IntegrityError`) and reported as 409.

**200** → `{"user": {…}}`, plus both cookies only when the email changed.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems, as in `change-password` |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `VALIDATION_ERROR` | 422 | Nothing to update, bad types/lengths/email format, missing or wrong `current_password`, or `code` missing while 2FA is on |
| `INVALID_2FA_CODE` | 422 | 2FA is on and the `code` is wrong, replayed or spent |
| `EMAIL_ALREADY_EXISTS` | 409 | Another account has that address |
| `RATE_LIMIT_EXCEEDED` | 429 | 2FA lockout is active for the account |

### POST /api/v1/auth/2fa/setup

No body. Starts enrolling an authenticator app: generates a 160-bit secret, stores it **encrypted** as a *pending* setup and returns it. Nothing is enforced yet, so a login still needs only the password. Calling it again replaces the pending secret. The response carries `Cache-Control: no-store`.

**200** →

```json
{ "secret": "JBSWY3DPEHPK3PXP…", "otpauth_uri": "otpauth://totp/SmartBreeds:a%40b.c?secret=…&issuer=SmartBreeds&algorithm=SHA1&digits=6&period=30",
  "issuer": "SmartBreeds", "algorithm": "SHA1", "digits": 6, "period": 30 }
```

The frontend renders `otpauth_uri` as a QR code (no image is generated server-side) and shows `secret` for manual entry.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `TWO_FACTOR_ALREADY_ENABLED` | 409 | 2FA is already on; the existing secret is left untouched |

### POST /api/v1/auth/2fa/enable

`TwoFactorConfirmSerializer`: `{ "current_password": "…", "code": "123456" }`. The password is required so that a bare stolen session cannot enrol an attacker's authenticator and lock the owner out. `code` must be a **TOTP** code from the pending secret (a recovery-style code is refused).

On success 2FA is switched on, the confirming code is marked spent, **ten recovery codes** are generated, all refresh tokens are revoked and fresh cookies are issued. The response carries `Cache-Control: no-store`.

**200** → `{"recovery_codes": ["ABCD-EFGH-JKMN", …]}`. This is the only time the codes are shown; only their SHA-256 hashes are stored.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `VALIDATION_ERROR` | 422 | Missing field or wrong `current_password` |
| `INVALID_2FA_CODE` | 422 | The code does not match the pending secret |
| `TWO_FACTOR_SETUP_REQUIRED` | 409 | `2fa/setup` was never called |
| `TWO_FACTOR_ALREADY_ENABLED` | 409 | 2FA is already on |

### POST /api/v1/auth/2fa/disable

`TwoFactorConfirmSerializer`: `{ "current_password": "…", "code": "…" }` where `code` is a TOTP **or** an unused recovery code. Subject to the same [lockout](#verification-rules) as login. On success the secret and all recovery codes are deleted, all refresh tokens are revoked and fresh cookies are issued.

**200** → `{"message": "Two-factor authentication disabled"}` plus both cookies.

| Code | Status | Cause |
|---|---|---|
| `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 | Token problems |
| `ACCOUNT_DISABLED` | 403 | `user.is_active` is false |
| `VALIDATION_ERROR` | 422 | Missing field or wrong `current_password` |
| `INVALID_2FA_CODE` | 422 | Wrong, replayed or spent code |
| `RATE_LIMIT_EXCEEDED` | 429 | Account locked after too many failures |
| `TWO_FACTOR_NOT_ENABLED` | 409 | 2FA is off (a pending, unconfirmed setup counts as off) |

### DELETE /api/v1/auth/delete

Reads the `access_token` cookie, then runs `delete_user_cascade` (`utils.py:220-280`):

1. `DELETE {USER_SERVICE_URL}/api/v1/users/delete` with `X-User-ID`, `X-User-Role`, `X-Request-ID`. Anything other than HTTP 200, or a connection error, raises.
2. `User.objects.filter(id=...).delete()` — `refresh_tokens` rows go with it via `on_delete=CASCADE` (`models.py:94`).

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

## Two-factor authentication

TOTP per RFC 6238 with the parameters every mainstream authenticator app honours and nothing else: HMAC-SHA1, 6 digits, 30 s period (`two_factor.py`). Implemented on the standard library (`hmac`, `hashlib`, `struct`, `secrets`) and pinned to the RFC 4226 / 6238 test vectors in `tests/test_two_factor.py` — no third-party OTP dependency.

**Flow**

```
enrol:  POST 2fa/setup ──> scan otpauth_uri ──> POST 2fa/enable {password, code} ──> 10 recovery codes
login:  POST login {email, password} ──> {mfa_required, mfa_token} ──> POST login/2fa {mfa_token, code} ──> cookies
```

### Verification rules

`two_factor.verify_second_factor(user, code)` returns `ok`, `invalid` or `locked`. It is the single choke point used by `login/2fa`, `2fa/disable`, `change-password` and an email change.

- **Window** ±`TWO_FACTOR_WINDOW` steps (default ±1 = ±30 s) for clock drift; constant-time comparison; non-ASCII digits and wrong lengths never reach the comparison.
- **Replay** (RFC 6238 §5.2): `two_factor_auth.last_used_step` records the newest accepted step and any code at or before it is refused, so a code observed on the wire cannot be reused within its validity window.
- **Recovery codes** are 12 characters from an alphabet without `0/O/1/I` (60 bits), shown as `ABCD-EFGH-JKMN`, hashed with SHA-256 at rest and consumed by an atomic `UPDATE … WHERE used_at IS NULL`, so a code works exactly once even under concurrent requests.
- **Lockout**: `TWO_FACTOR_MAX_ATTEMPTS` (default 5) consecutive failures lock verification for `TWO_FACTOR_LOCKOUT_MINUTES` (default 15). The counter lives on the account, not on the challenge token or the IP, because gateway rate limits are per user/IP and 10⁶ codes are otherwise guessable; minting fresh challenge tokens does not reset it. Attempts while locked neither count nor extend the lock. A success resets the counter. The trade-off: someone who knows the password can keep the owner's second step locked. Lockouts are logged at WARNING (`Two-factor lockout for user …`); codes and secrets are never logged.
- **Concurrency**: the row is read `SELECT … FOR UPDATE` inside a transaction, so parallel requests can neither spend one code twice nor dodge the counter.

### Secret storage

The base32 secret is encrypted with Fernet (AES-128-CBC + HMAC-SHA256) before it is written to `two_factor_auth.secret_encrypted`; a database dump alone does not yield working authenticator seeds. The key is `TWO_FACTOR_ENCRYPTION_KEY`, or — when that is empty — derived from `SECRET_KEY`. **Changing that key makes every stored secret undecryptable** (2FA logins for those users then fail with a 500 until 2FA is reset); there is no key-rotation support.

### Status codes on authenticated 2FA endpoints

A wrong code is `INVALID_2FA_CODE` with **401 on `login/2fa`** (no session exists yet) but **422 on every authenticated endpoint** (`2fa/enable`, `2fa/disable`, `change-password`, `PATCH /me`). Many frontends treat any 401 as "session expired" and redirect to login; a mistyped code must not log the user out. This mirrors how a wrong `current_password` is already a 422.

### Security boundaries

- The challenge token (`token_type: "mfa"`) is a JWT signed with the same key as access tokens. It is safe only because every consumer checks `token_type`: this service's views, and the API Gateway (`extract_user_context` in `srcs/api-gateway/auth/jwt_utils.py`). Without the gateway check the token would be a full session on every gateway route (ROADMAP `GW-01`).
- Enabling requires the current password; disabling requires the password **and** a valid second factor.
- Existing sessions survive the password step of a 2FA login and are revoked only when the second step succeeds.
- Setup, enable, disable and email/password changes revoke every other session and re-issue cookies for the caller.

### Locked-out or lost-device users

There is no admin API. With shell access to the container:

```bash
docker exec -it ft_transcendence_auth_service python manage.py shell -c "
from apps.authentication.models import TwoFactorAuth, RecoveryCode
email = 'user@example.com'
# Lift a lockout only:
TwoFactorAuth.objects.filter(user__email=email).update(failed_attempts=0, locked_until=None)
# Or remove 2FA entirely (user lost the device and every recovery code):
# TwoFactorAuth.objects.filter(user__email=email).delete(); RecoveryCode.objects.filter(user__email=email).delete()
"
```

---

## Data Model

Schema `auth_schema`, forced by the connection option `-c search_path=auth_schema,public` (`settings.py:73`). The schema itself is created by `srcs/db/init-scripts/01-init-schemas.sql:7`, not by Django. Migrations: `0001_initial` (User), `0002_refreshtoken`, `0003_two_factor` (`two_factor_auth`, `recovery_codes`).

### `users` — `apps.authentication.User` (`models.py:35-87`)

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

### `refresh_tokens` — `apps.authentication.RefreshToken` (`models.py:90-111`)

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

### `two_factor_auth` — `apps.authentication.TwoFactorAuth`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | **OneToOne** → `users`, `on_delete=CASCADE`, `related_name='two_factor'` |
| `secret_encrypted` | text | Fernet ciphertext of the base32 secret, never the raw secret |
| `is_enabled` | bool | default `false`; `false` = pending setup, which never gates a login |
| `last_used_step` | bigint | default `0`; newest accepted TOTP time step (replay guard) |
| `failed_attempts` | smallint | default `0`; consecutive failures |
| `locked_until` | timestamptz null | set when `failed_attempts` reaches `TWO_FACTOR_MAX_ATTEMPTS` |
| `created_at`, `enabled_at` | timestamptz | `auto_now_add` / set when setup is confirmed |

`User.two_factor_enabled` (property) is `True` only for a row with `is_enabled=true`; it costs one query per serialisation of a user.

### `recovery_codes` — `apps.authentication.RecoveryCode`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK → `users` | `on_delete=CASCADE`, `related_name='recovery_codes'` |
| `code_hash` | varchar(64) | **unique**, SHA-256 hex of the normalised code (uppercase, no dashes) |
| `created_at`, `used_at` | timestamptz | `used_at` is set atomically when the code is spent |

Index on `(user, used_at)`. Deleting a user removes both tables' rows by cascade.

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
| `COOKIE_DOMAIN` | `localhost` | `localhost` (`:139`) | Literal `localhost` is translated to "no Domain attribute" (`utils.py:51`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | same (`:126`) | `Csv()`; `CORS_ALLOW_CREDENTIALS` is hardcoded `True` (`:127`) |
| `USER_SERVICE_URL` | `http://user-service:3002` | `http://user-service:3002` (`:167`) | Cascade-delete target |
| `TWO_FACTOR_ISSUER` | `SmartBreeds` | `SmartBreeds` | Label authenticator apps show next to the account |
| `TWO_FACTOR_ENCRYPTION_KEY` | *(empty)* | *(empty)* | Fernet key encrypting TOTP secrets. Empty ⇒ derived from `SECRET_KEY`. Generate one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Changing it invalidates stored secrets |
| `TWO_FACTOR_WINDOW` | `1` | `1` | Accepted 30 s steps either side of now |
| `TWO_FACTOR_MAX_ATTEMPTS` | `5` | `5` | Consecutive failures before the account is locked |
| `TWO_FACTOR_LOCKOUT_MINUTES` | `15` | `15` | Lock duration |
| `TWO_FACTOR_CHALLENGE_LIFETIME_MINUTES` | `5` | `5` | How long the `mfa_token` from the password step stays valid |
| `PORT` | `3001` | — | **Present in `.env.example` but read by no code.** The listen port is hardcoded in the Dockerfile CMD |

JWT keys are read from disk at import time by `load_jwt_keys()` (`settings.py:152-174`). If either file is missing: with `DEBUG=False` the process dies with `FileNotFoundError`; with `DEBUG=True` it prints a warning and sets `JWT_KEYS` to empty strings, after which every sign/verify operation fails at runtime.

---

## Running

```bash
# From the repository root
make up                      # brings up the whole stack (default profile: cloud, Makefile:9)
make up COMPOSE_PROFILES=local   # auth-service is identical in the local profile

docker compose up auth-service -d   # this service alone (compose starts `db` first)
make logs-auth-service
make exec-auth_service       # note the underscore: exec-% builds ft_transcendence_$* (Makefile:167)
```

Prerequisites, in order:

1. `srcs/auth-service/.env` exists — copy from `.env.example`. Compose fails outright without it.
2. `keys/jwt-private.pem` and `keys/jwt-public.pem` exist — `make keys` creates them (`make up` does it automatically). The gateway bind-mounts the public key, and compose refuses to start it without the file.
3. `db` is healthy (enforced by `depends_on`).
4. Migrations applied — `make migration` (`scripts/run-migrations.sh:45-46` runs `makemigrations` then `migrate` for this service **first**). The ordering is enforced by that script only: user-service stores `user_id` as a plain `UUIDField` soft reference, not a database FK to `auth_schema.users` (`srcs/user-service/apps/profiles/models.py:9,14`).

Optional: `make superuser` runs `scripts/create-superuser.sh`, which calls `createsuperuser --no-input` inside the container. Django admin is not installed, so a superuser is only useful for the `admin` role.

Runtime notes: the image runs `python manage.py runserver 0.0.0.0:3001` (Dockerfile:39) — the Django development server, with the auto-reloader. `gunicorn` is in `requirements.txt` but is not used. Because `./srcs/auth-service` is bind-mounted over `/app`, editing Python files reloads in place; only `requirements.txt` changes need `docker compose build auth-service`.

Image facts: `python:3.11-slim`; apt `gcc`, `postgresql-client`, `libpq-dev`, `curl`; installs both `requirements.txt` and `requirements-dev.txt` (test tooling ships in the image); non-root user `authuser` uid 1000; `EXPOSE 3001`.

Pinned dependencies: Django 5.0.1, djangorestframework 3.14.0, PyJWT 2.8.0, cryptography 41.0.7, argon2-cffi 23.1.0, psycopg2-binary 2.9.9, django-cors-headers 4.3.1, python-decouple 3.8, httpx 0.27.0, dj-database-url 2.1.0, gunicorn 21.2.0. Dev: pytest 7.4.3, pytest-django 4.7.0, pytest-cov 4.1.0, factory-boy 3.3.0, freezegun 1.4.0.

---

## Testing

**353 tests**, all unit-level: no HTTP call leaves the process, so `docker compose run --rm` works even when nothing is running.

```bash
# Full suite (353 tests)
docker compose run --rm auth-service python -m pytest tests/ -v

# Via the repo orchestrators (expects 353)
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
| `tests/test_views.py` | 71 | `TestLoginView` 12, `TestRegisterView` 16, `TestRefreshView` 13, `TestLogoutView` 9, `TestChangePasswordView` 21 (incl. same-password, similarity, length cap, 2FA code, lockout) |
| `tests/test_views_two_factor.py` | 67 | `2fa/setup` 8, `2fa/enable` 14, login password step 6, `login/2fa` 26, `2fa/disable` 12, one full register→enable→2-step login→disable lifecycle |
| `tests/test_views_me.py` | 43 | `PATCH /me`: names 9, email 12, email + 2FA 5, input handling / mass assignment / wrong types 17 |
| `tests/test_two_factor.py` | 66 | RFC 4226/6238 vectors, drift window, malformed codes, `otpauth://` URI, Fernet, recovery codes, replay, lockout (frozen clock) |
| `tests/test_serializers.py` | 60 | User/Register/Login, `ChangePasswordSerializer` 16, `UpdateProfileSerializer` 20, `TwoFactorConfirm`/`TwoFactorLogin` |
| `tests/test_utils.py` | 16 | `get_authenticated_user` (401/403 matrix incl. refresh and mfa tokens refused), `parse_json_body` |
| `tests/test_models.py` | 16 | User, RefreshToken, `TwoFactorAuth` / `RecoveryCode` (defaults, uniqueness, cascade, `two_factor_enabled`) |
| `tests/test_jwt_utils.py` | 9 | Access/refresh/mfa generation and decoding, hashing |
| `tests/test_validators.py` | 5 | `PasswordValidator` letter/number rules and help text |

`GET /api/v1/auth/verify` and `DELETE /api/v1/auth/delete` have **no view tests**.

Shared fixtures live in `tests/conftest.py`: `client`, `user_data`, `user`, `authenticated_client` (valid `access_token` cookie), `enable_two_factor` (factory returning `(secret, recovery_codes)`) and `frozen_time` (freezegun at the current instant; `tick()` to reach the next TOTP step or expire a lock). The per-class `user_with_refresh_token` fixtures stay in `tests/test_views.py`. `pytest.ini` sets `DJANGO_SETTINGS_MODULE=config.settings` and `addopts = --strict-markers --disable-warnings --reuse-db`; `--reuse-db` means pytest-django keeps the `test_smartbreeds` database between runs, so a schema change needs `--create-db`. Custom markers `slow` and `integration` are declared but unused.

Tests sign real JWTs with the key pair from `keys/` (or the paths in `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`) — the private and public key must be a **matching pair** (`make keys` guarantees it; a mismatch makes every test that verifies a token fail with `InvalidSignatureError`) — and they need `db` reachable (which `docker compose run` starts through `depends_on`).

---

## Troubleshooting

**Container starts, every token operation fails.** `keys/jwt-private.pem` or `keys/jwt-public.pem` is missing and `DEBUG=True`, so `settings.py:168-174` fell back to empty key strings after printing `Warning: JWT private key not found at …`. Run `make keys`, then restart. With `DEBUG=False` the same condition kills the process at startup instead.

**Gateway returns 401 on `/api/v1/auth/logout` or `/verify`.** Only `login`, `register` and `refresh` are gateway-public (`srcs/api-gateway/middleware/auth_middleware.py:22-30`). With an expired access token the gateway rejects the logout before this service sees it.

**Logout does not revoke the refresh token in a browser.** The `refresh_token` cookie is scoped to `Path=/api/v1/auth/refresh` (`utils.py:61`), so a browser does not send it to `/api/v1/auth/logout`. The view then falls through its `if refresh_token:` guard and returns 200 without revoking anything. Cookies are still cleared. The tests do not catch this because Django's test client ignores cookie paths.

**404 on an endpoint that clearly exists.** You added a trailing slash. `APPEND_SLASH = False` (`settings.py:41`) disables Django's redirect; the response is the JSON `NOT_FOUND` produced by `Custom404Middleware`.

**400 `DisallowedHost`.** `ALLOWED_HOSTS` must contain `auth-service` (gateway calls it by service name) and `localhost` (the compose healthcheck curls `http://localhost:3001/health`).

**Container stuck `unhealthy`.** The healthcheck needs `curl` and a 60 s `start_period`. It only probes `/health`, which never touches the database — a healthy container can still be failing every real request because PostgreSQL is unreachable. Check `make logs-auth-service` for `psycopg2.OperationalError`.

**500 `DELETION_FAILED` on `DELETE /api/v1/auth/delete`.** user-service returned non-200 or was unreachable within the 10 s `httpx` timeout (`utils.py:253`). Nothing is deleted on the auth side in that case — the auth rows are removed only after the remote call succeeds.

**Auth rows gone but user-service data still there.** The reverse ordering failure: the remote delete succeeded and the local `User.delete()` then failed. There is no compensating transaction; the deletion is not atomic across services.

**`IntegrityError` on `refresh_tokens.token_hash`.** New rows are inserted with the literal placeholder `'placeholder'` and updated with the real hash one statement later (`utils.py:30-41`). Two token issuances interleaving inside that window collide on the unique constraint.

**A user cannot get past the second login step.** `RATE_LIMIT_EXCEEDED` means the account is locked (`two_factor_auth.locked_until` in the future); it clears itself after `TWO_FACTOR_LOCKOUT_MINUTES`. `INVALID_2FA_CODE` with a code that looks right is usually device clock drift beyond ±30 s, or a code already used once (replay guard). Lost device and recovery codes: see [Locked-out or lost-device users](#locked-out-or-lost-device-users).

**500 on `login/2fa`, `2fa/disable` or any call that verifies a code.** `cryptography.fernet.InvalidToken`: the stored secret was encrypted under a different key than the one now in effect (`SECRET_KEY` or `TWO_FACTOR_ENCRYPTION_KEY` changed). Restore the old key, or reset 2FA for the affected users.

**`PermissionError` reading `/app/keys/jwt-private.pem`.** The container runs as uid 1000 and the private key is mode 600, so on a Linux host whose user is not uid 1000 the container cannot read it. For a dev machine, `chmod 644 srcs/auth-service/keys/jwt-private.pem` (the script re-applies 600 only when it generates a key).

**Regenerating the key pair logs everyone out.** `make keys` never does it (it keeps an existing private key); only `generate-keys.sh --force` does. All previously issued access and refresh tokens become unverifiable, and the API Gateway must be restarted to pick up the new public key (it is bind-mounted, but the gateway reads it into settings at startup).
