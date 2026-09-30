# Remote authentication with OAuth 2.0 — 42 Intra (C) — design

Date: 2026-09-27
Status: **design by the controller under the user's standing instruction ("non fermarti finché non hai
finito tutto")**; decisions recorded as rulings. Branch `feat/oauth-42` from `develop` after B.
Subject module: **Minor "Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.)"**;
the user chose **42 Intra**.

## Flow (authorization code grant, server side)

```
browser ── GET /api/v1/auth/oauth/42/start ─────────────► auth-service
          ◄── 302 https://api.intra.42.fr/oauth/authorize?client_id&redirect_uri&response_type=code&scope=public&state
          + Set-Cookie oauth_state=<random> (HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth/oauth, 10 min)
browser ── (user approves on intra) ── GET /api/v1/auth/oauth/42/callback?code&state ──► auth-service
          auth-service: state == cookie? → POST https://api.intra.42.fr/oauth/token (code → access token)
                        → GET https://api.intra.42.fr/v2/me → {id, email, login, first_name, last_name}
                        → find/link/create user → session cookies (or a 2FA challenge)
          ◄── 302 /?oauth=ok   (or /login?oauth=mfa#<mfa_token>, or /login?oauth=error|unavailable)
```

## Rulings (each with its cost if wrong)

1. **Everything server side in auth-service**; the client secret never reaches the browser. Two views,
   `OAuth42StartView` and `OAuth42CallbackView`, public at the gateway (exact paths added to
   `public_endpoints`). The gateway passes 302s and Set-Cookie through untouched (and keeps no cookies,
   since #33).
2. **CSRF via `state`**: 32 random bytes (`secrets.token_urlsafe`), stored in an `oauth_state` cookie
   scoped to `/api/v1/auth/oauth`, `SameSite=Lax` (it must survive the top-level redirect back from
   intra, which `Strict` would not), `Secure` when `COOKIE_SECURE`, 10 min; compared with
   `secrets.compare_digest`, deleted after use.
3. **Account linking**: model `OAuthAccount(provider, provider_user_id, user FK cascade, created_at)`,
   unique (provider, provider_user_id). Lookup: linked account → existing user with the same email
   (42 emails are school-managed; link automatically) → new user with an unusable password and names
   from intra. Cost if wrong: whoever controls a 42 account with another user's email could take that
   account over — acceptable for 42 (school-issued addresses), documented, not for arbitrary providers.
4. **2FA still applies**: if the user has 2FA on (B), the callback issues the same challenge token as
   `/login` and redirects to `/login?oauth=mfa#<mfa_token>` (fragment: never sent to a server nor logged);
   the Log in page reads it and asks for the code.
5. **Users without a password** (created through 42): `change-password` accepts a missing
   `current_password` **only** when the user has no usable password ("Set a password"); 2FA enable/disable
   and email change keep requiring a password.
   `UserSerializer` gains `has_password`.
6. **Config**: `OAUTH_42_CLIENT_ID`, `OAUTH_42_CLIENT_SECRET`, `OAUTH_42_REDIRECT_URI` (default
   `https://localhost:8443/api/v1/auth/oauth/42/callback`) in `srcs/auth-service/.env` (placeholders in
   `.env.example`). Id or secret empty → `/start` redirects to `/login?oauth=unavailable`; the rest of the
   app works without credentials. The user must create the app on intra and fill `.env`.
7. **HTTP to intra with httpx** (already a dependency), 10 s timeout, no retries; any failure →
   `/login?oauth=error` plus a log line with the reason (never the code or tokens).

## Tests

- **auth-service unit** (httpx mocked with `unittest.mock`): start → 302 with the right query + state
  cookie; callback with bad/missing state → error redirect; token or /me failure → error redirect; new
  user created + linked; existing email linked; existing link reused; 2FA user → mfa redirect with a
  valid challenge token; unavailable when unconfigured; set-password path in change-password.
- **Gate e2e** (no real intra): `/start` through nginx → 302 to `api.intra.42.fr/oauth/authorize` with
  `client_id`, `redirect_uri`, `state` when configured, or to `/login?oauth=unavailable` when not;
  callback with a forged state → error redirect.

## Out of scope

Other providers, unlinking a 42 account, importing the intra avatar.

## Plan-time amendments (2026-09-27, from the planner's review of the code)

- **Success redirect is the dashboard, `/?oauth=ok`**: the marker tells the frontend a 42 login
  has just completed, so it checks the session.
- **Cancel on intra** (`?error=access_denied`, no code) → `/login?oauth=error`.
- **`state` comparison on bytes** (`secrets.compare_digest` raises on non-ASCII str → a crafted state
  would 500).
- `/login?oauth=mfa` without a `#token` → the failure copy; disabled accounts refused; a lost linking
  race → error redirect, not 500.
- Session cookies stay `SameSite=Strict`: the final HTML load after the intra redirect doesn't carry
  them, but the SPA's own `/auth/verify` does — no gate test can prove it, so the docs task includes a
  manual check with real credentials.
- Known, documented (not fixed): the callback's `?code=…&state=…` ends up in three server logs —
  nginx's access log, the API Gateway's uvicorn access log, and the auth-service dev server's
  (`runserver`) stdout — all shipped to Elasticsearch by Vector when ELK runs; the authorization code
  is single-use, so this is low severity but applies equally to all three. Also known, not fixed: a
  42-only user whose 2FA challenge expires must click "Log in with 42" again; 42 app secrets expire and
  must be rotated in `.env`.
- **No auto-link by email to an account that has a password** (review of the callback): local
  registration does not verify email ownership, so linking a 42 identity by email to a password
  account would let whoever registered that address first take over the 42 user's account
  (pre-hijacking). The callback links by email only when the local account has no usable password;
  otherwise it redirects to `/login?oauth=exists` ("an account with this email already exists — log in
  with your password"). Linking an existing password account to 42 from Profile is out of scope. The
  same gap has a denial-of-service half: whoever registers a 42 user's school email address locally
  first permanently makes that user's "Log in with 42" end in `/login?oauth=exists`, and with no
  password reset and no email verification in this service, the 42 user has no way to recover it.
