# Two-factor authentication + profile editing (B) — design

Date: 2026-09-27
Status: **design by the controller under the user's standing instruction ("non fermarti finché non hai
finito tutto")**; decisions recorded as rulings. Branch `feat/2fa-profile` from `develop` after
sub-project A is merged. Supersedes teammate PR #12 (musturu / Lorenzo), whose two commits
(`ffb4f85` feature, `4d0d06b` docs, on `origin/feat/auth/2fa`) are carried over with their authorship.

## Goal

Ship the subject's **Minor "Implement a complete 2FA (Two-Factor Authentication) system for the
users"** and let users edit their profile, end to end: backend from PR #12 (conflicts resolved), gate
tests (integration + e2e), and the frontend UI.

## What PR #12 already provides (auth-service + gateway)

- `POST /auth/login` → with 2FA on: `200 {mfa_required: true, mfa_token}` and **no cookies**; existing
  sessions are not revoked.
- `POST /auth/login/2fa {mfa_token, code}` → `{user}` + cookies. `code` = 6-digit TOTP (spaces tolerated)
  or a recovery code (`ABCD-EFGH-JKMN`, case/dashes ignored). Errors: `INVALID_2FA_CODE` 401,
  `TOKEN_EXPIRED` 401 (challenge older than 5 min), `INVALID_TOKEN` 401, lockout `RATE_LIMIT_EXCEEDED` 429.
- `POST /auth/2fa/setup` → `{secret, otpauth_uri, issuer, algorithm, digits, period}` (pending,
  `Cache-Control: no-store`); `TWO_FACTOR_ALREADY_ENABLED` 409.
- `POST /auth/2fa/enable {current_password, code}` → `{recovery_codes: [10]}` + fresh cookies; errors
  `VALIDATION_ERROR` 422 (wrong password), `INVALID_2FA_CODE` 422, `TWO_FACTOR_SETUP_REQUIRED` 409,
  `TWO_FACTOR_ALREADY_ENABLED` 409.
- `POST /auth/2fa/disable {current_password, code}` (TOTP or recovery) → fresh cookies;
  `TWO_FACTOR_NOT_ENABLED` 409.
- `PATCH /auth/me {first_name?, last_name?, email?, current_password?, code?}` — names free; email change
  needs the password (+ code with 2FA), re-issues cookies; `EMAIL_ALREADY_EXISTS` 409.
- `PUT /auth/change-password` gains `code` (required when 2FA is on); `INVALID_2FA_CODE` 422.
- `UserSerializer` gains `two_factor_enabled` (and first/last name already exist).
- Secrets Fernet-encrypted (`TWO_FACTOR_ENCRYPTION_KEY`, empty = derived from SECRET_KEY), recovery codes
  hashed, replay protection, 5-failure lockout for 15 min.
- `make keys` + idempotent `generate-keys.sh`; `jwt-public.pem` no longer tracked by git.
- Gateway: `/api/v1/auth/login/2fa` added to the public paths.

## Rulings (each with its cost if wrong)

1. **Cherry-pick PR #12's two commits onto `feat/2fa-profile`** (author preserved), resolve conflicts
   there; never force-push Lorenzo's branch. Cost if wrong: none.
2. **Conflict policy: `develop` wins on behaviour already merged**: #27 logout (public at the gateway,
   identifies the user from the access cookie even if expired, revokes all refresh tokens), #28
   (`token_type == "access"` at the gateway), #33 (reject-all cookie jar), #34 (X-Real-IP rate-limit key).
   PR #12's own versions of those are dropped; docs merged by hand keeping both sets of facts. Cost if
   wrong: a PR #12 nuance lost — guarded by auth-service unit tests (`--create-db`) and the gate.
3. **`jwt-public.pem` untracking**: accept PR #12's `git rm --cached` + `make keys`; `make gate` and
   `make up` must still produce a working key pair on a fresh clone. The local modified pem in the
   user's checkout becomes an untracked file (no data loss).
4. **QR code rendered in the browser with the `qrcode` npm package** (MIT), SVG → `<img
   src="data:image/svg+xml,…">` (CSP `img-src data:` already allows it). The secret is also shown as text
   grouped in fours with a copy button — the accessible alternative to the QR. Cost: ~20 KB gz of JS.
5. **Recovery codes** shown once, with "Copy" and "Download .txt" (Blob, no server call) and a required
   "I've saved them" checkbox before the dialog can close.
6. **Gate tests generate TOTP codes with a small stdlib RFC 6238 helper** in `tests/helpers.py`
   (hmac/sha1/base64/struct) — no new test dependency; unit-tested against the RFC 6238 test vector.
7. **Profile editing = first name, last name, email.** No avatar, no friends (the "Standard user
   management" Major is not claimed).

## Frontend

- `auth.tsx`: `User` gains `first_name`, `last_name`, `two_factor_enabled`. `login()` returns
  `{ mfaToken: string } | void`; new `loginWithCode(mfaToken, code)`; `refreshUser()` re-reads
  `/auth/verify` (used after enable/disable/profile changes). The A `session` hint is set only when a user
  is actually set (not on `mfa_required`).
- **Log in, second step** (same page): after `mfa_required` the card shows "Enter the 6-digit code from your
  authenticator app" (`autocomplete="one-time-code"`, `inputmode="numeric"`, pattern hint) and a toggle
  "Use a recovery code instead" (text input). `INVALID_2FA_CODE` → field error; `TOKEN_EXPIRED` → back to
  step one with "The code request expired — log in again"; 429 → lockout copy. Focus moves to the code field.
- **Profile** sections: *Your details* (first/last name, email; current password — and code when 2FA is
  on — appear only when the email differs), *Two-factor authentication*, *Change password* (+ code when
  2FA on), *Delete account*, Log out.
- **2FA section**: status "On"/"Off". Off → "Turn on" opens a native `<dialog>`: step 1 QR + secret + copy;
  step 2 current password + 6-digit code → enable; step 3 recovery codes (copy / download / confirm). On →
  "Turn off" dialog: current password + code (TOTP or recovery).
- Everything uses A's `useForm` / `PasswordField` / `ErrorSummary`, validation in the browser (6 digits,
  recovery format), strings in it/en/es, copy for every new error code, axe/CSP watchdogs apply.

## Tests

- **auth-service unit**: PR #12's suites green after the cherry-pick (`--create-db` once).
- **Integration `tests/integration/test_two_factor.py`** (gateway): setup → enable (TOTP from the secret)
  → login returns `mfa_required` and sets no cookies → `login/2fa` → session works → a recovery code works
  once and is refused the second time → change-password needs a code → disable. Profile: PATCH names;
  email change without password → 422; with password → 200 and cookies re-issued.
- **E2E UI `tests/e2e/ui/test_ui_two_factor.py`**: turn on 2FA from Profile reading the secret from the page;
  recovery codes shown; log out; log in asks for the code; wrong code → error; right code → /analyze;
  recovery-code login; turn off. Profile names saved and shown after reload.

## Out of scope

Email verification, password reset, WebAuthn/SMS, recovery-code regeneration (disable + re-enable),
avatar upload, friends/online status, OAuth (sub-project C).
