# SmartBreeds - Fix Roadmap

Every item below was derived from a full source audit of the repository completed on 2026-08-10,
then independently re-verified against the code before being written down. Nothing here comes from
a document: each finding was confirmed by opening the file it names.

Work happens on the `develop` branch. Items are self-contained and independently shippable -
pick any one, fix it, run its **Verify** command, ship it. Where an item must follow another,
it says so on a **Depends on:** line.

## How to read this

| Band | Meaning |
|------|---------|
| **P0** | Something lets a user do what they must not be able to do, exposes a credential, or corrupts data. Fix before anything else ships. |
| **P1** | A feature that is documented or clearly intended does not work at all. Size of the fix is irrelevant to the band. |
| **P2** | Wrong status codes, unhandled inputs that produce a 500, silent failures, misleading errors. |
| **P3** | Compose wiring, healthchecks, startup ordering, logging, ports, build hygiene. |
| **P4** | Dead code, unused dependencies, deprecated APIs, naming drift. Safe to batch. |
| **DEC** | The right fix depends on a product call. Each item states the options and the tradeoff instead of prescribing one. |

**Effort:** `S` under an hour - `M` half a day - `L` more than a day.

Items carry an HTML comment with machine-readable metadata (`id`, `priority`, `effort`, `service`)
so this file can be parsed by tooling.

Two caveats on the references:

- `file:line` citations were accurate at audit time. Any refactor invalidates them silently -
  trust the file and the symbol name over the line number.
- Items whose problem was **inferred from reading code** rather than observed at runtime say so
  explicitly, and their **Fix** starts with a reproduction step. Do not skip it.

Documentation defects are deliberately absent: `CLAUDE.md`, `ARCHITECTURE.md` and every
`srcs/*/README.md` and `srcs/*/CLAUDE.md` were rewritten and fact-checked in the same audit pass.

## Running the Verify commands

Most items verify through an authenticated request. Get a cookie jar once and reuse it:

```bash
# ordinary user
curl -s -c cookies.txt -X POST http://localhost:8001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"YourPassword1!"}'

# admin principal - created by `make superuser`
curl -s -c admin_cookies.txt -X POST http://localhost:8001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test_admin@example.com","password":"Password123!"}'
```

Then pass `-b cookies.txt` on subsequent calls. Where an item writes `-d '{"email":"E","password":"P"}'`
it means your own credentials.

Three constraints that make otherwise-correct commands fail:

- `classification-service` and `ollama` exist only under the `local` profile. Any `docker compose`
  command naming them needs a `COMPOSE_PROFILES=local` prefix, or compose answers `no such service`.
- Backend services publish no host port. Only the gateway (`localhost:8001`) and nginx
  (`localhost:8000` / `localhost:8443`) are reachable from the host; reach anything else with
  `docker exec ft_transcendence_api_gateway curl http://<service>:<port>/...`.
- `docker compose run --rm` cannot resolve sibling hostnames. Anything needing `db`, `api-gateway`
  or another service by name must run via `docker exec` on a started container.

## Summary

114 items across 11 areas.

| Band | Items |
|------|-------|
| P0 | 6 |
| P1 | 9 |
| P2 | 41 |
| P3 | 23 |
| P4 | 29 |
| DEC | 6 |
| **Total** | **114** |

| Area | Items |
|------|-------|
| `ai-service` | 17 |
| `api-gateway` | 16 |
| `auth-service` | 16 |
| `recommendation-service` | 14 |
| `nginx` | 12 |
| `repo` | 12 |
| `user-service` | 11 |
| `classification-service` | 8 |
| `db` | 4 |
| `litellm` | 2 |
| `ollama` | 2 |

Effort mix: 92 x S - 22 x M

---

## P0 - Security and data integrity

_Something lets a user do what they must not be able to do, exposes a credential, or corrupts data. Fix before anything else ships._

<!-- item id=GW-01 priority=P0 effort=S service=api-gateway -->
### GW-01 - Gateway accepts a refresh token as an access token

**Where:** `srcs/api-gateway/auth/jwt_utils.py:26-55`, `srcs/api-gateway/middleware/auth_middleware.py:37-45`

**Problem:** `decode_jwt` verifies only signature and expiry — it never inspects the `token_type` claim. A refresh token (7-day lifetime, `srcs/auth-service/config/settings.py:132`) placed in the `access_token` cookie authenticates every protected route, turning the intended 15-minute access window (`settings.py:131`) into 7 days. `extract_user_context` then silently defaults `role` to `"user"` because refresh payloads carry no `role`/`email` claim (`srcs/auth-service/apps/authentication/jwt_utils.py:51-57`). Auth-service's own views do check `token_type`; the gateway does not. Derived from reading code, not observed at runtime.

**Fix:** 1) Reproduce: log in, copy the `refresh_token` cookie value into an `access_token` cookie, `GET /api/v1/users/me` — expect 200. 2) In `decode_jwt` (or a guard at the top of `extract_user_context`) require `payload.get("token_type") == "access"` and raise `JWTValidationError("Invalid token type")` otherwise. 3) While there, treat a missing/empty `user_id` as invalid instead of defaulting to `""` (`jwt_utils.py:52`).

**Verify:** Add a test that signs a payload with `token_type="refresh"` and asserts 401, then `docker compose run --rm --no-deps api-gateway python -m pytest tests/test_jwt_utils.py tests/test_auth_middleware.py -v`.

**Effort:** S - **Risk:** every test helper mints tokens without `token_type` (`tests/test_error_handling.py:12-21`, plus the same helper duplicated in `tests/test_proxy.py`, `tests/test_rate_limit.py`, `tests/test_logging.py`); all of them start returning 401 until the claim is added. Depends on auth-service continuing to emit `token_type` on access tokens.

<!-- item id=GW-16 priority=P0 effort=S service=api-gateway -->
### GW-16 - Client-supplied `X-User-ID` / `X-User-Role` headers are forwarded to backend services

**Where:** `srcs/api-gateway/routes/proxy.py:93-102`

**Problem:** `forward_request` starts from `forward_headers = dict(request.headers)` — every header the client sent — and pops only `host` and (outside `/api/v1/auth`) `cookie`. The identity headers the whole trust model rests on are never stripped. Under ASGI the keys of `dict(request.headers)` are lowercased (which is why popping the literal `"host"` works), while `backend_headers` uses the canonical spelling `X-User-ID` / `X-User-Role` / `X-Request-ID` (`middleware/auth_middleware.py:57-62`), so `forward_headers.update(backend_headers)` inserts a *second* dict entry instead of replacing the attacker's `x-user-id`. The backend receives two `X-User-ID` headers and which one it believes depends on its stack. FastAPI resolves a singular `Header(alias="X-User-ID")` (recommendation-service, `src/routes/recommendations.py:23`) with `Headers.get()`, which returns the **first** occurrence — and the client's copy is first, because `dict(request.headers)` preserves arrival order and the gateway's entry is appended by `update`. So there the forged value wins outright. Django's dev server instead comma-joins repeats into one `HTTP_X_USER_ID`, so user-service (`apps/profiles/middleware.py:20-21`) gets `"<forged>,<real>"`, which is no longer a UUID and turns every ownership filter into a 500 — denial of service rather than impersonation, but from the same input. On public paths `backend_headers` is `{}`, so the client's copy is the only one. Backend services are documented to "trust API Gateway validation"; that guarantee does not currently hold.

**Fix:** Strip the gateway-owned header family before merging, case-insensitively:
```python
reserved = {"x-user-id", "x-user-role", "x-request-id", "x-correlation-id"}
forward_headers = {k: v for k, v in request.headers.items() if k.lower() not in reserved and k.lower() != "host"}
```
then `forward_headers.update(backend_headers)` as today. Keep the list next to `SERVICE_ROUTES` so it stays in sync with whatever `auth_middleware.py` injects.

**Verify:** add a unit test that builds a request carrying `X-User-ID: 00000000-0000-0000-0000-000000000000`, patches `routes.proxy.httpx_client.request` (the `tests/test_proxy.py:32` pattern) and asserts the outbound headers contain exactly one `x-user-id`, equal to the JWT subject. End-to-end: `curl -s -b jar -H 'X-User-ID: 00000000-0000-0000-0000-000000000000' http://localhost:8001/api/v1/users/me | jq '.data.user_id'` must return the caller's own id.

**Effort:** S - **Risk:** anything that legitimately sets `X-Correlation-ID` from the client loses it — `auth_middleware.py:61` already reads it off the request and re-emits it, so keep that read before stripping. On public paths (`/api/v1/auth/*`) `backend_headers` is `{}`, so after this change a client-supplied correlation id is dropped with nothing put back until GW-08 populates `backend_headers` before the public short-circuit. No existing test asserts pass-through of client identity headers.

<!-- item id=REC-01 priority=P0 effort=M service=recommendation-service -->
### REC-01 - Admin product endpoints accept any authenticated user

**Where:** `srcs/recommendation-service/src/routes/admin.py:15-149` (docstrings at :23, :46, :72, :99, :133)

**Problem:** All five `/api/v1/admin/products` handlers claim "Requires admin role (enforced by API Gateway)", but no code anywhere asserts it. The gateway only validates the JWT and forwards the role as a header (`srcs/api-gateway/middleware/auth_middleware.py:49,58-59`); `grep -rn "X-User-Role" srcs/recommendation-service/src/` returns nothing. Any logged-in user can create, update and soft-delete catalogue products. Found by reading code, not observed at runtime.

**Fix:** Add `src/routes/dependencies.py` with `async def require_admin(x_user_role: str = Header(None, alias="X-User-Role"))` that raises `HTTPException(403, detail=error_response("FORBIDDEN", ...))` when the header is not `admin`, and `HTTPException(401, ...)` when absent. Attach it to the router: `APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])`. Auth-service already puts `role` in the JWT (`apps/authentication/jwt_utils.py:23`) and superusers get `role='admin'` (`models.py:25`), so no upstream change is needed.

**Verify:** `docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/test_admin_e2e.py -v` (must still pass — the fixtures log in as `test_admin@example.com`), then log in as a normal user and confirm 403: `curl -s -X DELETE http://localhost:8001/api/v1/admin/products/1 -b user_cookies.txt | jq .error.code`.

**Effort:** M - **Risk:** Any caller that reaches this service without going through the gateway (direct container-to-container calls, `scripts/seed_products.py` is unaffected since it writes via SQLAlchemy) starts getting 401. `tests/integration/test_admin_e2e.py` covers the happy path; add a negative case there.

<!-- item id=INFRA-01 priority=P0 effort=S service=repo -->
### INFRA-01 - `make init` provisions an admin account whose password is published in the repo

**Where:** `scripts/create-superuser.sh:1`, `Makefile:28`, `Makefile:182-184`

**Problem:** The script runs `createsuperuser --no-input` with `DJANGO_SUPERUSER_EMAIL=test_admin@example.com` and `DJANGO_SUPERUSER_PASSWORD=Password123!` hardcoded. `make init` (`build up migration seed superuser rag`) runs it unconditionally, so every environment provisioned this way ends up with a `role='admin'`, `is_superuser=True` account (`srcs/auth-service/apps/authentication/models.py:23-25`) whose credentials are in git. The role lands in the JWT (`jwt_utils.py:23`) and is forwarded downstream as `X-User-Role`.

**Fix:** Take the credentials from the environment and fail closed: require `SMARTBREEDS_ADMIN_EMAIL` / `SMARTBREEDS_ADMIN_PASSWORD` (add both to `.env.example` with empty values) and `exit 1` with a message when either is unset. Do not keep a fallback default. Drop `superuser` from the `init` chain, or gate it behind an explicit `make superuser` invocation.

**Verify:** `grep -c 'Password123!' scripts/create-superuser.sh` returns 0; `SMARTBREEDS_ADMIN_PASSWORD= make superuser` exits non-zero; `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"test_admin@example.com","password":"Password123!"}'` returns 401 on a freshly initialised stack.

**Effort:** S - **Risk:** `scripts/run-integration-tests.sh` comments that the integration suite needs migration + seed + superuser; check whether `srcs/recommendation-service/tests/integration/` authenticates as that fixed admin before changing the email.

<!-- item id=INFRA-02 priority=P0 effort=S service=repo -->
### INFRA-02 - Ollama's unauthenticated API is published on all host interfaces

**Where:** `docker-compose.yml:68-69`

**Problem:** `ports: - "11434:11434"` binds Ollama on `0.0.0.0`. The Ollama HTTP API has no authentication and exposes model management (`/api/pull`, `/api/create`, `/api/delete`) plus unrestricted GPU inference, so anyone who can reach the host bypasses the API Gateway JWT check, the gateway rate limit and the LiteLLM master key. Nothing on the host uses this port: the only consumer is `litellm`, which reaches it over `backend-network` via `OLLAMA_BASE_URL=http://ollama:11434` (`docker-compose.yml:31`, `.env.example:13`). Every other backend service (ai 3003, classification 3004, recommendation 3005, litellm 4000) is correctly unpublished.

**Fix:** Delete the `ports` block from the `ollama` service. If host access is wanted for debugging, bind it to loopback only: `- "127.0.0.1:11434:11434"`.

**Verify:** `docker compose ps ollama` shows no published port (or `127.0.0.1:11434`); `curl -s --max-time 3 http://$(hostname -I | awk '{print $1}'):11434/api/tags` fails to connect; `docker exec ft_transcendence_litellm python -c "import urllib.request;print(urllib.request.urlopen('http://ollama:11434/api/tags').status)"` still prints 200.

**Effort:** S - **Risk:** any local tooling pointed at `http://localhost:11434` stops working; a grep of the repo found no such consumer.

<!-- item id=USER-01 priority=P0 effort=S service=user-service -->
### USER-01 - POST /api/v1/analyses trusts `user_id` and `pet_id` from the request body

**Where:** `srcs/user-service/apps/profiles/serializers.py:132-138`, `srcs/user-service/apps/profiles/views.py:206-215`

**Problem:** `PetAnalysisCreateSerializer` lists `user_id` and `pet_id` as writable fields and `PetAnalysisViewSet.create()` calls `serializer.save()` with no server-side override, so the caller decides who owns the record and which pet it is attached to. `PetViewSet.create()` does the opposite and injects `user_id=request.user_id` (`views.py:116`). Any caller can therefore forge analysis history for another user. Found by reading code; the endpoint is currently unreachable through the gateway (see USER-02), so this is a latent hole rather than an observed exploit — it must be closed before the route is ever exposed.

**Fix:** Drop `user_id` from `PetAnalysisCreateSerializer.fields` and set it in the view: `serializer.save(user_id=request.user_id)`. Validate `pet_id` against the caller's own pets in the view (or a `validate_pet_id` that reads `self.context['request'].user_id`) and return 422 `VALIDATION_ERROR` when the pet does not belong to the caller. Guard `request.user_id is None` with a 401 the way `delete_user_data` does (`views.py:61-62`).

**Verify:** `docker compose run --rm user-service python -m pytest tests/test_views.py::TestPetAnalysisViewSet -v` after updating `test_create_analysis` (`tests/test_views.py:261-288`, currently posts `user_id` in the body) to assert the stored `user_id` equals the header value and that a body `user_id` belonging to someone else is ignored.

**Effort:** S - **Risk:** breaks any backend caller that posts `user_id` explicitly; grep shows none today. Covered by `tests/test_views.py` (`TestPetAnalysisViewSet`, `TestPetAnalysisViewSetAdditional`) and `tests/test_serializers.py::TestPetAnalysisSerializer`.

---

## P1 - Broken functionality

_A feature that is documented or clearly intended does not work at all. Size of the fix is irrelevant to the band._

<!-- item id=GW-02 priority=P1 effort=S service=api-gateway -->
### GW-02 - /api/v1/analyses is unreachable through the gateway

**Where:** `srcs/api-gateway/routes/proxy.py:40-48`

**Problem:** user-service registers `PetAnalysisViewSet` at `/api/v1/analyses` with `IsOwnerOrAdmin` and GET+POST (`srcs/user-service/apps/profiles/urls.py:9`, `views.py:186-211`), but `SERVICE_ROUTES` has no matching prefix, so `get_backend_service_url` raises 404 `NOT_FOUND`. The whole pet-analysis history API is reachable only from inside `backend-network`.

**Fix:** Add `"/api/v1/analyses": settings.USER_SERVICE_URL` to `SERVICE_ROUTES`. No prefix ordering concern — no other entry shares that string. If the endpoint is deliberately internal, add an explicit comment like the `/api/v1/rag` one at `proxy.py:45` so the next reader does not re-litigate it.

**Verify:** Log in to get cookies, then `curl -s -b cookies.txt http://localhost:8001/api/v1/analyses | jq -r '.success // .error.code'` → `true` (currently `NOT_FOUND`).

**Effort:** S - **Risk:** exposes a previously unreachable write endpoint (POST creates analysis rows) — and that POST currently trusts `user_id` from the request body (USER-01), so shipping this one-line route addition before USER-01 lands turns a latent forged-ownership hole into an externally reachable one. `tests/test_error_handling.py` only asserts 404 for unmapped prefixes `/api/v1/nonexist` and `/api/v2/whatever`, so it is unaffected.

**Depends on:** USER-01

<!-- item id=GW-03 priority=P1 effort=M service=api-gateway -->
### GW-03 - CORS middleware is innermost: 401/429 carry no CORS headers and preflights are rejected

**Where:** `srcs/api-gateway/main.py:69-96`, `srcs/api-gateway/routes/proxy.py:159`

**Problem:** Registration order is CORS(69) → Logging(83) → RateLimit(86) → JWTAuth(92); Starlette makes the last-registered middleware outermost, so execution is JWTAuth → RateLimit → Logging → CORS. Responses generated by `JWTAuthMiddleware` (401) and `RateLimitMiddleware` (429) never traverse `CORSMiddleware` and ship without any `Access-Control-*` header, and a browser preflight (`OPTIONS`, sent without cookies) against any non-public path is answered with a bare 401. `OPTIONS` is also missing from the catch-all's method list, so an `OPTIONS` that does reach the router 405s.

**Fix:** Move the `app.add_middleware(CORSMiddleware, ...)` block to be the **last** registration in `main.py` so it becomes outermost. Add `"OPTIONS"` to the methods list at `proxy.py:159`. Correct the stale comment at `main.py:85` — it claims rate limiting runs before auth; it runs after.

**Verify:** `curl -i -X OPTIONS http://localhost:8001/api/v1/users/me -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: GET'` → 200 with `access-control-allow-origin`; `curl -i http://localhost:8001/api/v1/users/me -H 'Origin: http://localhost:5173'` → 401 that still carries `access-control-allow-origin`. Then `docker compose run --rm --no-deps api-gateway python -m pytest tests/ -v`.

**Effort:** M - **Risk:** with CORS outermost, preflights bypass rate limiting and logging entirely. `tests/test_cors.py` exercises only `/health` (a public path) and will not catch a regression — add a protected-path preflight case there in the same change.

<!-- item id=GW-15 priority=P1 effort=S service=api-gateway -->
### GW-15 - Logout is unreachable once the access token expires, so the session cannot be ended

**Where:** `srcs/api-gateway/middleware/auth_middleware.py:22-33`, `srcs/auth-service/apps/authentication/views.py:247-276`

**Problem:** `public_endpoints` lists `login`, `register` and `refresh` but not `/api/v1/auth/logout`, so the gateway 401s logout whenever the `access_token` cookie is missing or expired. Access tokens live 15 minutes (`JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `srcs/auth-service/config/settings.py:131`), so any user who returns to an idle tab cannot log out at all. `LogoutView` is written for exactly this case — its docstring says "Always succeeds - gracefully handles missing/invalid/expired tokens" and every branch is guarded — but the gateway never lets the request through. The consequence is not cosmetic: the 401 short-circuits before auth-service can send `clear_auth_cookies`, so the browser keeps both cookies and the `refresh_token` (valid 7 days, still not revoked) can mint a fresh access token through the public `/api/v1/auth/refresh`. "Log out" leaves a fully resurrectable session.

**Fix:** Add `"/api/v1/auth/logout"` to `self.public_endpoints`. Logout carries no privileged effect that needs an authenticated caller — it only revokes the bearer's own refresh token and clears the bearer's own cookies — and the cookie forwarding it depends on already works, since `forward_request` keeps `Cookie` for every path under `/api/v1/auth` (`routes/proxy.py:98-99`).

**Verify:** log in, wait past the access-token lifetime (or delete the `access_token` cookie from the jar), then `curl -s -o /dev/null -w '%{http_code}\n' -b jar -X POST http://localhost:8001/api/v1/auth/logout` → `200` with `Set-Cookie` clearing both cookies, instead of today's `401`.

**Effort:** S - **Risk:** the path becomes reachable unauthenticated, so it must stay idempotent and must never leak whether a token was valid — `LogoutView` already returns the same 200 for every input. `tests/test_auth_middleware.py` should gain a case asserting logout bypasses auth. AUTH-01 must land too, or the newly reachable revocation branch still finds no `refresh_token` cookie to revoke.

<!-- item id=AUTH-01 priority=P1 effort=M service=auth-service -->
### AUTH-01 - Logout never revokes the refresh token in a real browser

**Where:** `srcs/auth-service/apps/authentication/utils.py:52-61`, `srcs/auth-service/apps/authentication/views.py:255-276`

**Problem:** The `refresh_token` cookie is issued with `path='/api/v1/auth/refresh'`, so a browser (and curl) never sends it to `POST /api/v1/auth/logout`. `LogoutView`'s revocation branch reads `request.COOKIES.get('refresh_token')`, gets `None`, and returns success without touching the DB — the refresh token stays valid server-side for its full 7 days after the user logged out. The four `TestLogoutView` tests pass only because Django's test client ignores cookie paths. Found by reading code; the curl repro below confirms it.

**Fix:** In `LogoutView.post`, also read `access_token` from cookies; if it decodes and `token_type == 'access'`, revoke that user's outstanding tokens: `RefreshToken.objects.filter(user_id=payload['user_id'], is_revoked=False).update(is_revoked=True)`. Keep the existing refresh-cookie branch as a fallback and keep the always-200 contract. Do not simply widen the cookie path to `/api/v1/auth` — that changes what the gateway forwards and what other consumers receive; if you do choose that route, change `clear_auth_cookies` (`utils.py:138`) in the same commit or the cookie becomes unclearable.

**Verify:** `curl -s -c /tmp/j -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"E","password":"P"}' >/dev/null && cp /tmp/j /tmp/j2 && curl -s -b /tmp/j -X POST http://localhost:8001/api/v1/auth/logout >/dev/null && curl -s -b /tmp/j2 -X POST http://localhost:8001/api/v1/auth/refresh` — must return 401 `TOKEN_REVOKED`; today it returns 200 with fresh tokens.

**Effort:** M - **Risk:** logout must keep returning 200 for missing/expired/garbage tokens — `srcs/auth-service/tests/test_views.py:778-840` (`TestLogoutView`) covers that surface. Adding tests means bumping the hardcoded expected count at `scripts/run-unit-tests.sh:113`, which INFRA-09 deletes outright. Separately, `/api/v1/auth/logout` is not in the gateway's public set (`srcs/api-gateway/middleware/auth_middleware.py:22-29`), so a user whose access token already expired is 401'd before reaching this code — that is GW-15, and the two are only jointly sufficient: this item without GW-15 fixes logout for unexpired sessions only, GW-15 without this item makes logout reachable but still non-revoking. No `Depends on` in either direction, since each is independently shippable and a mutual one would be a cycle; schedule them together.

<!-- item id=CLS-01 priority=P1 effort=S service=classification-service -->
### CLS-01 - NSFW safety verdict ignores its configured threshold

**Where:** `srcs/classification-service/src/models/nsfw_detector.py:58-63`, `srcs/classification-service/src/routes/classify.py:54-56`

**Problem:** `is_safe` is decided by a literal `nsfw_prob < 0.5`, while the route echoes `settings.NSFW_REJECTION_THRESHOLD` (0.70) back in the same payload as `threshold`. The AI Service only reads `is_safe` (`srcs/ai/src/services/vision_orchestrator.py:62`) and ignores `threshold`, so the safety gate is a constant: an operator who tightens `NSFW_REJECTION_THRESHOLD` to 0.30 to harden the filter changes nothing, and NSFW images scoring 0.30-0.50 keep passing. Found by reading code, not from an observed rejection.

**Fix:** Pass the threshold into `NSFWDetector.__init__` (mirror the `CrossbreedDetector(settings)` pattern at `crossbreed_detector.py:10-19`), store it on the instance, and compute `is_safe = nsfw_prob < self.rejection_threshold`. Construct it in the lifespan with `NSFWDetector(device=device, model_id=settings.NSFW_MODEL, rejection_threshold=settings.NSFW_REJECTION_THRESHOLD)` (`src/main.py:37`). Keep returning `threshold` in the payload so the value stays observable.

**Verify:** Set `NSFW_REJECTION_THRESHOLD=0.001` in `srcs/classification-service/.env`, then `COMPOSE_PROFILES=local docker compose build classification-service && COMPOSE_PROFILES=local docker compose up -d classification-service`, then `docker exec ft_transcendence_classification_service python -c "from PIL import Image; from src.models.nsfw_detector import NSFWDetector; from src.config import settings; d=NSFWDetector(device='cpu', model_id=settings.NSFW_MODEL, rejection_threshold=settings.NSFW_REJECTION_THRESHOLD); print(d.predict(Image.new('RGB',(224,224),'blue')))"` — `is_safe` must now be `False` for a benign image. Restore the value afterwards. Every compose command in this area needs the `COMPOSE_PROFILES=local` prefix: the service is declared `profiles: ["local"]` (`docker-compose.yml:106`), so a bare `docker compose build classification-service` fails with "no such service".

**Effort:** S - **Risk:** `tests/test_nsfw_detector.py:36-42` asserts `is_safe is True` for a solid-colour image; it passes only while the effective threshold stays above the model's benign score. Update that test to construct the detector with an explicit threshold instead of relying on the constant.

<!-- item id=NGX-02 priority=P1 effort=S service=nginx -->
### NGX-02 - Vision endpoint 504s through NGINX: /api read timeout is 30s

**Where:** `srcs/nginx/conf.d/default.conf.template:87-89`

**Problem:** `location /api` sets `proxy_send_timeout 30s` / `proxy_read_timeout 30s`, but the API Gateway deliberately allows 300s for `/api/v1/vision` (`srcs/api-gateway/routes/proxy.py:15-17`) and the AI service uses `LLM_TIMEOUT=300` (`srcs/ai/src/config.py`). Any image analysis submitted through NGINX (the documented public entry point) dies with a 504 after 30s; only direct calls to the gateway on 8001 can complete. Derived from reading the configs, not from an observed 504.

**Fix:** Add a dedicated location ahead of `location /api` that carries the long timeouts, e.g. `location /api/v1/vision { ... proxy_pass http://api-gateway:8001; proxy_connect_timeout 5s; proxy_send_timeout 300s; proxy_read_timeout 300s; proxy_buffering off; ... }` duplicating the `proxy_set_header` and `limit_req` lines from `location /api`. Keep the 30s default for everything else. NGINX prefix matching picks the longest prefix, so no ordering trick is needed.

**Verify:** `curl -sk -o /dev/null -w '%{http_code} %{time_total}\n' https://localhost:8443/api/v1/vision/analyze -H "Cookie: access_token=$TOKEN" -H 'Content-Type: application/json' -d @payload.json` returns a 200 with a total time above 30s instead of a 504 at ~30s.

**Effort:** S - **Risk:** the long timeout must not leak onto other `/api` routes, or a hung backend will pin worker connections for 5 minutes. `limit_conn addr 10` (`default.conf.template:29`) caps the blast radius per IP. The gateway side of the same timeout lives in `srcs/api-gateway/routes/proxy.py:15-17` and needs no change. Independent of NGX-07: the verify hits `https://localhost:8443` directly, which is published today.

<!-- item id=NGX-03 priority=P1 effort=S service=nginx -->
### NGX-03 - No client_max_body_size: images the AI service accepts are rejected 413 at the edge

**Where:** `srcs/nginx/nginx.conf:17-35`, `srcs/nginx/conf.d/default.conf.template:73`

**Problem:** `client_max_body_size` is set nowhere in the nginx config (`grep -rn client_max_body_size srcs/nginx/` returns nothing), so NGINX's 1 MB default applies. `srcs/ai/src/config.py:27` sets `MAX_IMAGE_SIZE_MB: int = 5`, and the vision request carries the image base64-encoded inside a JSON body (~1.37x the raw bytes). Every upload above roughly 750 KB of source image is rejected by NGINX with a 413 before it ever reaches the gateway, while the same request succeeds against port 8001. Derived from reading the configs, not observed at runtime.

**Fix:** Set `client_max_body_size 10m;` in the `http` block of `srcs/nginx/nginx.conf` (or at least on `location /api` in `default.conf.template`), sized to cover `MAX_IMAGE_SIZE_MB * 1.37` plus JSON overhead. Keep the two numbers documented together so raising `MAX_IMAGE_SIZE_MB` is not silently capped at the edge.

**Verify:** `head -c 3000000 /dev/urandom | base64 > /tmp/big.b64` then POST a JSON body wrapping it to `https://localhost:8443/api/v1/vision/analyze`; the response must be the service's own validation error, not NGINX's `413 Request Entity Too Large`.

**Effort:** S - **Risk:** raises the memory/disk cost of a malicious upload. `limit_req zone=general_limit burst=20` and `limit_conn addr 10` already throttle repeat offenders. No test file covers nginx config.

<!-- item id=REC-02 priority=P1 effort=S service=recommendation-service -->
### REC-02 - Recommendations 500 for any pet with a null age or weight

**Where:** `srcs/recommendation-service/src/services/feature_engineering.py:36-41`, `srcs/recommendation-service/src/routes/recommendations.py:64-65`

**Problem:** `age` and `weight` are optional on the user-service `Pet` model (`srcs/user-service/apps/profiles/models.py:55-56`). The route copies them unconditionally into `age_months`/`weight_kg`, so the key exists with value `None` and the `pet_data.get("age_months", 0)` default never fires; `min(None / 200.0, 1.0)` then raises `TypeError` and the request 500s. Every pet created without an age or weight is permanently unrecommendable. Found by reading code.

**Fix:** Coalesce in the extractor, not the route: `weight_kg = pet_data.get("weight_kg") or 0` at `feature_engineering.py:40`. For age, coalescing to `0` is **not** enough — `features[11-13]` branch on `age_months > 84` (senior) / `< 12` (puppy) / else adult (`:59-67`), so `0` falls into the *puppy* branch and an age-less pet is silently fed a high-protein/high-calorie profile. Either keep the raw value and guard the branch (`if age_months is None: adult defaults`), or coalesce to a documented mid-life constant (e.g. 36) so unknown age lands on the adult path; whichever you pick, `features[0]` should stay `0.0` for unknown age.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/test_feature_engineering.py -v` after adding a case `PetFeatureExtractor().extract({"age_months": None, "weight_kg": None})` asserting a 15-element vector with `features[0] == 0.0`.

**Effort:** S - **Risk:** Changes the feature vector for pets that previously crashed only; existing vectors are unchanged because `0 or 0 == 0`. Covered by `tests/unit/test_feature_engineering.py`.

<!-- item id=INFRA-03 priority=P1 effort=S service=repo -->
### INFRA-03 - The Makefile exports COMPOSE_PROFILES, so the root `.env` can never select the stack

**Where:** `Makefile:9-10`, `.env.example:7`, `.env:1`

**Problem:** `COMPOSE_PROFILES ?= cloud` followed by `export COMPOSE_PROFILES` puts the value in the environment of every `docker compose` invocation, and a shell environment variable beats the `.env` file in compose's precedence order. The repo's own `.env` says `COMPOSE_PROFILES=local` and is silently ignored: `make up` starts the cloud topology with no `ollama` and no `classification-service`, while `srcs/ai/.env.example:14` still ships `CLASSIFICATION_ENABLED=true`, so the AI service gets connection errors calling a container that was never started. The committed value on `develop` is `local` (`git diff Makefile`); the working tree carries an unstaged flip to `cloud`, which means the same `make up` behaves differently for two developers on the same commit.

**Fix:** Delete both lines 9 and 10. GNU Make already exports any variable that came from the environment or the command line, so `make up COMPOSE_PROFILES=cloud` and `COMPOSE_PROFILES=cloud make up` keep working, while a bare `make up` leaves the variable unset in the child environment and compose falls back to the root `.env`. Do **not** keep line 9 and wrap line 10 in `ifdef COMPOSE_PROFILES` — `?=` assigns the variable, so `ifdef` is always true and the export still wins over `.env`. If a Makefile-side default is wanted for other recipes, guard the export on provenance instead: `ifneq ($(filter command line environment,$(origin COMPOSE_PROFILES)),)`. Nothing else in the Makefile reads `$(COMPOSE_PROFILES)`, so plain deletion is the smaller change.

**Verify:** With `COMPOSE_PROFILES=cloud` in `.env`, `make up && docker compose ps --services | grep -x ollama` prints nothing; switch `.env` back to `local`, `make down && make up`, and the same command prints `ollama`.

**Effort:** S - **Risk:** developers who relied on the accidental cloud default will suddenly need a GPU; the `local` profile also pulls the classification-service image on first build. Flipping profiles still requires the matching `CLASSIFICATION_ENABLED` value in `srcs/ai/.env`, which no tooling enforces.

---

## P2 - Correctness and robustness

_Wrong status codes, unhandled inputs that produce a 500, silent failures, misleading errors._

<!-- item id=AI-01 priority=P2 effort=S service=ai-service -->
### AI-01 - RAG routes answer HTTP 200 when the service is not initialised

**Where:** `srcs/ai/src/routes/rag.py:136-142`, `:196-202`, `:254-260`, `srcs/ai/src/utils/responses.py:20`

**Problem:** The not-initialised branches of `/api/v1/rag/query`, `/ingest` and `/status` `return error_response("SERVICE_UNAVAILABLE", "...", status.HTTP_503_SERVICE_UNAVAILABLE)`. `error_response(code, message, details=None)` has no status parameter, so `503` lands in `error.details` and FastAPI serialises the dict as a **200 OK**. A caller polling `/api/v1/rag/status` before startup finishes sees a success status code carrying `success: false`. Only `/api/v1/admin/rag/initialize` (`rag.py:40-48`) raises correctly.

**Fix:** Replace the three `return error_response(...)` calls with `raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=error_response(code="SERVICE_UNAVAILABLE", message="..."))`, matching the pattern already used at `rag.py:42-48`.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/test_rag_routes.py -v` after adding a test that sets `rag.rag_service = None` and asserts `response.status_code == 503` for `/api/v1/rag/status`.

**Effort:** S - **Risk:** existing tests in `tests/test_rag_routes.py` assert on the 200-shaped body for these branches; they will need updating to read `response.json()["detail"]`.

<!-- item id=AI-02 priority=P2 effort=S service=ai-service -->
### AI-02 - Image validation errors return prose as the machine-readable error code

**Where:** `srcs/ai/src/routes/vision.py:56-81`, `srcs/ai/src/services/image_processor.py:42-55,81-92`

**Problem:** `analyze_image` builds `error_code = str(e)` from the caught `ValueError` and looks it up in `error_map`. `ImageProcessor` raises prose (`"Invalid data URI format"`, `"Unsupported format: bmp"`, `"Image exceeds 5MB limit"`, `"Image too small (min 224x224)"`), so the three keys `INVALID_IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL` are unreachable: the client gets `error.code` = the English sentence and `error.message` = the fallback `"Validation failed"`. Only orchestrator-raised codes work. Found by reading code, not observed at runtime.

**Fix:** Make `ImageProcessor` raise `ValueError` with the code as the message (`ValueError("IMAGE_TOO_LARGE")` etc.) and keep the human text in the `error_map` in `routes/vision.py`; or introduce a small `ImageValidationError(ValueError)` carrying `.code` and `.message` and branch on it in the route. Either way the three map keys must become reachable.

**Verify:** `docker exec ft_transcendence_ai_service curl -s -X POST http://localhost:3003/api/v1/vision/analyze -H 'Content-Type: application/json' -d '{"image":"data:image/bmp;base64,AAAA"}'` — expect 422 with `detail.error.code == "INVALID_IMAGE_FORMAT"`.

**Effort:** S - **Risk:** `tests/test_image_processor.py` (15 tests) asserts on the current prose messages with `pytest.raises(ValueError, match=...)` and must be updated in the same change.

<!-- item id=AI-03 priority=P2 effort=S service=ai-service -->
### AI-03 - A LiteLLM 4xx/5xx during contextual analysis surfaces as 500, not 503

**Where:** `srcs/ai/src/services/ollama_client.py:400-409`, compare `:113-118` and `:370-372`

**Problem:** `analyze_with_context` catches only `httpx.ConnectError` and `httpx.TimeoutException`. `_chat` calls `response.raise_for_status()`, so a wrong `LLM_API_KEY` (401), a rate limit (429) or a provider 5xx raises `httpx.HTTPStatusError`, escapes the handler, and `routes/vision.py:99` maps it to `500 INTERNAL_ERROR`. The identical failure inside `analyze_breed`/`generate` (which catch the superclass `httpx.HTTPError`) becomes a 503. The main pipeline therefore reports a dependency outage as an internal bug and the operator gets no `Retry-After`-style signal.

**Fix:** Add `except httpx.HTTPStatusError as e: logger.error(...); raise ConnectionError(f"LLM upstream returned {e.response.status_code}")` to `analyze_with_context`, or replace both narrow excepts with `except httpx.HTTPError` as the other two methods do.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/test_ollama_contextual.py -v` with a new test whose mocked `post` returns a response whose `raise_for_status()` raises `httpx.HTTPStatusError`; assert `ConnectionError` is raised.

**Effort:** S - **Risk:** `tests/test_ollama_contextual.py:220,236` match on the exact strings `"Ollama service unavailable"` / `"Ollama service timeout"`; keep or update them together. Interacts with AI-11, which renames exactly those strings — AI-13 is a different item (dead request models) and was cited here in error.

<!-- item id=AI-04 priority=P2 effort=S service=ai-service -->
### AI-04 - Incomplete but valid LLM JSON crashes the pipeline with a 500

**Where:** `srcs/ai/src/services/vision_orchestrator.py:125-127`, `:180-182`

**Problem:** Both pipeline branches index `ollama_result["description"]`, `["traits"]` and `["health_observations"]` directly. `_parse_response` only guarantees the payload is valid JSON, not that it has those keys, so a model that returns `{"description": "..."}` alone raises `KeyError` — caught by the generic handler in `routes/vision.py:99` and returned as `500 INTERNAL_ERROR` with no indication that the LLM output was malformed. Likelihood is real on the `cloud` profile where the model is not the one the prompt was tuned for. Inferred from code.

**Fix:** Use `.get()` with sane defaults (`""`, `{}`, `[]`) and log a warning naming the missing keys; or validate `ollama_result` against a small pydantic model in `ollama_client._parse_response` and raise `RuntimeError("MALFORMED_LLM_RESPONSE")` so the route can map it to 502/503 instead of 500.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py -v` with a new test where `analyze_with_context` returns `{"description": "x"}` and the orchestrator still produces a result (or raises the chosen typed error).

**Effort:** S - **Risk:** `VisionAnalysisData` in `src/models/responses.py` may declare these fields required — check before choosing empty-string defaults. Covered by `tests/test_response_models.py`.

<!-- item id=AI-05 priority=P2 effort=S service=ai-service -->
### AI-05 - Corrupt image bytes behind a valid data URI return 500 instead of 422

**Where:** `srcs/ai/src/services/image_processor.py:48`, `srcs/ai/src/routes/vision.py:56,99`

**Problem:** `Image.open()` raises `PIL.UnidentifiedImageError`, which subclasses `OSError`, not `ValueError`. A request whose header says `data:image/png;base64,` but whose payload is not an image therefore skips the 422 branch entirely and is reported as `500 INTERNAL_ERROR` — a client input error blamed on the server, and it pollutes error dashboards. Inferred from code; not observed at runtime.

**Fix:** Wrap `Image.open(io.BytesIO(image_bytes))` in `try/except (UnidentifiedImageError, OSError)` inside `process_image` and re-raise as `ValueError("INVALID_IMAGE_FORMAT")` (aligning with AI-02).

**Verify:** `docker exec ft_transcendence_ai_service curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3003/api/v1/vision/analyze -H 'Content-Type: application/json' -d '{"image":"data:image/png;base64,bm90YW5pbWFnZQ=="}'` — expect `422`.

**Effort:** S - **Risk:** none beyond `tests/test_image_processor.py`, which should gain a case for this input.

**Depends on:** AI-02

<!-- item id=AI-06 priority=P2 effort=S service=ai-service -->
### AI-06 - ChromaDB chunk IDs are unstable across restarts and collide within a run

**Where:** `srcs/ai/src/services/rag_service.py:180`

**Problem:** IDs are `f"chunk_{i}_{hash(c.content) % 10000}"`. CPython salts `hash()` for `str` per process and `PYTHONHASHSEED` is not set in `srcs/ai/Dockerfile`, so re-running `make rag` after a container restart produces new IDs for identical content and duplicates the whole knowledge base in the collection instead of upserting it. The `% 10000` bucket combined with the per-call index `i` also lets two different chunks share an ID within one ingest, silently dropping one. Result: retrieval quality degrades on every re-ingest and `/api/v1/rag/status` document counts are meaningless.

**Fix:** Derive the ID deterministically from content, e.g. `hashlib.sha256(c.content.encode()).hexdigest()[:32]`, optionally prefixed with the sanitised `metadata["source_file"]`. Consider `self._collection.upsert(...)` instead of `.add(...)` so re-ingest is idempotent.

**Verify:** `docker exec ft_transcendence_ai_service curl -s http://localhost:3003/api/v1/rag/status`, note `document_count`, run `make rag` again, re-check — the count must be unchanged.

**Effort:** S - **Risk:** existing collections keep their old IDs, so the first re-ingest after the change still duplicates; document that `docker volume rm ft_transcendence_ai-chroma-data` (or a collection reset) is needed once. Covered by `tests/test_rag_service.py`.

<!-- item id=AI-07 priority=P2 effort=M service=ai-service -->
### AI-07 - RAG breed context maps similarity-ranked chunks to fields positionally

**Where:** `srcs/ai/src/services/rag_service.py:277-289`, `:324-336`

**Problem:** `get_breed_context` assigns `documents[0]→description`, `documents[1]→care_summary`, `documents[2]→health_info`, and `get_crossbreed_context` slices `[:3]`, `[3:5]`, `[5:7]` the same way. ChromaDB returns chunks ordered by embedding similarity, which carries no such semantics, so the `care_summary` and `health_info` sent to the LLM and returned to the client as `enriched_info` are arbitrary chunk text truncated at 500/300/300 characters — often mid-sentence. The "factually grounded" enrichment is effectively random slices of the top-5 hits.

**Fix:** Query per field with a targeted question and a metadata filter. Note that the only metadata stored per chunk is the document frontmatter (`doc_type`, `species`, `parent_breeds`, …) merged with `source_file`/`source_type` and `chunk_index` (`document_processor.py:167,179-183`, `routes/rag.py:81-84`) — `split_by_headers` discards the header text, so there is no per-section key today. Either filter on `where={"doc_type": "health"}` (the `health/` KB subtree), or add the section title to `chunk_metadata` in `DocumentProcessor.process` first, or concatenate all retrieved chunks into a single `context` string and let the prompt do the sectioning rather than pretending the fields are typed. Truncate on a token/sentence boundary, not a raw character count.

**Verify:** `docker exec ft_transcendence_ai_service curl -s -X POST http://localhost:3003/api/v1/rag/query -H 'Content-Type: application/json' -d '{"question":"golden retriever health"}'` plus a new unit test in `tests/test_rag_service.py` feeding a hand-built ChromaDB result and asserting `health_info` comes from a health-tagged chunk.

**Effort:** M - **Risk:** changes the shape of `enriched_info` in the vision response; `tests/test_rag_service.py` (18 tests) and `tests/test_response_models.py` cover this surface. Batching: AI-06 (chunk ids), AI-09 (the `n_results` and 500/300/300 truncation constants at `:261,310,285-287,332-334`) and AI-14 (`RAG_MIN_RELEVANCE`) all edit `rag_service.py`, and AI-09 moves the very constants this item restructures — settle the retrieval design once and apply all four together rather than re-deriving the test fixtures in `tests/test_rag_service.py` four times.

<!-- item id=AI-08 priority=P2 effort=S service=ai-service -->
### AI-08 - Two uvicorn workers load the models twice and open the same ChromaDB directory concurrently

**Where:** `srcs/ai/Dockerfile:35`, `srcs/ai/src/main.py:24-60`

**Problem:** `CMD [... "--workers", "2"]` forks two processes, each running the lifespan: two `SentenceTransformer` instances are loaded (doubling RSS and startup time) and two `chromadb.PersistentClient` handles are opened on the same `/app/data/chroma` path. ChromaDB's persistent client is not designed for multi-process writers, so a `POST /api/v1/admin/rag/initialize` handled by one worker is not visible to the other until restart, and concurrent writes risk index corruption.

**Fix:** Drop to `--workers 1` (the workload is I/O-bound on the LLM proxy, so concurrency comes from asyncio, not workers). If throughput becomes an issue later, move ChromaDB to its own container rather than raising the worker count.

**Verify:** `docker exec ft_transcendence_ai_service ps -o pid,cmd -C python` shows a single uvicorn process; then `docker logs ft_transcendence_ai_service | grep -c "started successfully"` returns 1.

**Effort:** S - **Risk:** halves in-process parallelism for CPU-bound embedding calls during bulk ingest; `make rag` runtime may increase. Band note: this is P2 rather than a tidy-up because two writers on one ChromaDB directory is a data-integrity exposure, and because `make rag` is only half-effective today — the worker that did not handle the ingest keeps serving an empty index, so RAG enrichment silently degrades on roughly half of vision requests until the container restarts. Confirm that split-brain before fixing: run `make rag`, then hit `/api/v1/rag/status` several times and watch `document_count` alternate between the ingested figure and 0.

<!-- item id=GW-04 priority=P2 effort=S service=api-gateway -->
### GW-04 - Upstream failures report code HTTP_ERROR with a Python repr as the message

**Where:** `srcs/api-gateway/routes/proxy.py:145-157`, `srcs/api-gateway/main.py:20-30`

**Problem:** `forward_request` raises `HTTPException(503, detail={...full envelope...})` with a dict detail, but the `HTTPException` handler hardcodes `code="HTTP_ERROR"` and does `str(exc.detail)` for non-string details. Clients receive `error.code = "HTTP_ERROR"` and `error.message` containing `"{'success': False, 'error': {'code': 'SERVICE_UNAVAILABLE', ...}}"`. The real code never reaches the wire, so callers cannot distinguish a dead backend from any other HTTP error.

**Fix:** Stop routing the structured failure through the generic handler: in the `except httpx.RequestError` branch, return `JSONResponse(status_code=503, content=error_response("SERVICE_UNAVAILABLE", f"Backend service unavailable: {e}"))` (requires `forward_request` to signal the caller, or move the try/except into `proxy_handler`). Alternatively teach `main.py`'s handler to pass through a dict detail that already has the envelope shape. Apply the same treatment to the dict detail at `proxy.py:67-70`.

**Verify:** `docker compose stop user-service`, then `curl -s -b cookies.txt http://localhost:8001/api/v1/users/me | jq -r .error.code` → `SERVICE_UNAVAILABLE`.

**Effort:** S - **Risk:** `tests/test_error_handling.py:34,49` currently accepts either `NOT_FOUND` or `HTTP_ERROR`, so it will not fail either way — tighten those assertions in the same change or the fix is unguarded. Batching: GW-02, GW-04, GW-07, GW-09, GW-13 and GW-16 all edit `routes/proxy.py`, most of them inside `forward_request`; doing them in one sitting avoids six rounds of merge conflict in the same 60 lines. Only GW-02→USER-01 and GW-13→GW-05 are true ordering constraints, the rest is scheduling convenience.

<!-- item id=GW-05 priority=P2 effort=S service=api-gateway -->
### GW-05 - Every gateway-generated error envelope reports the worker start time

**Where:** `srcs/api-gateway/utils/responses.py:16`

**Problem:** `timestamp: str = datetime.utcnow().isoformat()` is a Pydantic field default evaluated once at class-definition time. All four exception handlers in `main.py` therefore stamp responses with the moment the worker booted; with `--workers 4` (`Dockerfile:21`) the value also differs per worker. Correlating a client-reported error with a log line by timestamp is impossible.

**Fix:** `from pydantic import Field` and declare `timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())` (`from datetime import UTC`). `datetime.utcnow()` is deprecated on 3.12+; the same replacement applies to the hand-built dicts at `auth_middleware.py:83`, `rate_limit.py:94`, `logging_middleware.py:52` and `proxy.py:155,197,218,235` if you want one format across the service.

**Verify:** `docker exec ft_transcendence_api_gateway python -c "import time; from utils.responses import error_response as e; a=e('X','y'); time.sleep(2); print(a['timestamp'] != e('X','y')['timestamp'])"` → `True`.

**Effort:** S - **Risk:** the suffix changes from naive to `+00:00`. Nothing asserts on the format — `grep -rn timestamp tests/` finds only a presence check in `tests/test_health.py:19`.

<!-- item id=GW-06 priority=P2 effort=M service=api-gateway -->
### GW-06 - Rate limiting blocks the event loop and swallows Redis failures to stdout

**Where:** `srcs/api-gateway/middleware/rate_limit.py:10,41-58,67,77`

**Problem:** `redis.from_url` is the **synchronous** client and is called 2-3 times per request from inside async `dispatch`, so every request stalls its worker's event loop for the whole Redis round trip — under load this serialises all concurrent requests on that worker. `requirements.txt` already pins `redis==5.2.0`, which ships `redis.asyncio`. Separately, `except redis.RedisError` only `print()`s and fails open (`:56-58`), so a Redis outage silently removes rate limiting with no structured log line.

**Fix:** Switch to `import redis.asyncio as redis` and `await` the `get`/`setex`/`incr`/`ttl` calls (`_rate_limit_response` becomes `async`). Replace the `print` with the `logging` logger used elsewhere (`logging_middleware.py:13`) so the failure is visible in the JSON log stream. Create the async client lazily or in the app lifespan (see GW-09) rather than at import, so it binds to the running loop.

**Verify:** `docker compose run --rm --no-deps api-gateway python -m pytest tests/test_rate_limit.py -v`, then hammer a real gateway: `for i in $(seq 1 70); do curl -s -o /dev/null -w '%{http_code} ' -b cookies.txt http://localhost:8001/api/v1/users/me; done` → 429s appear after the configured limit.

**Effort:** M - **Risk:** `tests/test_rate_limit.py` patches `middleware.rate_limit.redis_client` with a `MagicMock`; all three tests must switch to `AsyncMock` and `ttl` must still return an int (`tests/test_rate_limit.py:31`) because it is interpolated into the message.

<!-- item id=GW-07 priority=P2 effort=S service=api-gateway -->
### GW-07 - Repeated query parameters are flattened and non-POST/PUT/PATCH bodies are dropped

**Where:** `srcs/api-gateway/routes/proxy.py:108-110,125`

**Problem:** `params=dict(request.query_params)` collapses a multidict, so `?breed=a&breed=b` reaches the backend as `breed=b` only. The request body is read only for `POST`/`PUT`/`PATCH`, so a `DELETE` (or `GET`) carrying a payload arrives at the backend empty with no error anywhere. Derived from reading code, not observed at runtime.

**Fix:** Pass `params=list(request.query_params.multi_items())` (httpx accepts the pair list and preserves duplicates). Read the body unconditionally — `body = await request.body() or None` — and delete the method whitelist at `:109`.

**Verify:** Add a test patching `routes.proxy.httpx_client.request` (the pattern at `tests/test_proxy.py:32`) that calls `/api/v1/users/me?x=1&x=2` and asserts both values survive in `call_args.kwargs["params"]`, then `docker compose run --rm --no-deps api-gateway python -m pytest tests/test_proxy.py -v`.

**Effort:** S - **Risk:** sending a body on GET can upset strict backends; both Django services tolerate it. `tests/test_proxy.py` covers the forwarding path and asserts on `call_args.kwargs`.

<!-- item id=GW-08 priority=P2 effort=S service=api-gateway -->
### GW-08 - X-Request-ID is missing on exactly the requests worth tracing

**Where:** `srcs/api-gateway/middleware/auth_middleware.py:31-34,52-62`, `srcs/api-gateway/middleware/logging_middleware.py:34,58`

**Problem:** The request id is generated inside `JWTAuthMiddleware` **after** the public-endpoint short-circuit (`:33-34`). Login, register and refresh therefore get no id at all: the log line records `"request_id": "no-request-id"`, that same literal string is returned as the `X-Request-ID` response header (`logging_middleware.py:58`), and no `X-Request-ID` is forwarded to auth-service because `request.state.backend_headers` is never set on those paths.

**Fix:** In `JWTAuthMiddleware.dispatch`, generate `request_id = str(uuid.uuid4())` and set `request.state.request_id` plus `request.state.backend_headers = {"X-Request-ID": request_id, "X-Correlation-ID": request.headers.get("X-Correlation-ID", request_id)}` **before** the public-endpoint `return await call_next(request)`. Keep the `X-User-ID`/`X-User-Role` enrichment in the authenticated branch.

**Verify:** `curl -is -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' | grep -i x-request-id` → a UUID, not `no-request-id`.

**Effort:** S - **Risk:** low; `forward_request` already reads `backend_headers` with a `{}` default (`proxy.py:91`). `tests/test_logging.py` asserts on log content only and does not pin the id value. Batching: GW-01, GW-08, GW-12 and GW-15 all rewrite the same `JWTAuthMiddleware.dispatch` prologue and its `public_endpoints` set — take them as one change and add the corresponding cases to `tests/test_auth_middleware.py` together. Landing GW-08 alongside GW-16 also restores the client-supplied `X-Correlation-ID` that GW-16 otherwise strips with nothing put back on public paths.

<!-- item id=GW-12 priority=P2 effort=S service=api-gateway -->
### GW-12 - Public-endpoint matching is exact-string: /redoc and trailing-slash variants return 401

**Where:** `srcs/api-gateway/middleware/auth_middleware.py:22-33`, `srcs/api-gateway/main.py:13-17`

**Problem:** `public_endpoints` is a set tested with `request.url.path in ...`. `/docs` and `/openapi.json` are public, but FastAPI also serves `/redoc` by default and it was never added, so the ReDoc UI answers 401 `UNAUTHORIZED`. The same exact-match rule means `/api/v1/auth/login/` (trailing slash) answers 401 instead of the 404 the Django services would give — a misleading status for a simple typo, and a trap given `APPEND_SLASH = False` downstream.

**Fix:** Pick one docs policy and apply it: either add `"/redoc"` to the set, or pass `redoc_url=None` to `FastAPI()` at `main.py:13` (and `docs_url=None, openapi_url=None` if the schema should not be public at all). Separately, normalise before the membership test — `path = request.url.path.rstrip("/") or "/"` — so slash variants of public paths behave identically.

**Verify:** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8001/redoc` → `200` (or `404` if disabled, not `401`); `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8001/api/v1/auth/login/` → not `401`.

**Effort:** S - **Risk:** normalisation is still exact-match after stripping, so no path becomes public by accident. `tests/test_auth_middleware.py:72` covers the `/health` bypass and should gain a `/health/` case.

<!-- item id=AUTH-02 priority=P2 effort=S service=auth-service -->
### AUTH-02 - Concurrent token issuance collides on the `placeholder` token hash

**Where:** `srcs/auth-service/apps/authentication/utils.py:28-39`, `srcs/auth-service/apps/authentication/models.py:90`

**Problem:** `issue_auth_tokens` inserts a `RefreshToken` row with the literal `token_hash='placeholder'`, generates the JWT from the row id, then updates the hash. `token_hash` is `unique=True`, so two token issuances overlapping in that window raise `IntegrityError` and the second request 500s. Every login, register, refresh and password change goes through this path. Derived from reading code; not observed at runtime.

**Fix:** Generate the id up front and do a single insert: `token_id = uuid.uuid4()`; `refresh_token = generate_refresh_token(user, token_id)`; `RefreshToken.objects.create(id=token_id, user=user, token_hash=hash_token(refresh_token), expires_at=...)`. Drop the follow-up `save(update_fields=['token_hash'])`.

**Verify:** `seq 1 20 | xargs -P20 -I{} curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"E","password":"P"}' | sort -u` must print only `200`, and `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "select count(*) from auth_schema.refresh_tokens where token_hash='placeholder'"` must be 0.

**Effort:** S - **Risk:** the row id is the JWT `token_id` claim that `RefreshView` looks up (`views.py:184-186`); an id generated outside the model default must still be a UUID. Covered by `srcs/auth-service/tests/test_views.py` `TestLoginView.test_login_creates_refresh_token_record` and `TestRefreshView`.

<!-- item id=AUTH-03 priority=P2 effort=S service=auth-service -->
### AUTH-03 - `DeleteUserView` accepts disabled accounts

**Where:** `srcs/auth-service/apps/authentication/views.py:396-412`

**Problem:** Every other authenticated view (`VerifyView:333`, `ChangePasswordView:487`, `RefreshView:223`) rejects `user.is_active is False` with 403 `ACCOUNT_DISABLED`. `DeleteUserView` does not, so an account disabled by an admin can still trigger the full cross-service cascade delete with a still-valid access token (up to 15 minutes after being disabled).

**Fix:** After `User.objects.get(id=user_id)` in `DeleteUserView.delete`, add the same `if not user.is_active: return error_response('ACCOUNT_DISABLED', 'Account is disabled', status=403)` block used in `VerifyView`.

**Verify:** `docker exec ft_transcendence_auth_service python manage.py shell -c "from apps.authentication.models import User; User.objects.filter(email='E').update(is_active=False)"` then `curl -s -o /dev/null -w '%{http_code}' -b /tmp/j -X DELETE http://localhost:8001/api/v1/auth/delete` must print 403.

**Effort:** S - **Risk:** `DELETE /api/v1/auth/delete` currently has zero view tests, so this change is unguarded — add a `TestDeleteUserView` class to `srcs/auth-service/tests/test_views.py` covering 403-when-disabled and the happy path (the happy path needs the user-service call mocked; nothing in this suite mocks anything today).

<!-- item id=AUTH-04 priority=P2 effort=M service=auth-service -->
### AUTH-04 - Cascade delete destroys remote data before the local delete, with no compensation

**Where:** `srcs/auth-service/apps/authentication/utils.py:168-206`

**Problem:** `delete_user_cascade` calls user-service's `DELETE /api/v1/users/delete` first (single `httpx` call, hardcoded 10 s timeout, no retry), then deletes the local `User` row. If the local delete fails, the user's profile, pets and analyses are already gone while the account still exists and can log in — an unrecoverable half-deleted state. A user-service timeout on an already-committed delete is reported to the caller as `DELETION_FAILED` even though the remote side succeeded.

**Fix:** Make the remote call idempotent-safe and ordered for recoverability: wrap the local delete in `transaction.atomic()` and run it first, then call user-service (a second call for an already-deleted user must return 200/404, not an error) so a remote failure leaves recoverable orphan rows in `user_schema` rather than an orphan login. Add a bounded retry (2 attempts) and move the 10 s timeout into `config/settings.py` as `USER_SERVICE_TIMEOUT`. Log the failed remote deletion with the user id so it can be reconciled.

**Verify:** `docker compose stop user-service` then `curl -s -b /tmp/j -X DELETE http://localhost:8001/api/v1/auth/delete` — the response must name the user-service failure, and `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "select count(*) from auth_schema.users where email='E'"` must reflect the documented ordering (0 with the fix above). Restart with `docker compose start user-service`.

**Effort:** M - **Risk:** changes the observable ordering of a destructive operation; there are no tests for this path at all (nothing in `srcs/auth-service/tests/` mocks httpx), so write them alongside. Requires confirming user-service's delete endpoint is idempotent (`srcs/user-service/apps/profiles/views.py`) — that check belongs to the user-service agent. Batching: AUTH-15 rewrites the same `delete_user_cascade` function, and USER-11 hardens the handler on the far side of the call; if AUTH-15's decision is already made, do both here in one pass. Deliberately not a `Depends on` — the ordering-and-retry fix stands on its own under any of AUTH-15's three options, and this P2 must not sit behind an open product decision.

<!-- item id=AUTH-05 priority=P2 effort=S service=auth-service -->
### AUTH-05 - Refresh-token row lifecycle is half-implemented

**Where:** `srcs/auth-service/apps/authentication/models.py:93-115`, `srcs/auth-service/apps/authentication/views.py:194-232`

**Problem:** `refresh_tokens.expires_at` is written at creation and never read — `RefreshView` checks only `is_revoked` and the hash, so server-side expiry is enforced solely by the JWT `exp` claim. `last_used_at` is declared but never written by any code. `RefreshToken.is_valid()` and `.revoke()` exist and are called by nothing (`test_models.py:138-155` sets `is_revoked` by hand rather than calling `.revoke()`). Three columns/methods of stored state that nothing depends on.

**Fix:** In `RefreshView`, replace the bare `if token_record.is_revoked` check with `if not token_record.is_valid()` (returning `TOKEN_EXPIRED` when `expires_at` has passed and `TOKEN_REVOKED` when revoked), stamp `token_record.last_used_at = timezone.now()` in the same `save(update_fields=[...])` that sets `is_revoked=True` at line 231-232, and use `token_record.revoke()` where the view currently assigns the field directly. If instead the decision is to keep expiry JWT-only, delete `expires_at`, `last_used_at`, `is_valid()` and `.revoke()` with a migration rather than leaving them dead.

**Verify:** `docker compose run --rm auth-service python -m pytest tests/test_views.py::TestRefreshView -v` plus a new test that back-dates `expires_at` on a non-revoked record and asserts refresh returns 401; then `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "select last_used_at from auth_schema.refresh_tokens order by created_at desc limit 5"` must show non-null values after a refresh.

**Effort:** S - **Risk:** `is_valid()` compares against `timezone.now()`, so a clock skew between app and DB can now reject tokens the old code accepted. `srcs/auth-service/tests/test_models.py` and `TestRefreshView` cover this surface.

<!-- item id=AUTH-07 priority=P2 effort=M service=auth-service -->
### AUTH-07 - Dependency pins are past upstream security support

**Where:** `srcs/auth-service/requirements.txt:1-11`

**Problem:** `Django==5.0.1` (January 2024; the 5.0 series is past end of extended support) and `cryptography==41.0.7` (December 2023) are the two libraries that terminate TLS material and sign every JWT in the platform. `djangorestframework==3.14.0` and `PyJWT==2.8.0` are of the same vintage. Provenance: read from `requirements.txt` and compared against upstream release lines; no CVE scan has been run in this repo.

**Fix:** Step 1 is to confirm the exposure: `docker compose run --rm auth-service sh -c "pip install -q pip-audit && pip-audit"`. Then move to the current Django LTS line (5.2.x) and current `cryptography`, `djangorestframework` and `PyJWT`, one bump per commit, running the suite between each. Keep Python 3.11 in mind — Django 6.x requires 3.12, so an LTS bump within 5.2 is the low-risk target.

**Verify:** `docker compose build auth-service && docker compose run --rm auth-service python -m pytest tests/ -v` (102 passing) followed by `docker compose run --rm auth-service sh -c "pip install -q pip-audit && pip-audit"` reporting no known vulnerabilities.

**Effort:** M - **Risk:** Django 5.1/5.2 tightened `USE_TZ`, `CSRF_TRUSTED_ORIGINS` and password-hasher defaults; the Argon2 hasher config (`settings.py:97-100`) and `Custom404Middleware`'s `MiddlewareMixin` usage are the likely breakage points. `srcs/auth-service/tests/` (102 tests) is the whole safety net; `srcs/user-service` pins Django independently and should be bumped in step with it by that agent.

<!-- item id=CLS-02 priority=P2 effort=S service=classification-service -->
### CLS-02 - NSFW probability is read by tensor position, not by label

**Where:** `srcs/classification-service/src/models/nsfw_detector.py:53-58`

**Problem:** `nsfw_prob = probs[0][1]` assumes the softmax index 1 is the "nsfw" class. `model.config.id2label` is never consulted (the inline comment admits the assumption). It happens to be correct for `Falconsai/nsfw_image_detection`, but changing `NSFW_MODEL` to any model with the opposite label order silently inverts the safety verdict — unsafe images would be reported safe with no error anywhere. Derived from reading code; the current model masks it.

**Fix:** Build `label2id = {v.lower(): k for k, v in self.model.config.id2label.items()}` at construction, resolve the nsfw index from a small alias set (`nsfw`, `porn`, `unsafe`, `explicit`), and raise at startup if none matches so a bad `NSFW_MODEL` fails loudly in the lifespan instead of misclassifying at request time. Then index `probs[0][nsfw_index]`.

**Verify:** `COMPOSE_PROFILES=local docker compose build classification-service && COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/test_nsfw_detector.py -v`, plus a new test that monkeypatches `detector.model.config.id2label` to `{0: 'nsfw', 1: 'normal'}` and asserts the probability tracks the label rather than the position.

**Effort:** S - **Risk:** a startup raise turns a mis-set `NSFW_MODEL` into a container that never becomes healthy; the service has no `restart:` policy in `docker-compose.yml` (INFRA-11 adds one), so it stays stopped. `tests/test_nsfw_detector.py` covers the happy path only. Batching: CLS-01 rewrites the same `predict` block at `nsfw_detector.py:53-63` and introduces the constructor argument this item resolves labels in — write the class once with both changes.

**Depends on:** CLS-01

<!-- item id=CLS-03 priority=P2 effort=S service=classification-service -->
### CLS-03 - Dog breed model id disagrees across three layers

**Where:** `srcs/classification-service/.env.example:9`, `srcs/classification-service/src/config.py:17`, `srcs/classification-service/src/models/breed_classifier.py:81`

**Problem:** `.env.example` ships `DOG_BREED_MODEL=prithivMLmods/Dog-Breed-120`, while `config.py` and the `DogBreedClassifier` default both say `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit`. In Docker the env value wins, so the container runs one model while anyone reading the code (or running the classifier outside compose without a `.env`) gets another. The two models emit different label strings, so breed names and confidences — and therefore the RAG query built from them downstream — differ depending on how the process was started.

**Fix:** Decide which model is authoritative (the one in `.env`/`.env.example` is what production actually runs), then make `config.py:17` and `breed_classifier.py:81` use that same id. Better: drop the hardcoded default from `DogBreedClassifier.__init__` entirely and require `model_id`, so `main.py:39` remains the single source. Apply the same treatment to `CatBreedClassifier` (`breed_classifier.py:93`) to prevent the pattern recurring.

**Verify:** `docker exec ft_transcendence_classification_service python -c "from src.config import settings; from src.models.breed_classifier import DogBreedClassifier; import inspect; print(settings.DOG_BREED_MODEL, inspect.signature(DogBreedClassifier.__init__))"` — the configured id and the signature must agree, and `COMPOSE_PROFILES=local docker compose logs classification-service | grep "Loading dog breed classifier"` must name it.

**Effort:** S - **Risk:** `tests/test_breed_classifier.py` instantiates the real model from `settings` and asserts the top-120 probabilities sum to ~1 (`top_k=120`); a model with a different class count breaks that assertion. Changing the id also invalidates any cached breed responses.

<!-- item id=CLS-04 priority=P2 effort=S service=classification-service -->
### CLS-04 - Route tests mock a species payload shape the classifier never emits

**Where:** `srcs/classification-service/tests/conftest.py:38-42`, `srcs/classification-service/src/models/species_classifier.py:78-84`, `srcs/classification-service/tests/test_classify_routes.py:31`

**Problem:** The `mock_species_classifier` fixture returns `top_predictions` entries keyed `{"species", "confidence"}`, but `SpeciesClassifier.predict` returns `{"label", "confidence"}`. `test_classify_routes.py` only asserts `len(...) == 3`, so the divergence is invisible and the route tests validate a contract that does not exist. Anyone copying the fixture as the reference shape ships a consumer that breaks against the real service.

**Fix:** Change the fixture entries to `{"label": ..., "confidence": ...}` to match `species_classifier.py:80`, and tighten `test_classify_routes.py` to assert `"label" in data["top_predictions"][0]` and that `data["species"]` equals the first entry's label, not just the list length.

**Verify:** `COMPOSE_PROFILES=local docker compose build classification-service && COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/test_classify_routes.py tests/test_species_classifier.py -v`

**Effort:** S - **Risk:** none beyond the two test files; no production code reads `top_predictions` (`srcs/ai/src/services/vision_orchestrator.py:69-75` uses only `species` and `confidence`).

<!-- item id=DB-02 priority=P2 effort=S service=db -->
### DB-02 - auth_schema exists only via the first-boot init script; without it auth tables land silently in `public`

**Where:** `srcs/db/init-scripts/01-init-schemas.sql:7`, `srcs/auth-service/apps/authentication/migrations/0001_initial.py` (no schema creation), `srcs/auth-service/config/settings.py:72-73`, compare `srcs/user-service/apps/profiles/migrations/0001_initial.py:12-15`

**Problem:** user-service creates `user_schema` in its own migration and recommendation-service creates `recommendation_schema` in `migrations/001_create_schema.sql`, but nothing in auth-service creates `auth_schema` — only the init script does, and `docker-entrypoint-initdb.d` runs once, on an empty data directory. auth-service connects with `-c search_path=auth_schema,public` and declares unqualified `db_table = 'users'` / `'refresh_tokens'` (models.py:67,98), so on any database where `auth_schema` is absent (pre-existing `db-data` volume, managed Postgres, restored dump) migrations do not fail — they quietly create the tables in `public`, breaking the documented schema separation and any later grant/backup scoped to `auth_schema`.

**Fix:** Mirror user-service: add `migrations.RunSQL("CREATE SCHEMA IF NOT EXISTS auth_schema;", reverse_sql="DROP SCHEMA IF EXISTS auth_schema CASCADE;")` as the first operation of `srcs/auth-service/apps/authentication/migrations/0001_initial.py` (the edit lands in auth-service; keep the AUTHORIZATION/GRANT lines in the init script). Then no schema depends solely on first-boot SQL.

**Verify:** `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "DROP SCHEMA auth_schema CASCADE;"` then `docker exec ft_transcendence_auth_service python manage.py migrate authentication zero && docker exec ft_transcendence_auth_service python manage.py migrate` — afterwards `\dt auth_schema.*` lists `users` and `refresh_tokens` and `\dt public.*` is empty.

**Effort:** S - **Risk:** edits an already-applied initial migration; `IF NOT EXISTS` makes it idempotent and Django will not re-run `0001` on existing installs. `docker compose run --rm auth-service python -m pytest tests/ -v` (pytest-django builds a fresh test DB) exercises the full migration chain and would catch a broken operation.

<!-- item id=DB-04 priority=P2 effort=S service=db -->
### DB-04 - Live Postgres password committed in plaintext in a config file no running service consumes

**Where:** `srcs/db/config/servers.json:11`, `docker-compose.yml:269-284` (pgadmin block, commented out)

**Problem:** `servers.json` is git-tracked and stores `"Password": "smartbreeds_password"`, the same value as the live `srcs/db/.env` (which is correctly gitignored via `.gitignore:11`). Its only consumer is the commented-out pgadmin service, so it is dead config whose sole effect is to normalise keeping a DB password in version control — the next person rotating the password will either leave it stale or commit the real one. Not P0 today: the value equals the documented dev default already shipped in `srcs/db/.env.example:3`, and the db container publishes no host port.

**Fix:** Delete the `Password` key (pgAdmin prompts on connect, or point it at a mounted `PGPASSFILE`); if the pgadmin service is not coming back, delete `srcs/db/config/servers.json` along with the disabled compose block. If the file is kept, rename it to `servers.json.example` and add `srcs/db/config/servers.json` to `.gitignore`.

**Verify:** `git grep -n smartbreeds_password -- srcs/db` returns only `srcs/db/.env.example`.

**Effort:** S - **Risk:** none while pgadmin is disabled; if it is re-enabled, the connection profile will prompt for a password on first use instead of auto-connecting.

<!-- item id=NGX-01 priority=P2 effort=S service=nginx -->
### NGX-01 - Delete the committed TLS private key from srcs/nginx/ssl/

**Where:** `srcs/nginx/ssl/selfsigned.key`, `srcs/nginx/ssl/selfsigned.crt`, `srcs/nginx/docker-entrypoint.sh:20-27`

**Problem:** A 2048-bit RSA private key is tracked in git (`git ls-files srcs/nginx/ssl` lists both files). It is also dead weight: `srcs/nginx/Dockerfile` never `COPY`s `ssl/`, the nginx service in docker-compose.yml declares no volumes, and `docker-entrypoint.sh:20-23` regenerates the pair on every container start. The committed cert expired on 2026-05-23 (`openssl x509 -noout -dates`).

**Fix:** `git rm -r srcs/nginx/ssl` and add `srcs/nginx/ssl/` to `.gitignore`. No key rotation is needed — nothing in the stack ever loads this pair (self-signed, CN=localhost, never trusted by anything) — but scrub it from history with `git filter-repo --path srcs/nginx/ssl --invert-paths` if this repo is or will be public. The entrypoint already creates `/etc/nginx/ssl/selfsigned.{crt,key}` at runtime, which is what `default.conf.template:36-37` points at.

**Verify:** `git ls-files srcs/nginx/ssl` prints nothing, and after `docker compose up nginx -d`, `docker exec ft_transcendence_nginx openssl x509 -in /etc/nginx/ssl/selfsigned.crt -noout -dates` shows a certificate issued today.

**Effort:** S - **Risk:** none functionally; the runtime cert is unchanged. If someone has been mounting these files locally, TLS startup will now depend entirely on the entrypoint's `openssl req` succeeding — which is already the case in CI and in `make up`. Band note: this is P2, not P0, deliberately. A tracked private key normally is a drop-everything finding, but this one grants nothing — it is self-signed with `CN=localhost`, no client ever trusted it, it expired 2026-05-23, and no image, mount or config path loads it. Nothing can be impersonated or decrypted with it, so it is hygiene plus a secret-scanner false alarm rather than an exposed credential. Contrast INFRA-01, which stays P0 because the published password opens a real admin account. If this repo is ever made public, re-raise it on the strength of the scanner noise alone.

<!-- item id=NGX-04 priority=P2 effort=S service=nginx -->
### NGX-04 - Two CORS layers on /api, and the preflight branch omits Allow-Credentials

**Where:** `srcs/nginx/conf.d/default.conf.template:91-107`, `srcs/api-gateway/main.py:71-75`

**Problem:** NGINX unconditionally adds `Access-Control-Allow-Origin: https://${HOST_DOMAIN}` (currently `ft-transcendence.local`, per `srcs/nginx/.env`) while the gateway's `CORSMiddleware` adds its own for a disjoint whitelist (`localhost:5173`, `localhost:3000`, `smartbreeds.local`). A browser receiving two `Access-Control-Allow-Origin` headers rejects the response outright. Separately, the `if ($request_method = 'OPTIONS')` branch at lines 99-107 declares its own `add_header` set that omits `Access-Control-Allow-Credentials: true`, so every credentialed preflight fails even when the origins do line up — and the whole auth model is HTTP-only cookies.

**Fix:** Delete the CORS `add_header` block and the `OPTIONS` `if` branch from `location /api`, and let the API Gateway own CORS end to end (it already handles `OPTIONS` and sets `allow_credentials=True`). Add the deployment's real edge origin to `CORS_ORIGINS` in `srcs/api-gateway/.env` instead of hardcoding it in nginx.

**Verify:** `curl -sk -D- -o /dev/null -X OPTIONS https://localhost:8443/api/v1/auth/login -H 'Origin: https://localhost:8443' -H 'Access-Control-Request-Method: POST' | grep -ci access-control-allow-origin` returns exactly `1`, and the same command shows `access-control-allow-credentials: true`.

**Effort:** S - **Risk:** the gateway's whitelist becomes the single source of truth; an origin missing from `CORS_ORIGINS` now fails where nginx used to paper over it. Gateway CORS behaviour is exercised in `srcs/api-gateway/tests/` (no dedicated CORS test today — worth adding one). Batching: NGX-02, NGX-04, NGX-05, NGX-06, NGX-07, NGX-08, NGX-09 and NGX-11 all edit `conf.d/default.conf.template`, and four of them touch `location /api` specifically — do them as one config pass and re-run every NGX verify command afterwards, since `add_header` and `limit_req` inheritance means a change in one location block silently alters another. Only NGX-05→NGX-04 and NGX-07→INFRA-10 are true ordering constraints.

<!-- item id=NGX-05 priority=P2 effort=S service=nginx -->
### NGX-05 - Security headers are silently dropped on every /api response

**Where:** `srcs/nginx/conf.d/default.conf.template:46-50` and `:92-96`

**Problem:** NGINX `add_header` directives are inherited from an outer level only when the inner level declares none of its own. `location /api` declares five CORS `add_header` directives, so the server-level `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection` and `Referrer-Policy` (lines 46-50) are not emitted on any API response. The same applies to the `http`-level headers in `nginx.conf:54-56`. Every API response ships without HSTS or nosniff.

**Fix:** Removing the CORS block per NGX-04 restores inheritance automatically. If any `add_header` must stay in `location /api`, re-declare the full security-header set inside that location too — nginx has no "append" semantics.

**Verify:** `curl -sk -D- -o /dev/null https://localhost:8443/api/v1/auth/login -X POST | grep -iE 'strict-transport|x-content-type-options|x-frame-options'` prints all three headers.

**Effort:** S - **Risk:** none; strictly adds headers. Watch for clients that break on HSTS when hitting the stack over plain HTTP on 8000.

**Depends on:** NGX-04

<!-- item id=NGX-06 priority=P2 effort=S service=nginx -->
### NGX-06 - Auth endpoints get no stricter edge rate limit: auth_limit and api_limit are declared but never used

**Where:** `srcs/nginx/conf.d/default.conf.template:16-18`, `:77`

**Problem:** Three `limit_req_zone`s are declared — `api_limit` (100r/m), `auth_limit` (5r/m), `general_limit` (200r/m) — but the only `limit_req` directive in the file (line 77) uses `general_limit`. `/api/v1/auth/login` and `/api/v1/auth/register` are therefore rate limited at 200r/m with `burst=20`, identical to every other route, so the edge offers no brute-force protection beyond what the gateway's per-user limiter provides (and the gateway limiter keys on user id, which an unauthenticated login attempt does not have). The two unused zones also consume 20 MB of shared memory for nothing.

**Fix:** Add `location /api/v1/auth { limit_req zone=auth_limit burst=5 nodelay; limit_req_status 429; ... }` duplicating the `proxy_pass`/`proxy_set_header` block from `location /api`, and either wire `api_limit` onto `location /api` in place of `general_limit` or delete the `api_limit` zone declaration.

**Verify:** `for i in $(seq 1 20); do curl -sk -o /dev/null -w '%{http_code} ' -X POST https://localhost:8443/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"nope"}'; done` prints 429 after roughly the sixth attempt.

**Effort:** S - **Risk:** a too-tight burst breaks the Jupyter E2E notebook (`scripts/jupyter/test_ai_service.ipynb`), which logs in repeatedly; it runs against port 8001, not nginx, so it should be unaffected — confirm before merging.

<!-- item id=NGX-07 priority=P2 effort=S service=nginx -->
### NGX-07 - HTTP-to-HTTPS redirect sends clients to a port that is not published

**Where:** `srcs/nginx/conf.d/default.conf.template:153-163`

**Problem:** The port-80 server returns `301 https://$host$request_uri`, which resolves to the default HTTPS port 443. docker-compose.yml publishes `8000:80` and `8443:443`, so 443 is closed on the host. `http://localhost:8000/anything` therefore redirects the browser to `https://localhost/anything`, which is refused. Anyone following the "Access the application at https://localhost" line printed by `make up` hits the same dead end.

**Fix:** Two options, pick one and make it consistent: (a) publish `443:443` and `80:80` in docker-compose.yml so the redirect and every doc URL are correct — this is the repo-wide agent's change, this item then reduces to verification; or (b) keep the shifted ports and make the redirect port-aware by parameterising it, e.g. add `HTTPS_PORT` to `srcs/nginx/.env` / `.env.example`, extend the `envsubst` list in `docker-entrypoint.sh:16` to `'${HOST_DOMAIN} ${HTTPS_PORT}'`, and emit `return 301 https://$host:${HTTPS_PORT}$request_uri;`. Note `$host` already drops the incoming `:8000`.

**Verify:** `curl -sk -D- -o /dev/null http://localhost:8000/health | grep -i '^location:'` prints a URL that `curl -sk` can actually fetch.

**Effort:** S - **Risk:** if the ports move to 80/443 the host must not already have something bound there; if they stay shifted, the hardcoded `api_endpoint` string at line 135 also carries no port (see NGX-11).

**Depends on:** INFRA-10

<!-- item id=OLL-01 priority=P2 effort=S service=ollama -->
### OLL-01 - Ollama entrypoint neither waits for readiness nor checks that model pulls succeeded

**Where:** `srcs/ollama/init.sh:4-20`, `srcs/ollama/models.txt:1`

**Problem:** The script backgrounds `ollama serve`, sleeps a fixed 5s, runs `ollama pull` for each line of `models.txt` without checking the exit status, then `wait`s forever. If the server is not accepting connections within 5s, or a pull fails (bad tag, offline registry, full disk), the loop moves on and the container stays up with no model. The compose service also declares no healthcheck, so nothing can gate on it: `docker compose ps` shows ollama running while the first vision request in the `local` profile fails at LiteLLM with a model-not-found error. Even on the happy path the ~6 GB `qwen3-vl:8b` pull takes minutes during which the container already reports "up".

**Fix:** 1) Replace `sleep 5` with a bounded poll on `http://127.0.0.1:11434/api/tags` (e.g. 60 attempts at 2s) before pulling. 2) Test `ollama pull`'s exit status, retry with backoff, and after the loop assert every non-comment line of `models.txt` appears in `ollama list`. 3) On persistent failure log the offending model and either exit non-zero (the container restarts under `restart: unless-stopped`) or write a readiness marker (`/tmp/ollama-ready`) only on success so a compose healthcheck can test for it.

**Verify:** `docker compose --profile local up -d ollama && docker exec ollama ollama list` shows `qwen3-vl:8b`. Negative case: add a bogus tag line to `srcs/ollama/models.txt`, restart the container, and confirm the failure is loud (non-zero exit or absent readiness marker) instead of a silently model-less server.

**Effort:** S - **Risk:** exiting non-zero turns a transient registry outage into a crash-loop — prefer the readiness-marker variant on machines that are often offline. The matching `healthcheck:` for ollama and `depends_on: ollama: condition: service_healthy` for litellm are INFRA-04; without that half, this item makes the failure loud but nothing still gates on it. No test covers this script.

<!-- item id=REC-03 priority=P2 effort=S service=recommendation-service -->
### REC-03 - Missing X-User-ID answers HTTP 200 with success:false

**Where:** `srcs/recommendation-service/src/routes/recommendations.py:39-44`

**Problem:** The unauthenticated branch uses `return error_response(...)` instead of raising, so FastAPI serialises it with the default 200 status. A client that switches on the HTTP status treats an auth failure as a successful empty result. Every other error path in the service raises `HTTPException` correctly.

**Fix:** Replace the `return` with `raise HTTPException(status_code=401, detail=error_response("UNAUTHORIZED", "User ID required (X-User-ID header missing)", {"pet_id": pet_id}))`, matching the shape used at :53-60.

**Verify:** the service has no host port, and the gateway always injects the header, so the header-less request has to be made from a sibling container by hostname: `docker exec ft_transcendence_api_gateway curl -s -o /dev/null -w '%{http_code}\n' 'http://recommendation-service:3005/api/v1/recommendations/food?pet_id=x'` must print `401` (today `200`). Note `localhost:3005` is wrong from both the host and any other container.

**Effort:** S - **Risk:** None in the gateway path (the gateway always injects the header). No existing test asserts the 200 behaviour; `tests/integration/test_recommendations_e2e.py` exercises the authenticated path only.

<!-- item id=REC-04 priority=P2 effort=S service=recommendation-service -->
### REC-04 - `include_inactive` on the admin product list is a no-op

**Where:** `srcs/recommendation-service/src/routes/admin.py:39,49,52-56`, `srcs/recommendation-service/src/services/product_service.py:32`

**Problem:** The handler accepts `include_inactive` but calls `ProductService.get_active_products()`, which hard-filters `is_active == True` in SQL. The Python-side filter at :52-53 can only remove rows, never add soft-deleted ones, so an admin can never see or recover a deleted product through the list endpoint. The `limit` is also applied in Python after fetching the whole table.

**Fix:** Add an `include_inactive: bool = False` and a `limit`/`offset` to `ProductService.get_active_products` (or a new `list_products`), applying `.where(Product.is_active == True)` only when `include_inactive` is false and `.limit()/.offset()` in SQL. Delete the Python filter and slice at `admin.py:52-56`.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/test_product_service.py -v` with a new case asserting the `is_active` clause is absent when `include_inactive=True`; then end to end, as an admin (see REC-01): `curl -s -X DELETE http://localhost:8001/api/v1/admin/products/1 -b admin_cookies.txt` to soft-delete, then `curl -s 'http://localhost:8001/api/v1/admin/products?include_inactive=true' -b admin_cookies.txt | jq '[.data[] | select(.id==1)] | length'` → `1`, while the same URL without the flag → `0`.

**Effort:** S - **Risk:** `tests/integration/test_admin_e2e.py::test_admin_list_products_pagination` asserts the current Python-side limit semantics; recheck it after moving the limit into SQL.

<!-- item id=REC-05 priority=P2 effort=M service=recommendation-service -->
### REC-05 - A user-service outage is reported to the client as "pet not found", silently

**Where:** `srcs/recommendation-service/src/services/user_service_client.py:37-54`, `srcs/recommendation-service/src/routes/recommendations.py:52-60`, `srcs/recommendation-service/src/config.py:18`

**Problem:** `get_pet_profile` returns `None` for every outcome — 404, 500, timeout, DNS failure — and the caller turns `None` into `404 PET_NOT_FOUND`. When user-service is down every user is told their pets do not exist. The two `except` blocks carry `# Log ... (in production, use proper logging)` comments and log nothing; `LOG_LEVEL` is declared in `Settings` but the service configures no logging at all, so the failure leaves no trace anywhere.

**Fix:** Make the client distinguish outcomes — return the payload on 200, `None` on 404, and raise a `UserServiceUnavailable` exception on timeout/transport error/5xx. Catch it in the route and raise `HTTPException(503, detail=error_response("USER_SERVICE_UNAVAILABLE", ...))`. Add `logging.basicConfig(level=settings.LOG_LEVEL)` in `src/main.py` and `logger.warning/exception` calls in both `except` blocks with the pet id and the upstream status.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/test_user_service_client.py -v` with new cases patching `httpx.AsyncClient.get` to raise `httpx.TimeoutException` and to return 503; then `docker compose stop user-service && curl` the food endpoint through the gateway and confirm a 503 plus a log line in `docker logs ft_transcendence_recommendation_service`.

**Effort:** M - **Risk:** `tests/unit/test_user_service_client.py` currently asserts `None` on error paths and will need updating; `tests/integration/test_recommendations_e2e.py` asserts 404 for a genuinely unknown pet id — that path must keep returning 404.

<!-- item id=REC-06 priority=P2 effort=S service=recommendation-service -->
### REC-06 - Two feature weights are hard-coded literals, so `WEIGHT_INGREDIENT_PREFERENCES` is dead config

**Where:** `srcs/recommendation-service/src/config.py:14,25,37`, `srcs/recommendation-service/src/services/feature_engineering.py:144-152`

**Problem:** `WEIGHT_VECTOR[14]` is the literal `0.0`, so the ingredient score the product extractor computes from `grain_free`/`organic`/`hypoallergenic` is multiplied by zero and can never influence a recommendation — while `WEIGHT_INGREDIENT_PREFERENCES=0.10` is shipped in `.env.example` and looks live. `WEIGHT_VECTOR[2]` (breed) is the literal `0.05` with no matching setting, so it cannot be tuned without a rebuild. This violates the project's own "no hard-coded weights" convention.

**Fix:** Replace index 14 with `settings.WEIGHT_INGREDIENT_PREFERENCES`, add `WEIGHT_BREED_MATCH: float = 0.05` to `Settings` plus `.env.example`, and use it at index 2. Note that both extractors already populate index 14, so enabling it changes every score.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/test_config.py tests/unit/test_similarity_engine.py -v`, then `docker exec ft_transcendence_recommendation_service python -c "from src.config import WEIGHT_VECTOR; print(WEIGHT_VECTOR[2], WEIGHT_VECTOR[14])"`.

**Effort:** S - **Risk:** Every stored/expected similarity score shifts. `tests/unit/test_config.py:24` asserts health weights dominate all others — still true at 0.10, but re-run it. Baseline expectations in `tests/unit/test_similarity_engine.py` may need re-derivation.

<!-- item id=REC-07 priority=P2 effort=S service=recommendation-service -->
### REC-07 - `products_above_threshold` reports the post-limit count

**Where:** `srcs/recommendation-service/src/routes/recommendations.py:161-168`

**Problem:** `products_above_threshold` is set to `len(recommendations)`, which is computed after the `rank > limit` break, so it equals `recommendations_returned` in every response and never tells the caller how many products actually cleared the score threshold. The two metadata fields are permanently identical.

**Fix:** Compute `above = sum(1 for _, s in ranked if s >= min_score)` before the loop at :109 and use it for `products_above_threshold`; keep `len(recommendations)` for `recommendations_returned`.

**Verify:** `curl 'http://localhost:8001/api/v1/recommendations/food?pet_id=<id>&limit=1' -b cookies.txt | jq '.data.metadata'` — `products_above_threshold` must exceed `recommendations_returned` when more than one product matches.

**Effort:** S - **Risk:** None; metadata only. No test asserts these fields today.

<!-- item id=REC-08 priority=P2 effort=S service=recommendation-service -->
### REC-08 - `match_reasons` explains only two of the six health conditions

**Where:** `srcs/recommendation-service/src/routes/recommendations.py:120-127`

**Problem:** Only `joint_health` and `sensitive_stomach` produce a reason. `weight_management`, `skin_allergies`, `dental_health` and `kidney_health` all carry the full `WEIGHT_HEALTH_CONDITIONS` weight in the score (`config.py:27-32`, `feature_engineering.py:127-132`) but always fall through to the `"Nutritionally compatible"` placeholder, so the explanation contradicts the ranking the user is shown.

**Fix:** Replace the two hard-coded `if` blocks with a loop over a `{condition: (product_attr, reason_text)}` map covering all six flags in `PetFeatureExtractor.HEALTH_CONDITIONS`, keeping the fallback when nothing matches.

**Verify:** `docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/test_recommendations_e2e.py -v` after seeding a pet with `health_conditions=["kidney_health"]` and a product with `for_kidney_health=true`; assert the reason string appears in `match_reasons`.

**Effort:** S - **Risk:** Low. Response text only; `tests/integration/test_recommendations_e2e.py` asserts `match_reasons` is non-empty, which still holds.

<!-- item id=USER-03 priority=P2 effort=S service=user-service -->
### USER-03 - A request with no `X-User-ID` silently reads nothing or 500s instead of returning 401

**Where:** `srcs/user-service/apps/profiles/middleware.py:18-21`, `srcs/user-service/apps/profiles/views.py:27-29,97-103,192-198`

**Problem:** `UserContextMiddleware` sets `request.user_id = request.headers.get('X-User-ID')`, i.e. `None` when the header is absent, and only `delete_user_data` checks it (`views.py:61-62`). Reads then run `filter(user_id=None)` → SQL `user_id IS NULL` → an empty list with HTTP 200, and writes (`POST /api/v1/pets`, `GET /api/v1/users/me`'s `get_or_create`) hit the `NOT NULL` constraint and surface as a 500. Both are wrong answers to "you are not authenticated". Inferred from code — the gateway always sets the header today, so this bites direct backend callers (auth-service cascade delete, recommendation-service) and any future one.

**Fix:** Reject centrally rather than per-view: in `UserContextMiddleware.__call__`, if the path is not `/health` or `/api/v1/health` and `X-User-ID` is missing or not a valid `uuid.UUID`, return a 401 `UNAUTHORIZED` envelope (same shape as `Custom404Middleware` builds at `middleware.py:40-52`) without calling `get_response`.

**Verify:** `docker compose run --rm user-service python -m pytest tests/test_middleware.py -v` with a new case asserting 401 for a request without the header, then `docker exec ft_transcendence_user_service curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/api/v1/pets` → 401 (was 200 with `[]`).

**Effort:** S - **Risk:** the health checks must stay exempt or the compose healthcheck (`docker-compose.yml:216-221`) starts failing; view tests build requests with `RequestFactory` and bypass middleware entirely (`tests/test_views.py`), so they will not catch a mistake here — `tests/test_middleware.py` is the only cover.

<!-- item id=USER-04 priority=P2 effort=S service=user-service -->
### USER-04 - A non-UUID id in the path 500s instead of 404

**Where:** `srcs/user-service/apps/profiles/views.py:122-183,217-225`

**Problem:** `GET /api/v1/pets/not-a-uuid` reaches `self.get_queryset().get(pk='not-a-uuid')`; `UUIDField.to_python` raises `django.core.exceptions.ValidationError`, which the surrounding `except Pet.DoesNotExist` blocks do not catch, so Django returns an HTML 500. The API Gateway papers over it by rewriting HTML 500s whose body contains `Not Found`/`DoesNotExist` into a JSON 404 (`srcs/api-gateway/routes/proxy.py:205-224`) — a workaround that also masks genuine 500s. Same defect in every `retrieve`/`update`/`partial_update`/`destroy`/`analyses` handler and in `PetAnalysisViewSet.retrieve`.

**Fix:** Constrain the router lookup so a bad id never reaches the ORM: set `lookup_value_regex = '[0-9a-fA-F-]{36}'` on `PetViewSet`, `PetAnalysisViewSet` and `UserProfileViewSet` (non-matching paths then 404 via `Custom404Middleware`). Belt and braces: widen the except clauses to `except (Pet.DoesNotExist, DjangoValidationError)`.

**Verify:** `docker exec ft_transcendence_user_service curl -s -o /dev/null -w '%{http_code}' -H 'X-User-ID: 00000000-0000-0000-0000-000000000000' http://localhost:3002/api/v1/pets/not-a-uuid` → 404, and the body is the standard `NOT_FOUND` envelope. Add the case to `tests/test_views.py::TestPetViewSetAdditional`.

**Effort:** S - **Risk:** an over-tight regex would 404 legitimate ids; `tests/test_views.py::TestPetViewSet::test_retrieve_pet_enforces_ownership` and `::test_delete_pet` cover the happy path. The gateway's 500→404 rewrite lives in the same three HTML-normalisation branches that GW-04 and GW-13 rewrite (`srcs/api-gateway/routes/proxy.py:205-224`); it can be removed once this lands, but no roadmap item currently does so — raise one if you want the masking gone.

<!-- item id=USER-05 priority=P2 effort=M service=user-service -->
### USER-05 - `UserProfileViewSet` publishes stock CRUD routes that return un-enveloped payloads and a guaranteed 500

**Where:** `srcs/user-service/apps/profiles/views.py:22-25`, `srcs/user-service/apps/profiles/urls.py:7`

**Problem:** The class docstring says "only supports /me endpoint" but it is a plain `ModelViewSet`, so `DefaultRouter` also mounts `GET/POST /api/v1/users` and `GET/PUT/PATCH/DELETE /api/v1/users/{id}`. Those run DRF's stock handlers, which return bare JSON with no `success`/`data`/`error` envelope, and `POST` can never succeed because `user_id` is `read_only` in `UserProfileSerializer` (`serializers.py:14`) while the column is `NOT NULL` — the client gets a 500, not a validation error. `PetAnalysisViewSet` restricts this correctly with `http_method_names` (`views.py:190`).

**Fix:** Make the surface match the docstring: on `UserProfileViewSet` either set `http_method_names = ['get', 'put', 'patch', 'delete']` and remove the inherited `list`/`create`/`retrieve`/`update`/`partial_update`/`destroy` by switching the base class to `viewsets.ViewSet` + the two `@action`s, or override each unwanted handler to return `error_response('NOT_FOUND', ...)`. Simplest correct form: `viewsets.ViewSet` with `me` and `delete_user_data` only, keeping `get_queryset` for the actions.

**Verify:** `docker exec ft_transcendence_user_service python -c "from django.urls import get_resolver; import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); django.setup(); print([str(p.pattern) for p in get_resolver().url_patterns])"` no longer lists a bare `users` detail route. Behavioural check from inside the container (backend services have no host port): `docker exec ft_transcendence_user_service curl -s -o /dev/null -w '%{http_code}\n' -H 'X-User-ID: 00000000-0000-0000-0000-000000000000' http://localhost:3002/api/v1/users` → `404` or `405`, not `200` with a bare list, and the same against `-X POST` → not `500`. Then `docker compose run --rm user-service python -m pytest tests/test_views.py -v` still passes.

Note the routes are scoped, not open: `get_queryset` filters on `self.request.user_id` (`views.py:27-29`), so the stock `list`/`retrieve` return only the caller's own profile. This item is about the un-enveloped body and the guaranteed 500 on `POST`, not about cross-user exposure — do not re-band it as a data leak.

**Effort:** M - **Risk:** `TestUserProfileViewSet` and `TestUserProfileViewSetAdditional` in `tests/test_views.py` instantiate the ViewSet through `as_view({...})` with explicit action maps, so they keep working, but any code calling `UserProfileViewSet.as_view({'get': 'list'})` would break — `tests/test_views.py` is the only such caller.

<!-- item id=USER-06 priority=P2 effort=S service=user-service -->
### USER-06 - `POST /api/v1/pets` silently discards `breed_confidence` and `image_url`

**Where:** `srcs/user-service/apps/profiles/serializers.py:92-104`

**Problem:** `PetCreateSerializer.Meta.fields` is `['name','species','breed','age','weight','health_conditions']`. A client that posts a pet with `breed_confidence` and `image_url` — the two fields the vision pipeline produces — gets a 201 and a body where both are `null`, with no error. They are only writable later via `PUT/PATCH` (which use `PetSerializer`). Found by reading code.

**Fix:** Add `breed_confidence` and `image_url` to `PetCreateSerializer.Meta.fields` with `extra_kwargs` `{'required': False}`, and copy `validate_breed_confidence` from `PetSerializer` (`serializers.py:85-89`) — the pair of serializers duplicates its validators by design.

**Verify:** `docker compose run --rm user-service python -m pytest tests/test_serializers.py -v` with a new case asserting a create payload containing `breed_confidence: 0.9` and `image_url` round-trips, plus `tests/test_views.py::TestPetViewSet::test_create_pet_sets_user_id_from_header` still passes.

**Effort:** S - **Risk:** widens the create write surface; `breed_confidence` must stay bounded 0..1 or the new validator is the only thing between clients and garbage data. Covered by `tests/test_serializers.py::TestPetSerializer`.

<!-- item id=USER-07 priority=P2 effort=S service=user-service -->
### USER-07 - `DEBUG` defaults to `True`, so a `.env` without the key starts the service in debug mode

**Where:** `srcs/user-service/config/settings.py:12`

**Problem:** `DEBUG = config('DEBUG', default=True, cast=bool)` while `.env.example:3` ships `DEBUG=False`. `srcs/user-service/.env` is git-ignored (`.gitignore:11`), so every environment builds its own — one that omits `DEBUG` silently runs with Django's technical 500 pages, which return full tracebacks, local variables and SQL through the gateway to the client. Inferred from code, not observed.

**Fix:** Change the default to `False` in `config/settings.py:12`. Optionally fail loudly instead: `DEBUG = config('DEBUG', default=False, cast=bool)` plus an assertion that `SECRET_KEY` is not the built-in `django-insecure-dev-key-...` when `DEBUG` is false.

**Verify:** `docker exec ft_transcendence_user_service python -c "import os,django; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); django.setup(); from django.conf import settings; print(settings.DEBUG)"` prints `False` with `DEBUG` removed from the env file.

**Effort:** S - **Risk:** with `DEBUG=False`, `runserver` stops serving static files and unhandled exceptions become bare 500s — nothing in this API-only service serves static assets. No test asserts `settings.DEBUG`. The same default exists in auth-service as AUTH-08 — one-line change in each `config/settings.py`, do both together.

---

## P3 - Infrastructure and operability

_Compose wiring, healthchecks, startup ordering, logging, ports, build hygiene._

<!-- item id=AI-09 priority=P3 effort=M service=ai-service -->
### AI-09 - Tunables hardcoded outside config.py, including the cloud profile's crossbreed gates

**Where:** `srcs/ai/src/services/ollama_client.py:31-33`, `srcs/ai/src/services/vision_orchestrator.py:83,150`, `srcs/ai/src/services/rag_service.py:261,310,285-287,332-334`

**Problem:** The project convention is that every threshold lives in `config.py` / `.env`. Eight values violate it: `crossbreed_probability_threshold=0.35`, `purebred_confidence_threshold=0.75`, `purebred_gap_threshold=0.30` (these three decide purebred vs crossbreed on the VLM-only path, i.e. the entire `cloud` profile), `detect_breed(top_k=5)`, `analyze_breed(top_n_breeds=2)`, ChromaDB `n_results` 5 and 3, and the 500/300/300-character context truncations. Tuning any of them requires editing source, not `.env`.

**Fix:** Add settings to `srcs/ai/src/config.py` (`CROSSBREED_PROBABILITY_THRESHOLD`, `PUREBRED_CONFIDENCE_THRESHOLD`, `PUREBRED_GAP_THRESHOLD`, `BREED_TOP_K`, `VLM_TOP_N_BREEDS`, `RAG_BREED_N_RESULTS`, `RAG_CROSSBREED_N_RESULTS`, `RAG_CONTEXT_MAX_CHARS`), read them off the injected `config` at the call sites, and document the tunable subset in `srcs/ai/.env.example`.

**Verify:** `docker compose run --rm -e CROSSBREED_PROBABILITY_THRESHOLD=0.9 ai-service python -c "from src.config import Settings; from src.services.ollama_client import OllamaVisionClient; print(OllamaVisionClient(Settings()).crossbreed_probability_threshold)"` prints `0.9`.

**Effort:** M - **Risk:** `tests/test_ollama_client.py` (23 tests) constructs the client with a `Mock()` config; every new attribute must be set on those fixtures or the Mock silently returns a truthy Mock and comparisons raise `TypeError`.

<!-- item id=AI-10 priority=P3 effort=M service=ai-service -->
### AI-10 - The VLM-only pipeline and the vision route have no test coverage

**Where:** `srcs/ai/tests/test_vision_orchestrator.py:26-32`, `srcs/ai/src/services/vision_orchestrator.py:134-184`, `srcs/ai/src/routes/vision.py`

**Problem:** `mock_config` is a bare `Mock()` with only `SPECIES_MIN_CONFIDENCE` and `BREED_MIN_CONFIDENCE` set, so `config.CLASSIFICATION_ENABLED` is an auto-created truthy attribute and all 8 orchestrator tests take the full-pipeline branch. `_analyze_vlm_only` — the whole `cloud` profile pipeline — is never executed by any test, and there is no test file that imports `src.routes.vision` at all, so the exception→HTTP mapping in AI-02/AI-03/AI-04/AI-05 is unverified. `src/main.py` is likewise untested.

**Fix:** Set `config.CLASSIFICATION_ENABLED = True` explicitly in `mock_config` and add a second fixture with it `False`; write tests for `_analyze_vlm_only` covering the crossbreed path, the `BREED_DETECTION_FAILED` gate and RAG degradation. Add `tests/test_vision_routes.py` using `TestClient(app)` built without the `with` block and with `vision.image_processor` / `vision.vision_orchestrator` assigned directly, mirroring `tests/test_rag_routes.py`.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=term` shows non-zero coverage for `src/routes/vision.py` and the `_analyze_vlm_only` lines.

**Effort:** M - **Risk:** using `with TestClient(app)` would run the real lifespan and download sentence-transformers models — do not.

<!-- item id=GW-09 priority=P3 effort=S service=api-gateway -->
### GW-09 - Module-level httpx.AsyncClient is never closed

**Where:** `srcs/api-gateway/routes/proxy.py:13`, `srcs/api-gateway/main.py:13-17`

**Problem:** `httpx_client` is constructed at import time and `main.py` declares no lifespan or shutdown handler, so the connection pool is never drained. On restart or redeploy, in-flight requests — including vision calls holding a connection for up to the 300s override (`proxy.py:16-18`) — are torn down abruptly instead of closed. Derived from reading code, not observed at runtime.

**Fix:** Add an `@asynccontextmanager async def lifespan(app)` in `main.py` that yields, then `await proxy.httpx_client.aclose()`, and pass `FastAPI(lifespan=lifespan, ...)`. Keep the module-level attribute name `routes.proxy.httpx_client` — the entire test suite patches it (`tests/test_proxy.py:32`).

**Verify:** `docker compose restart api-gateway && docker compose logs --tail=30 api-gateway` shows a clean "Application shutdown complete" with no pool warnings; `docker compose run --rm --no-deps api-gateway python -m pytest tests/ -v` still passes.

**Effort:** S - **Risk:** six test modules build `TestClient(main.app)` at module scope and will now run the lifespan on enter/exit; make `aclose()` tolerant of being called twice.

<!-- item id=GW-10 priority=P3 effort=S service=api-gateway -->
### GW-10 - Test suite cannot be collected without a container-supplied env var

**Where:** `srcs/api-gateway/tests/conftest.py:33-41`, `srcs/api-gateway/config.py:21`

**Problem:** `conftest.py:35-41` seeds `JWT_PUBLIC_KEY_PATH`, `JWT_ALGORITHM`, `AUTH_SERVICE_URL`, `USER_SERVICE_URL`, `AI_SERVICE_URL`, `REDIS_URL` and `RATE_LIMIT_PER_MINUTE` into `os.environ` before `config` is imported, but omits `RECOMMENDATION_SERVICE_URL`, which `config.py:21` declares with no default. The suite is therefore not self-contained: it collects only where that value reaches `Settings` from outside. Inside the container it does — compose sets it via `env_file`, and `Dockerfile:13` (`COPY . .`, no `.dockerignore`) also bakes `srcs/api-gateway/.env:22` into the image, which pydantic-settings reads from `WORKDIR /app`. Collection aborts with a pydantic `ValidationError` when neither source is present, i.e. a host `pytest` run from any directory other than `srcs/api-gateway`. Fixing GW-11 (adding `.env` to `.dockerignore`) removes the in-image fallback and makes the container run depend solely on compose's `env_file`.

**Fix:** Add `os.environ["RECOMMENDATION_SERVICE_URL"] = "http://recommendation-service-test:3005"` next to the others at `conftest.py:41`.

**Verify:** from the repo root on the host, `python -m pytest srcs/api-gateway/tests -q` aborts during collection today and collects after the fix. In-container: `docker exec ft_transcendence_api_gateway sh -c 'cd /tmp && env -u RECOMMENDATION_SERVICE_URL python -m pytest /app/tests -q'` (the `cd` is what defeats the baked `/app/.env`).

**Effort:** S - **Risk:** none. `tests/` is bind-mounted (`docker-compose.yml:301`) so no rebuild is needed.

<!-- item id=GW-11 priority=P3 effort=S service=api-gateway -->
### GW-11 - No .dockerignore, so the local .env and caches are baked into the image

**Where:** `srcs/api-gateway/Dockerfile:13`

**Problem:** `COPY . .` copies the whole service directory into the image layer, including `.env`, `__pycache__/` and `.pytest_cache/`. Today `srcs/api-gateway/.env` is byte-identical to `.env.example` and holds no secret, so this is hygiene rather than an active leak — but the runtime `env_file` values win at load time, which makes the baked copy invisible and the day someone puts a Redis password in there it ships inside the image unnoticed.

**Fix:** Create `srcs/api-gateway/.dockerignore` with `.env`, `.venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`. Do **not** exclude `tests/` unless you also stop using `docker compose run --rm api-gateway pytest`, which relies on them being present in the image on hosts without the bind mount.

**Verify:** `docker compose build api-gateway && docker run --rm --entrypoint sh ft_transcendence_api_gateway:local -c 'ls -a /app | grep -c "^\.env$"'` → `0`.

**Effort:** S - **Risk:** an over-broad ignore list silently drops application code from the image; check `docker compose run --rm --no-deps api-gateway python -m pytest tests/ -q` after building.

<!-- item id=AUTH-06 priority=P3 effort=S service=auth-service -->
### AUTH-06 - With DEBUG=True, missing JWT keys are swallowed and the healthcheck stays green

**Where:** `srcs/auth-service/config/settings.py:142-164`

**Problem:** `load_jwt_keys()` raises `FileNotFoundError` for a missing `jwt-private.pem`/`jwt-public.pem`, but the caller re-raises **only when `DEBUG` is falsy** (`settings.py:158-164`); otherwise it prints a warning and sets `JWT_KEYS = {'private': '', 'public': ''}`. The container then boots and passes its `/health` healthcheck (`views.py:527-539` touches nothing) while every login, refresh and verify fails with an opaque JWT error. Scope: the shipped `srcs/auth-service/.env:2` and `.env.example:2` both set `DEBUG=False`, and compose injects that file (`docker-compose.yml` `env_file`), so the running stack currently fails fast as intended — this is latent, reachable only by flipping `DEBUG` or by writing a `.env` that omits the key (the code default at `settings.py:12` is `True`, see AUTH-08).

**Fix:** Remove the `if not DEBUG: raise` guard and let `load_jwt_keys()` raise unconditionally — a service that cannot sign tokens has no useful degraded mode. If a keyless dev boot is genuinely wanted, keep the fallback but make `HealthView` report `degraded` with HTTP 503 when `settings.JWT_KEYS['private']` is empty, so the compose healthcheck actually fails.

**Verify:** `docker compose run --rm -e DEBUG=True -e JWT_PRIVATE_KEY_PATH=/nonexistent.pem auth-service python manage.py check` must exit non-zero; today it exits 0 after printing a warning.

**Effort:** S - **Risk:** any environment that starts the container before `keys/generate-keys.sh` has run will now hard-fail instead of limping — that is the point, but it changes first-run behaviour for anyone following the setup order loosely. No existing test covers `load_jwt_keys`; `srcs/auth-service/tests/test_jwt_utils.py` signs with the real key pair and will fail loudly if keys are absent.

<!-- item id=AUTH-08 priority=P3 effort=S service=auth-service -->
### AUTH-08 - Settings default to `DEBUG=True` and a shared known `SECRET_KEY`

**Where:** `srcs/auth-service/config/settings.py:11-13`

**Problem:** `SECRET_KEY` falls back to the literal `django-insecure-dev-key-change-in-production` and `DEBUG` falls back to `True` when the variables are absent. The shipped `.env` sets both correctly and compose refuses to start without `srcs/auth-service/.env`, so this only bites when the env file exists but omits a key — at which point the service runs with debug tracebacks exposed through the gateway and a publicly known signing secret for anything Django signs. Derived from reading code; not observed at runtime.

**Fix:** Drop the defaults: `SECRET_KEY = config('SECRET_KEY')` and `DEBUG = config('DEBUG', default=False, cast=bool)`. `decouple.config` raises `UndefinedValueError` on a missing value with no default, which is the wanted fail-fast. Keep `.env.example` as the documentation of what must be set.

**Verify:** `docker compose run --rm -e SECRET_KEY= auth-service python manage.py check` must fail; `docker compose run --rm auth-service python -c "from django.conf import settings; import django; django.setup(); print(settings.DEBUG)"` must print `False` with the shipped `.env`.

**Effort:** S - **Risk:** `DEBUG=False` makes `load_jwt_keys()` raise on missing keys (`settings.py:158-164`), so this and AUTH-06 change first-boot behaviour together. `srcs/auth-service/tests/` runs with the repo `.env` and is unaffected.

<!-- item id=AUTH-09 priority=P3 effort=M service=auth-service -->
### AUTH-09 - `refresh_tokens` grows without bound

**Where:** `srcs/auth-service/apps/authentication/utils.py:28-32`, `srcs/auth-service/apps/authentication/models.py:85-103`

**Problem:** A row is inserted on every login, register, refresh and password change, and nothing ever deletes one. Revoked and long-expired rows accumulate forever in `auth_schema.refresh_tokens`; with token rotation on every refresh, an active user generates a row per access-token lifetime (15 minutes). The only deletions are the FK cascade when a user is deleted.

**Fix:** Add a management command `apps/authentication/management/commands/prune_refresh_tokens.py` that deletes rows where `expires_at < now()` or (`is_revoked=True` and `created_at < now() - retention`), with retention read from `settings`. There is no management-command package in this service yet, so create `management/__init__.py` and `management/commands/__init__.py`. Wire it to a schedule outside the service (compose-level cron or a call from `scripts/`) — that wiring belongs to the repo-wide agent.

**Verify:** `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "select count(*) from auth_schema.refresh_tokens where is_revoked"` before, then `docker exec ft_transcendence_auth_service python manage.py prune_refresh_tokens`, then the same count — must drop to 0 for rows older than the retention window.

**Effort:** M - **Risk:** deleting a row whose JWT is still unexpired makes `RefreshView` return `INVALID_TOKEN` instead of `TOKEN_REVOKED` (the lookup at `views.py:186` misses) — a different error code for the same rejection. Guard the retention window so it exceeds `JWT_REFRESH_TOKEN_LIFETIME_DAYS`. `srcs/auth-service/tests/test_views.py::TestRefreshView` covers the rejection paths.

<!-- item id=AUTH-10 priority=P3 effort=M service=auth-service -->
### AUTH-10 - Image ships the Django dev server plus the whole test toolchain

**Where:** `srcs/auth-service/Dockerfile:18-23,39`, `srcs/auth-service/requirements.txt:8`

**Problem:** `CMD` is `python manage.py runserver 0.0.0.0:3001` — single-threaded, auto-reloading, explicitly not for anything but development — while `gunicorn==21.2.0` is installed and never invoked. The same image also `pip install`s `requirements-dev.txt` (pytest, pytest-django, pytest-cov, factory-boy, freezegun), so the runtime image carries the test toolchain.

**Fix:** Add a multi-stage split: a `runtime` stage installing only `requirements.txt` with `CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:3001", "--workers", "3"]`, and a `dev` stage layered on top that adds `requirements-dev.txt` and keeps `runserver`. Point `docker-compose.yml`'s `build.target` at `dev` (compose change belongs to the repo-wide agent). Do not simply delete `requirements-dev.txt` from the image: the documented test command `docker compose run --rm auth-service python -m pytest tests/ -v` needs pytest present.

**Verify:** `docker compose build auth-service && docker exec ft_transcendence_auth_service ps -o args= -p 1` shows the expected server for the selected target, and `curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/api/v1/auth/refresh` still returns 401 rather than a connection error.

**Effort:** M - **Risk:** gunicorn does not reload on source edits, and `docker-compose.yml:186-188` bind-mounts `./srcs/auth-service` over `/app` for hot reload — switching the default target to a gunicorn runtime silently removes that workflow. `srcs/user-service/Dockerfile:24` has the identical problem as USER-08 — same multi-stage split, same compose `build.target` edit; do them together and change `docker-compose.yml` once.

<!-- item id=CLS-05 priority=P3 effort=S service=classification-service -->
### CLS-05 - DEVICE is missing from the env template it is supposed to be set in

**Where:** `srcs/classification-service/.env.example` (no `DEVICE` line), `srcs/classification-service/src/config.py:12`

**Problem:** `docker-compose.yml:119` carries the comment "DEVICE controlled via .env file (auto/cuda/cpu)", but neither `.env.example` nor the live `.env` defines it, so the `config.py` default `auto` always applies. When the NVIDIA runtime is present but CUDA is unusable, `torch.cuda.is_available()` returns False and the service silently runs four transformer models on CPU — inference slows by an order of magnitude with nothing in the logs beyond one `Using device: cpu` line, and there is no way to pin `cuda` to make the failure loud.

**Fix:** Add `DEVICE=auto` with the `# auto|cuda|cpu` comment to `srcs/classification-service/.env.example` (and to the local `.env`). Optionally make `main.py:28-33` raise when `DEVICE=cuda` is requested and `torch.cuda.is_available()` is False, instead of silently honouring the explicit request against a CPU-only box.

**Verify:** `docker exec ft_transcendence_classification_service printenv DEVICE` prints the configured value, and `COMPOSE_PROFILES=local docker compose logs classification-service | grep "Using device"` shows `Using device: cuda (config: cuda)` after setting `DEVICE=cuda`.

**Effort:** S - **Risk:** pinning `DEVICE=cuda` on a machine without a working GPU makes the container fail its lifespan; with no `restart:` policy on this compose service (INFRA-11) it stays down. No test covers device resolution.

<!-- item id=DB-01 priority=P3 effort=S service=db -->
### DB-01 - Bootstrap SQL hardcodes the database name and role, so POSTGRES_* cannot be changed

**Where:** `srcs/db/init-scripts/01-init-schemas.sql:4,7-16,19-22,25`, `srcs/db/.env.example:1-2`

**Problem:** The script hardcodes `\c smartbreeds` and `AUTHORIZATION smartbreeds_user` / `GRANT ... TO smartbreeds_user` / `ALTER ROLE smartbreeds_user`, while the container's real database and role come from `POSTGRES_DB`/`POSTGRES_USER` in `srcs/db/.env`. Change either and first boot dies: the postgres entrypoint runs initdb scripts with `ON_ERROR_STOP=1`, so `CREATE SCHEMA ... AUTHORIZATION smartbreeds_user` aborts with `role "smartbreeds_user" does not exist`, the db container never reaches healthy, and auth-service/user-service never start. Derived from reading the script and the compose env wiring, not observed at runtime.

**Fix:** 1) Reproduce: set `POSTGRES_USER=other` in `srcs/db/.env`, `make downv`, `docker compose up db`, observe the entrypoint abort. 2) Delete the `\c smartbreeds;` line — the entrypoint already connects to `$POSTGRES_DB`. 3) Replace every `smartbreeds_user` literal with `CURRENT_USER` (valid in `CREATE SCHEMA ... AUTHORIZATION`, `GRANT ... TO`, and `ALTER ROLE ... SET search_path` since PG 9.5), which resolves to the bootstrap superuser the entrypoint is connected as.

**Verify:** With non-default values in `srcs/db/.env`: `make downv && docker compose up db -d`, then expand the credentials inside the container (they are not in your host shell) — `docker exec ft_transcendence_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"'` lists the service schemas, and `docker inspect -f '{{.State.Health.Status}}' ft_transcendence_db` reports `healthy`.

**Effort:** S - **Risk:** the compose healthcheck (`docker-compose.yml:259`) still interpolates `${POSTGRES_USER-...}`/`${POSTGRES_DB-...}` from the shell/root `.env` rather than `srcs/db/.env`, so a renamed role/db still breaks readiness — that half of the fix is INFRA-08 and must land in the same change, or the verify above reports `unhealthy` even with a correct init script. No automated test covers the init script.

<!-- item id=LLM-01 priority=P3 effort=S service=litellm -->
### LLM-01 - Proxy timeout and retry policy are unset, so they cannot line up with the caller's 300s budget

**Where:** `srcs/litellm/config.yaml:6-30`

**Problem:** Neither `model_list` entries nor `litellm_settings` set `request_timeout`, `timeout` or `num_retries`, so the proxy's built-in defaults govern. The AI Service gives up at `LLM_TIMEOUT=300` (`srcs/ai/src/config.py`) and NGINX at 30s (NGX-02). When the caller times out, the proxy has no matching deadline and the upstream generation keeps running, holding GPU/VRAM for a request nobody is waiting on; an implicit retry would double an already 300s call. Inferred from reading the config — not observed at runtime.

**Fix:** Pin the policy explicitly rather than inheriting a default: add `request_timeout: 300` and `num_retries: 0` under `litellm_settings` in `srcs/litellm/config.yaml`, matching `LLM_TIMEOUT`. Restart the container — the config is mounted read-only and read only at startup.

**Verify:** the litellm image has no `curl` — its own compose healthcheck (`docker-compose.yml:39`) uses urllib, so match it: `docker compose restart litellm && docker exec ft_transcendence_litellm python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:4000/health/liveliness').status)"` prints `200`. Then send a deliberately long generation and confirm from `docker compose logs litellm` that the proxy aborts at ~300s rather than running on after the AI Service has given up.

**Effort:** S - **Risk:** a `request_timeout` set too low turns slow-but-successful first-token-after-model-load calls into hard failures on the `local` profile, where the first request also pays the `qwen3-vl:8b` VRAM load. Keep it at or slightly above `LLM_TIMEOUT`.

<!-- item id=NGX-08 priority=P3 effort=S service=nginx -->
### NGX-08 - Per-vhost logs are invisible to `docker logs` and vanish with the container; logrotate.conf is never installed

**Where:** `srcs/nginx/Dockerfile:14-24`, `srcs/nginx/conf.d/default.conf.template:32-33,74,133,159`, `srcs/nginx/logrotate.conf`

**Problem:** The config writes to five per-vhost files (`https_access.log`, `https_error.log`, `api_access.log`, `root_access.log`, `http_access.log`) that are plain files inside the container. The nginx service in docker-compose.yml mounts no volume on `/var/log/nginx`, so all of it is lost on `docker compose down`, and none of it reaches `docker logs ft_transcendence_nginx` (only `access.log`/`error.log` are symlinked to stdout/stderr by the base image). `logrotate.conf` is committed but no `COPY` in the Dockerfile installs it and no logrotate daemon runs in the container, so the rotation policy is inert and those files grow without bound for the life of the container.

**Fix:** Point the per-vhost logs at the container's stdout/stderr — either change the `access_log`/`error_log` targets in `default.conf.template` to `/dev/stdout main` and `/dev/stderr warn`, or add `RUN ln -sf /dev/stdout /var/log/nginx/https_access.log ...` for each file in the Dockerfile. Then delete `srcs/nginx/logrotate.conf`, which is dead once logs are streamed. If durable per-vhost files are actually wanted instead, the log volume belongs to the repo-wide compose change and logrotate needs a real cron.

**Verify:** `docker exec ft_transcendence_nginx ls -l /var/log/nginx/` shows the symlinks, and `curl -sk https://localhost:8443/api/v1/auth/login -X POST >/dev/null && docker logs --tail 5 ft_transcendence_nginx` shows the API request line.

**Effort:** S - **Risk:** log volume on stdout grows the Docker json-file log; cap it with a logging driver limit if that matters.

<!-- item id=NGX-12 priority=P3 effort=S service=nginx -->
### NGX-12 - The nginx healthcheck only parses the config; it can never detect a dead edge

**Where:** `docker-compose.yml:18-23`

**Problem:** `test: ["CMD", "nginx", "-t"]` runs the config-syntax checker against the on-disk config. It answers the same way whether the master process is serving, wedged, or has all its workers dead, and it never touches port 80/443 — a running container with a broken listener reports `healthy` forever. The check is also strictly weaker than it looks: `docker-entrypoint.sh` renders the template and starts nginx, so by the time the healthcheck first runs, the syntax is already known good; the only way it can fail is a config edited underneath a running container. This is the one service in the stack whose health is what an external monitor would actually poll, and it is the one that cannot fail.

**Fix:** Probe the running listener instead: `test: ["CMD-SHELL", "curl -fsk https://localhost/health || exit 1"]` (the `location /health` block at `conf.d/default.conf.template:66-70` returns 200 without touching an upstream, so this stays a liveness check rather than a dependency check). `curl` is already installed by `srcs/nginx/Dockerfile:8-12`, so no image change is needed; `-k` is required because the certificate is self-signed and regenerated on every boot.

**Verify:** `docker inspect --format '{{.State.Health.Status}}' ft_transcendence_nginx` reports `healthy` on a normal boot; then `docker exec ft_transcendence_nginx nginx -s stop` and confirm the status transitions to `unhealthy` within `interval × retries` — today it stays `healthy`.

**Effort:** S - **Risk:** a healthcheck that can fail will restart the container under `restart: on-failure` where it previously never did, so an upstream-independent endpoint must be used — do not point it at `/api`, which would make nginx unhealthy whenever the gateway is down. INFRA-04 proposes gating nginx on `api-gateway: service_healthy`; land these together so the ordering fix does not mask a genuinely broken edge.

<!-- item id=OLL-02 priority=P3 effort=S service=ollama -->
### OLL-02 - init.sh runs as PID 1 without signal forwarding, so ollama is always SIGKILLed

**Where:** `srcs/ollama/init.sh:4,19-20`, `docker-compose.yml:51` (`entrypoint: ["/workspace/init.sh"]`)

**Problem:** The entrypoint is the shell script itself, so `/bin/sh` is PID 1 and `ollama serve` is a background child. The kernel drops default-action signals for PID 1 when no handler is installed, so the SIGTERM from `docker stop` / `make down` is ignored, the stop blocks for the full 10s grace period, and every shutdown ends in SIGKILL — `ollama serve` never releases the GPU or flushes state cleanly. Derived from reading the script; reproduce by timing `docker compose stop ollama`.

**Fix:** Capture the server pid (`SERVE_PID=$!`), install `trap 'kill -TERM "$SERVE_PID" 2>/dev/null' TERM INT` before the pull loop, and end with `wait "$SERVE_PID"` followed by an explicit exit so the container actually stops. Alternative: do the pulls against a short-lived background server, then `exec /bin/ollama serve` as the last line so ollama becomes PID 1 itself.

**Verify:** ollama is `profiles: ["local"]`, so the profile has to be active for compose to resolve the service at all: `time COMPOSE_PROFILES=local docker compose stop ollama` returns in about a second instead of ~10s, and `docker logs ollama | tail` shows a shutdown log line rather than an abrupt cut. The container is named plain `ollama`, not `ft_transcendence_ollama` (see INFRA-05).

**Effort:** S - **Risk:** with a trap, `wait` returns as soon as the signal arrives — the script must exit afterwards or the container will linger until the grace timeout anyway. No test covers this script. Batching: OLL-01 rewrites the pull loop in the same 20-line `init.sh` and its "exec ollama serve as PID 1" alternative resolves this item outright — write the script once with both fixes in it. Neither ordering is forced.

<!-- item id=REC-09 priority=P3 effort=S service=recommendation-service -->
### REC-09 - Seed script depends on an undeclared PyYAML

**Where:** `srcs/recommendation-service/requirements.txt:3,12`, `srcs/recommendation-service/scripts/seed_products.py:9`

**Problem:** `seed_products.py` imports `yaml`, but PyYAML is not in `requirements.txt` — it resolves only transitively through `uvicorn[standard]`. Dropping the `[standard]` extra or a uvicorn bump that changes its extras breaks seeding with `ModuleNotFoundError` at image build time, not test time. `psycopg2-binary==2.9.9` is also listed but imported by nothing (the service is asyncpg-only), and pulls in the `libpq-dev`/`gcc` build deps in the Dockerfile.

**Fix:** Add an explicit `PyYAML==6.0.1` pin under a `# Seeding` section, and remove `psycopg2-binary` after confirming `grep -rn "psycopg2" srcs/recommendation-service/` is empty.

**Verify:** `docker compose build recommendation-service && docker compose run --rm recommendation-service python -c "import yaml; print(yaml.__version__)"` prints a version. The seed run needs the `db` hostname, so it must go through a running container rather than `run --rm`: `docker compose up -d recommendation-service && docker exec ft_transcendence_recommendation_service python scripts/seed_products.py` exits 0.

**Effort:** S - **Risk:** Removing `psycopg2-binary` could break `scripts/validate_env.py` if it uses a sync driver — check that first. Requires a rebuild, not just a restart.

<!-- item id=INFRA-04 priority=P3 effort=M service=repo -->
### INFRA-04 - Startup ordering is unmanaged: nginx, litellm, ai-service and recommendation-service wait for nothing

**Where:** `docker-compose.yml:3-23` (nginx), `:25-43` (litellm), `:45-77` (ollama), `:79-99` (ai-service), `:320-338` (recommendation-service)

**Problem:** Four services declare no usable `depends_on`. nginx `proxy_pass http://api-gateway:8001` (`srcs/nginx/conf.d/default.conf.template:81`) is a literal upstream resolved at config load, so nginx can crash-loop on `make up` until the gateway container exists. `litellm` does not wait for `ollama`, `ai-service` waits for nothing (its healthcheck only probes its own `/health`, so it reports healthy while litellm and classification are unreachable), and `recommendation-service` uses the short form `depends_on: [user-service]` with no `condition: service_healthy` and no dependency on `db` at all. Compounding this, `ollama` declares no healthcheck and `srcs/ollama/init.sh` uses a fixed `sleep 5` and then `wait`s regardless of whether `ollama pull` succeeded, so nothing can gate on the model actually being present.

**Fix:** Add a healthcheck to the `ollama` service (`test: ["CMD", "ollama", "list"]`, generous `start_period` to cover the model pull), then wire: `litellm` → `ollama: {condition: service_healthy, required: false}`; `ai-service` → `litellm` healthy (+ `classification-service` healthy, `required: false` so the cloud profile still starts); `recommendation-service` → `db` healthy and `user-service` healthy; `nginx` → `api-gateway` healthy. Use `required: false` on every profile-gated dependency so `cloud` does not break.

**Verify:** `COMPOSE_PROFILES=local docker compose down && make up COMPOSE_PROFILES=local && docker compose ps` shows no restart counter above 0 for nginx (the profile has to be set on `down` too, or the profile-gated containers are left running); `docker inspect --format '{{.State.Health.Status}}' ollama` reports `healthy` only after `docker exec ollama ollama list` lists `qwen3-vl:8b`; then `make up COMPOSE_PROFILES=cloud` still brings up ai-service with ollama and classification-service absent.

**Effort:** M - **Risk:** `required: false` needs Compose v2.20+; on older versions a profile-disabled dependency makes `up` fail outright. Making the ollama healthcheck strict lengthens first-boot time by the whole model download. The `init.sh` pull-failure handling is a separate fix in `srcs/ollama/`.

<!-- item id=INFRA-05 priority=P3 effort=S service=repo -->
### INFRA-05 - `make exec-<service>` builds a container name that never exists

**Where:** `Makefile:163-164`, `docker-compose.yml:47,83,105,179,203,287,324`

**Problem:** `exec-%` expands to `docker exec -it ft_transcendence_$*`, splicing the compose service name in verbatim. The containers are named with underscores (`ft_transcendence_api_gateway`, `ft_transcendence_ai_service`, `ft_transcendence_classification_service`, `ft_transcendence_auth_service`, `ft_transcendence_user_service`, `ft_transcendence_recommendation_service`), so every hyphenated service fails with "No such container". `make exec-ollama` fails for a different reason: that container is named plain `ollama`, breaking the `ft_transcendence_*` convention every other service follows. Only `nginx`, `litellm`, `redis` and `db` work.

**Fix:** Two options, pick one. (a) Stop deriving the name — make the target compose-native: `docker compose -f $(COMPOSE_FILE) exec $* /bin/sh`, which takes the service name and needs no mapping; also fixes `exec-ollama`. (b) Keep `docker exec` and translate: `docker exec -it $(PROJECT_NAME)_$(subst -,_,$*) /bin/sh`, and rename the ollama container to `ft_transcendence_ollama` (`docker-compose.yml:47`). Option (a) is smaller and self-maintaining.

**Verify:** `make exec-api-gateway` opens a shell; repeat for `ai-service`, `classification-service`, `auth-service`, `user-service`, `recommendation-service`, `ollama` — all must land in a shell rather than "No such container".

**Effort:** S - **Risk:** with option (a) the target now needs the compose project context (it will not attach to a container started outside compose). Renaming the ollama container (option b) invalidates any script or note that references `docker exec ollama ...`, including `srcs/ollama/README.md`.

<!-- item id=INFRA-06 priority=P3 effort=S service=repo -->
### INFRA-06 - The cleanup targets either do not exist or remove nothing

**Where:** `Makefile:22`, `Makefile:13-17`, `Makefile:130-154`, `Makefile:160`

**Problem:** `.PHONY` declares `clean`, `fclean`, `setup` and `test-coverage`, none of which has a recipe — `make clean` and `make fclean` die with "No rule to make target". The target that does exist, `purge` (and `ref: purge all`), is close to a no-op: `TRANSCENDENCE_SERVICES` lists a `backend` service that is not in this compose file and omits every application service (api-gateway, auth-service, user-service, ai-service, classification-service, litellm), `TRANSCENDENCE_NETWORKS` names `ft_transcendence_transcendence_network` while the real networks are `ft_transcendence_proxy` and `ft_transcendence_backend-network`, and the image removal uses untagged names (`ft_transcendence_nginx`) while the images are built as `ft_transcendence_nginx:local`. Every command is `|| true`, so `make ref` prints a full success banner while leaving all images and networks in place.

**Fix:** Delete `clean`, `fclean`, `setup` and `test-coverage` from `.PHONY` (or add real recipes), and rewrite `purge` on top of compose instead of hand-maintained name lists: `docker compose -f $(COMPOSE_FILE) --profile local --profile cloud down -v --remove-orphans --rmi local`, followed by the existing dangling-image prune. Then drop `TRANSCENDENCE_SERVICES`, `TRANSCENDENCE_VOLUMES` and `TRANSCENDENCE_NETWORKS`.

**Verify:** `make ref` then `docker images --filter reference='ft_transcendence_*' -q` prints nothing and `docker network ls --filter name=ft_transcendence -q` prints nothing; `make clean` either works or is no longer advertised by `make help`.

**Effort:** S - **Risk:** `--rmi local` also deletes images for services in the profile you are not running, so the next `make up` is a full rebuild. Confirm no CI job invokes `make clean`/`make fclean`.

<!-- item id=INFRA-07 priority=P3 effort=S service=repo -->
### INFRA-07 - `make migration` generates migrations at deploy time instead of applying the committed ones

**Where:** `scripts/run-migrations.sh:45,68`

**Problem:** The script runs `python manage.py makemigrations` inside `ft_transcendence_auth_service` and `ft_transcendence_user_service` before each `migrate`. Both containers bind-mount the whole service tree read-write (`docker-compose.yml:188,212`) and run as uid 1000, so any model change that has not been committed as a migration silently materialises a brand-new, unreviewed migration file in the working tree and is applied to `smartbreeds` on the spot. Two developers running `make migration` at different times can generate divergent migration files for the same model state. This is derived from reading the script, not from an observed failure — step 1 is to reproduce by editing a model field and running `make migration`.

**Fix:** Delete both `makemigrations` invocations; the script should only `migrate`. Migrations are authored deliberately and committed (`srcs/auth-service/apps/authentication/migrations/`, `srcs/user-service/apps/profiles/migrations/`). If a drift check is wanted, use `manage.py makemigrations --check --dry-run` and fail the script when it reports pending changes.

**Verify:** `git status --porcelain srcs/auth-service srcs/user-service` is clean after `make migration` on a fresh volume, and `docker exec ft_transcendence_auth_service python manage.py showmigrations authentication` lists both `0001_initial` and `0002_refreshtoken` as applied.

**Effort:** S - **Risk:** if any service currently relies on runtime generation to create a table (i.e. a model exists with no committed migration), `migrate` alone will leave that table missing; confirm with `manage.py makemigrations --check --dry-run` in both services before removing the calls.

<!-- item id=INFRA-08 priority=P3 effort=S service=repo -->
### INFRA-08 - Postgres credentials are configurable in three places and honoured in none

**Where:** `docker-compose.yml:250-259`, `scripts/run-migrations.sh:20,91,92`, `.env.example`

**Problem:** The db container takes its credentials from `srcs/db/.env` via `env_file`, but the healthcheck on line 259 interpolates `${POSTGRES_USER-smartbreeds_user}` / `${POSTGRES_DB-smartbreeds}`, which compose resolves from the root `.env`/shell — a different file that does not define them, so only the literal fallbacks ever apply. `scripts/run-migrations.sh` then hardcodes `-U smartbreeds_user -d smartbreeds` in its readiness probe and in both `psql` calls that apply the recommendation-service SQL. Changing the user or database name in `srcs/db/.env` therefore breaks `make migration` with an authentication error while the compose healthcheck keeps reporting green.

**Fix:** Make the root `.env` the single source: add `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` to `.env.example`, switch the `db` service from `env_file: ./srcs/db/.env` to `environment:` entries referencing `${POSTGRES_USER:?}` etc., and have `scripts/run-migrations.sh` load them (`set -a; . ./.env; set +a`) instead of hardcoding.

**Verify:** Change `POSTGRES_USER` to `sb_test` in the root `.env`, `make downv && make up && make migration` completes; `docker exec ft_transcendence_db psql -U sb_test -d smartbreeds -c '\dn'` lists the schemas.

**Effort:** S - **Risk:** the init SQL hardcodes `\c smartbreeds` and `AUTHORIZATION smartbreeds_user` (`srcs/db/init-scripts/01-init-schemas.sql:4,7-16`), so a renamed user or database still fails at first boot until that file is parameterised — that half of the fix is DB-01 and must land together with this one, or the verify below dies in the postgres entrypoint before the healthcheck is ever reached. Existing `db-data` volumes keep the old role; the change is only observable after `make downv`.

<!-- item id=INFRA-11 priority=P3 effort=S service=repo -->
### INFRA-11 - classification-service is the only application service with no restart policy

**Where:** `docker-compose.yml:101-131`

**Problem:** Every other service declares `restart: on-failure` or `unless-stopped`; classification-service declares none, so it defaults to `no`. Its lifespan loads three HuggingFace models on startup, which fails if the HF Hub is unreachable or the GPU is busy — and the container then stays dead. The AI service keeps calling it and returns 503s until someone notices, because nothing restarts it and nothing depends on its health (see INFRA-04).

**Fix:** Add `restart: unless-stopped` to the service, matching ai-service and litellm.

**Verify:** the service only exists in the `local` profile, so bring the stack up that way first: `make up COMPOSE_PROFILES=local`, then `docker kill ft_transcendence_classification_service && sleep 20 && docker inspect -f '{{.State.Status}}' ft_transcendence_classification_service` prints `running` (today: `exited`).

**Effort:** S - **Risk:** a genuinely broken model config now crash-loops instead of failing once; the loop is visible in `make logs-classification-service` and the model download is cached in the `huggingface-cache` volume, so restarts are cheap after the first success.

<!-- item id=USER-08 priority=P3 effort=M service=user-service -->
### USER-08 - Container runs Django's development server; no WSGI server is installed

**Where:** `srcs/user-service/Dockerfile:24`, `srcs/user-service/requirements.txt`, `srcs/user-service/config/asgi.py`

**Problem:** `CMD ["python", "manage.py", "runserver", "0.0.0.0:3002"]` and `requirements.txt` contains no gunicorn/uvicorn. `runserver` is explicitly not for production use: it auto-reloads on every file write (source is bind-mounted rw at `docker-compose.yml:212`), single process, no worker management, no request timeouts. `config/asgi.py` is dead — `WSGI_APPLICATION` (`config/settings.py:65`) points at `config.wsgi`.

**Fix:** Add `gunicorn==21.2.0` to `requirements.txt`, change the CMD to `gunicorn config.wsgi:application --bind 0.0.0.0:3002 --workers 3 --timeout 60`, rebuild. Keep hot reload for development by overriding `command:` in a compose override file rather than in the image. Delete `config/asgi.py` unless an ASGI server is planned.

**Verify:** `docker compose build user-service && docker compose up -d user-service && docker logs ft_transcendence_user_service | head` shows gunicorn workers booting, and `docker exec ft_transcendence_user_service curl -sf http://localhost:3002/health` returns the healthy envelope.

**Effort:** M - **Risk:** losing hot reload will surprise anyone relying on the rw bind mount; the compose healthcheck (`docker-compose.yml:216-221`) and `depends_on: db` gating must still pass. Requires a rebuild — no test covers the container CMD. auth-service already pins gunicorn without using it (AUTH-10): identical multi-stage split, identical compose `build.target` edit — batch the two so `docker-compose.yml` changes once.

---

## P4 - Cleanup and technical debt

_Dead code, unused dependencies, deprecated APIs, naming drift. Safe to batch._

<!-- item id=AI-11 priority=P4 effort=M service=ai-service -->
### AI-11 - "Ollama" naming survives everywhere despite the LiteLLM migration

**Where:** `srcs/ai/src/services/ollama_client.py` (file, class `OllamaVisionClient`, `:115`, `:372`, `:406`, `:409`), `srcs/ai/src/services/vision_orchestrator.py:15,28,113`, `srcs/ai/tests/test_ollama_client.py`, `srcs/ai/tests/test_ollama_contextual.py`

**Problem:** The client speaks OpenAI `chat/completions` to the LiteLLM proxy and never touches Ollama. On the `cloud` profile — where the `ollama` container does not exist at all (`profiles: ["local"]` in docker-compose.yml) — a Mistral outage logs `"Failed to connect to Ollama"` and raises `ConnectionError("Ollama service unavailable")`, sending whoever is on call to inspect a container that was never started.

**Fix:** Rename `src/services/ollama_client.py` → `llm_client.py`, `OllamaVisionClient` → `LLMVisionClient`, the orchestrator attribute `self.ollama` → `self.llm`, and the error strings to name the proxy (`"LLM proxy unavailable at {base_url}"`). Rename the two test files to `test_llm_client.py` / `test_llm_contextual.py`, update the import at `src/main.py:9`, and rename the injected constructor parameter and attribute in `RAGService` (`src/services/rag_service.py:33,43` — it takes the client by injection, it does not import it) plus its use at `rag_service.py:90`.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/ -v` (104 tests) plus `grep -rin ollama /home/crea/project/ft_transcendence/srcs/ai/src` returning only intentional references to the local backend.

**Effort:** M - **Risk:** `tests/test_ollama_contextual.py:220,236` assert on the literal strings `"Ollama service unavailable"` / `"Ollama service timeout"` and will fail until updated in the same commit. Batching: AI-03 (the missing `HTTPStatusError` branch), AI-09 (the three hardcoded thresholds at `:31-33`) and AI-14 (`LOW_CONFIDENCE_THRESHOLD` at `:105`) all edit `ollama_client.py`; this item renames the file out from under them, so land it last of the four or the other three produce conflicts against a path that no longer exists.

**Depends on:** AI-03

<!-- item id=AI-12 priority=P4 effort=S service=ai-service -->
### AI-12 - Vision endpoint emits deprecated naive timestamps; RAG endpoints emit aware ones

**Where:** `srcs/ai/src/routes/vision.py:53,79,95,111` vs `srcs/ai/src/utils/responses.py:17,39`

**Problem:** The vision route builds its envelope inline with `datetime.utcnow().isoformat()` — deprecated on the image's Python 3.12 (`Dockerfile:1`) and producing a naive string with no offset — while every RAG route goes through `utils/responses.py`, which uses `datetime.now(UTC)` and emits `+00:00`. Two endpoint families on the same service return two different timestamp formats in what is documented as one standard envelope.

**Fix:** Replace the four `datetime.utcnow()` calls with `success_response(...)` / `error_response(...)` from `src/utils/responses.py`, or at minimum with `datetime.now(UTC).isoformat()`.

**Verify:** `docker exec ft_transcendence_ai_service curl -s http://localhost:3003/api/v1/rag/status | python -c "import sys,json;print(json.load(sys.stdin)['timestamp'])"` and the equivalent on a failing `/api/v1/vision/analyze` — both must end in `+00:00`.

**Effort:** S - **Risk:** `VisionAnalysisResponse` in `src/models/responses.py` may type `timestamp` as `str`; check before switching to the helper, which returns a full dict. Covered by `tests/test_response_models.py`.

<!-- item id=AI-13 priority=P4 effort=S service=ai-service -->
### AI-13 - Dead request models shadowed by the route's own definition

**Where:** `srcs/ai/src/models/requests.py:5-23`, `srcs/ai/src/routes/vision.py:14-16`

**Problem:** `VisionAnalysisRequest` and `VisionAnalysisOptions` in `src/models/requests.py` are imported by nothing — `routes/vision.py` defines its own single-field `VisionAnalysisRequest`. The dead version carries a `field_validator` rejecting non-data-URI images and an `options` object (`return_traits`, `return_health_info`, `enrich`) that no code path reads, so anyone reading the models file believes those flags work.

**Fix:** Delete both classes, or move the `data:image/` `field_validator` onto the route's model and delete only `VisionAnalysisOptions`. Do not wire up the options flags unless the feature is actually wanted.

**Verify:** `grep -rn "VisionAnalysisOptions\|models.requests import" /home/crea/project/ft_transcendence/srcs/ai/src /home/crea/project/ft_transcendence/srcs/ai/tests` returns only `RAGQueryRequest`/`RAGIngestRequest` imports; then `docker compose run --rm ai-service python -m pytest tests/ -v`.

**Effort:** S - **Risk:** if the validator is moved to the route, malformed input starts failing at 422 pydantic validation rather than inside `ImageProcessor`, changing the error body shape.

<!-- item id=AI-14 priority=P4 effort=S service=ai-service -->
### AI-14 - Dead configuration settings

**Where:** `srcs/ai/src/config.py:9,33,51`, `srcs/ai/.env.example:22,28`

**Problem:** `RAG_MIN_RELEVANCE` (config.py:51) and `DEBUG` (config.py:9) are read nowhere in `src/` — `grep -rn "RAG_MIN_RELEVANCE\|\.DEBUG" src/` returns only the declarations. `DEBUG` is additionally advertised in `.env.example:28` (and set in `.env`), so an operator can flip it and see no change; `RAG_MIN_RELEVANCE` is absent from `.env.example` but still settable as an env var because pydantic-settings reads the environment. `LOW_CONFIDENCE_THRESHOLD` (config.py:33, `.env.example:22`) is only consumed by `ollama_client.py:105`, on the `analyze_breed(detect_crossbreed=False)` branch that neither pipeline ever takes. Note `RAG_TOP_K` (config.py:50) *is* live (`rag_service.py:69`) — do not sweep it up with the others.

**Fix:** Either implement the relevance filter in `RAGService._build_sources` (drop sources below `RAG_MIN_RELEVANCE`) or delete the setting. Same call for `DEBUG`, whose `.env.example:28` line goes with it. Leave `LOW_CONFIDENCE_THRESHOLD` only if the non-crossbreed branch is kept.

**Verify:** `grep -rn "RAG_MIN_RELEVANCE\|settings.DEBUG\|config.DEBUG" /home/crea/project/ft_transcendence/srcs/ai/src` returns either a real use site or nothing at all.

**Effort:** S - **Risk:** implementing the relevance filter changes RAG answers; `tests/test_rag_service.py` builds ChromaDB result dicts with fixed `distances` and will need thresholds that keep those fixtures passing.

<!-- item id=AI-15 priority=P4 effort=S service=ai-service -->
### AI-15 - `detect_species(top_k=...)` is never passed by the orchestrator

**Where:** `srcs/ai/src/services/classification_client.py:51`, `srcs/ai/src/services/vision_orchestrator.py:69`

**Problem:** `ClassificationClient.detect_species` accepts `top_k: int = 3` and forwards it in the request body, but the only caller omits it, so the parameter is dead on the production path and the default silently governs. Meanwhile `detect_breed` is called with an explicit `top_k=5` — inconsistent, and it hides the fact that species `top_predictions` length is not tunable.

**Fix:** Either pass an explicit value from config (see AI-09) or drop the parameter from `detect_species` and let the classification service default apply.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/test_classification_client.py tests/test_vision_orchestrator.py -v`.

**Effort:** S - **Risk:** the classification service may require `top_k` in its request schema; check `srcs/classification-service` before removing it from the payload.

**Depends on:** AI-09

<!-- item id=AI-16 priority=P4 effort=S service=ai-service -->
### AI-16 - Route test leaks module globals and makes the suite order-dependent

**Where:** `srcs/ai/tests/test_rag_routes.py:215-229`

**Problem:** `test_initialize_service_not_initialized` sets `rag.rag_service = None` and `rag.document_processor = None` and never restores them. It only passes because later tests' fixtures happen to reassign the globals; running that test last, or with `-p no:randomly` removed / `-k` filtering, leaves the module in a broken state for anything that follows.

**Fix:** Move the reset into a fixture with teardown (`yield` then restore the previous values), or use `monkeypatch.setattr(rag, "rag_service", None)` so pytest undoes it automatically.

**Verify:** `docker compose run --rm ai-service python -m pytest tests/test_rag_routes.py -v -k "not_initialized or status"` in that order passes, and so does the reverse order.

**Effort:** S - **Risk:** none; isolated to the test file.

<!-- item id=AI-17 priority=P4 effort=S service=ai-service -->
### AI-17 - Knowledge base directory is misspelled `spiecies`

**Where:** `srcs/ai/data/knowledge_base/spiecies/`, `docker-compose.yml:91`

**Problem:** The on-disk directory holding all 34 knowledge-base markdown files is spelled `spiecies`. It is load-bearing only through the read-only volume mount, since the ingest walks `kb_dir.rglob("*.md")` and does not care about the directory name — but the typo propagates into every `source_file` metadata value stored in ChromaDB and into every document that describes the layout.

**Fix:** `git mv srcs/ai/data/knowledge_base/spiecies srcs/ai/data/knowledge_base/species`. The compose mount at `docker-compose.yml:91` mounts the parent `knowledge_base` directory, so no compose change is strictly required — confirm before merging. Re-run `make rag` afterwards so stored `source_file` metadata is regenerated (see AI-06 about re-ingest duplication).

**Verify:** `docker exec ft_transcendence_ai_service ls /app/data/knowledge_base` shows `species`, then `make rag` reports the same `files_processed` count as before the rename.

**Effort:** S - **Risk:** any external script or notebook referencing the old path breaks; re-ingesting without AI-06 duplicates the collection.

**Depends on:** AI-06

<!-- item id=GW-13 priority=P4 effort=S service=api-gateway -->
### GW-13 - success_response() is dead and the error envelope is hand-rebuilt in five places

**Where:** `srcs/api-gateway/utils/responses.py:18-25`, `srcs/api-gateway/routes/proxy.py:189,210,227`, `srcs/api-gateway/middleware/auth_middleware.py:73-85`, `srcs/api-gateway/middleware/rate_limit.py:81-95`

**Problem:** Nothing imports `success_response` — a grep across the service returns only its definition. Meanwhile the identical error envelope is retyped as a dict literal in the proxy's three HTML-normalisation branches (where the local variable is even named `error_response`, which would shadow the helper if it were ever imported) and in both middlewares. The five copies happen to agree today; there is nothing keeping them in sync.

**Fix:** Import `utils.responses.error_response` in `auth_middleware.py`, `rate_limit.py` and `proxy.py`, replace the five literals (renaming the shadowing local), and either adopt `success_response` for the `/health` payload or delete it.

**Verify:** `docker compose run --rm --no-deps api-gateway python -m pytest tests/ -v`, then confirm shapes still match: `curl -s http://localhost:8001/api/v1/users/me | jq 'keys'` (401 path) and `curl -s -b cookies.txt http://localhost:8001/api/v1/nonexist | jq 'keys'` both → `["data","error","success","timestamp"]`.

**Effort:** S - **Risk:** `tests/test_rate_limit.py:45` (`test_rate_limit_response_structure`) and `tests/test_error_handling.py` assert on the envelope shape and will catch drift. Do GW-05 first or the middleware timestamps regress to the frozen class default.

**Depends on:** GW-05

<!-- item id=GW-14 priority=P4 effort=S service=api-gateway -->
### GW-14 - requirements.txt: duplicate httpx, unused PyJWT, test deps in the runtime image

**Where:** `srcs/api-gateway/requirements.txt:6,7,9,10,11,13`

**Problem:** `httpx==0.28.0` appears twice (lines 7 and 11). `PyJWT==2.10.0` is installed but nothing imports it — every JWT call site uses `python-jose` (`auth/jwt_utils.py:2` and all six test modules). `requests==2.31.0` is imported nowhere. `pytest` and `pytest-asyncio` ship inside the production image. Two JWT libraries in one image invite the next contributor to pick the wrong one.

**Fix:** Delete the duplicate `httpx` line, delete `PyJWT` and `requests`. Keep `pytest`/`pytest-asyncio` only if the documented `docker compose run --rm api-gateway pytest` workflow stays on the same image; otherwise split them into `requirements-dev.txt` installed in a separate build stage. Note `pytest-cov` is not installed at all today, which is why the documented coverage command requires an on-the-fly `pip install`.

**Verify:** `docker compose build api-gateway && docker compose run --rm --no-deps api-gateway python -m pytest tests/ -q` passes, and `docker exec ft_transcendence_api_gateway python -c "import jwt"` → `ModuleNotFoundError`.

**Effort:** S - **Risk:** removing pytest from the runtime image breaks `scripts/run-unit-tests.sh --gateway` and the CLAUDE.md test commands; only do the split if you update the runner in the same change.

<!-- item id=AUTH-11 priority=P4 effort=S service=auth-service -->
### AUTH-11 - Deprecated `datetime.utcnow()` and inconsistent timestamp suffixes

**Where:** `srcs/auth-service/apps/authentication/utils.py:81,105`, `srcs/auth-service/apps/authentication/middleware.py:36`

**Problem:** `success_response`/`error_response` emit `datetime.utcnow().isoformat() + 'Z'` while `Custom404Middleware` emits `datetime.utcnow().isoformat()` with no suffix, so a 404 body and every other body in the same service carry differently-formatted timestamps. `datetime.utcnow()` is deprecated from Python 3.12 (the image is still 3.11) and produces a naive datetime that is then mislabelled as UTC by the manual `'Z'`.

**Fix:** Replace all three call sites with `datetime.now(timezone.utc).isoformat()` (`from datetime import timezone`), dropping the manual `'Z'` — the aware isoformat already carries `+00:00`.

**Verify:** `grep -rn "utcnow" srcs/auth-service/apps/` returns nothing, and `curl -s http://localhost:8001/api/v1/auth/nonexistent -X POST | python -c "import sys,json; print(json.load(sys.stdin)['timestamp'])"` matches the format returned by a successful `/api/v1/auth/verify` call.

**Effort:** S - **Risk:** any consumer parsing the trailing `Z` literally sees a format change. The same divergence exists in `srcs/api-gateway/utils/responses.py:16` and `srcs/recommendation-service/src/utils/responses.py:9`; unify on `datetime.now(timezone.utc)` across all three or the inconsistency just moves. `srcs/auth-service/tests/test_views.py` asserts on response bodies but not on the timestamp format.

<!-- item id=AUTH-12 priority=P4 effort=S service=auth-service -->
### AUTH-12 - `last_login` is never written

**Where:** `srcs/auth-service/apps/authentication/views.py:74-87`, `srcs/auth-service/apps/authentication/migrations/0001_initial.py:18`

**Problem:** The `last_login` column inherited from `AbstractBaseUser` exists in the table but no code path writes it — `LoginView` authenticates by hand and never calls `django.contrib.auth.login()` or fires the `user_logged_in` signal. The column is permanently null, so there is no way to tell an active account from a dormant one.

**Fix:** In `LoginView.post`, after the password check succeeds, set `user.last_login = timezone.now(); user.save(update_fields=['last_login'])` (or call `django.contrib.auth.models.update_last_login(None, user)`), before issuing tokens.

**Verify:** `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "select email, last_login from auth_schema.users order by created_at desc limit 3"` shows a non-null value after a login through `http://localhost:8001/api/v1/auth/login`.

**Effort:** S - **Risk:** adds a write to the login hot path. `srcs/auth-service/tests/test_views.py::TestLoginView` covers login; add an assertion there.

<!-- item id=AUTH-13 priority=P4 effort=S service=auth-service -->
### AUTH-13 - Unused test dependencies pinned and installed

**Where:** `srcs/auth-service/requirements-dev.txt:4-5`

**Problem:** `factory-boy==3.3.0` and `freezegun==1.4.0` are installed into the image but referenced by no test — `grep -rn "freezegun\|factory" srcs/auth-service/tests/` returns nothing. Expired-token tests hand-roll `jwt.encode` with a past `exp` instead of freezing time, and fixtures are plain module-level functions in `test_views.py`.

**Fix:** Either delete both pins, or actually use `freezegun` for the token-expiry tests (which currently depend on hand-built JWTs that bypass `generate_access_token`). Pick one; leaving them installed and unused is the only wrong answer.

**Verify:** `docker compose build auth-service && docker compose run --rm auth-service python -m pytest tests/ -v` still reports 102 passing, and `docker compose run --rm auth-service pip show freezegun` reflects the choice.

**Effort:** S - **Risk:** none beyond an image rebuild; `srcs/auth-service/tests/` is unaffected either way.

<!-- item id=AUTH-14 priority=P4 effort=S service=auth-service -->
### AUTH-14 - `PORT` in `.env.example` is read by nothing

**Where:** `srcs/auth-service/.env.example:29`, `srcs/auth-service/Dockerfile:36,39`

**Problem:** `.env.example` advertises `PORT=3001` as configurable, but no Python code reads it (`config/settings.py:71` reads `DB_PORT` only) — the listen port is hardcoded in `EXPOSE 3001` and `runserver 0.0.0.0:3001`. Changing `PORT` in an env file has no effect, which is a trap for anyone trying to move the service.

**Fix:** Delete the `PORT` entry from `.env.example` and `.env`, or make it real by using `${PORT:-3001}` in the Dockerfile `CMD` (which requires shell form) and in the compose healthcheck. Deleting is the honest, smaller change given the port is also hardcoded in the gateway's `AUTH_SERVICE_URL` and in the compose healthcheck.

**Verify:** `grep -rn "PORT" srcs/auth-service --include=*.py --include=Dockerfile --include=.env.example` shows only `DB_PORT` and the intentional hardcoded 3001.

**Effort:** S - **Risk:** none; no code reads the value today.

<!-- item id=CLS-06 priority=P4 effort=S service=classification-service -->
### CLS-06 - Two dead confidence thresholds advertise a tuning knob that does nothing

**Where:** `srcs/classification-service/src/config.py:22-23`, `srcs/classification-service/.env.example:14-15`

**Problem:** `SPECIES_MIN_CONFIDENCE=0.60` and `BREED_MIN_CONFIDENCE=0.40` are declared in `Settings` and shipped in `.env.example`, but nothing in `src/` reads them (`grep -rn "settings\." src/` returns only the NSFW threshold, log level, model ids, device and service name). The thresholds that actually reject results are the identically named ones in `srcs/ai/src/config.py:34-35` (0.10 / 0.05), read at `vision_orchestrator.py:73,85`. An operator tuning the classification-service values gets no behaviour change and the two files disagree by an order of magnitude, which makes the real gate hard to find.

**Fix:** Delete both fields from `src/config.py` and both lines from `.env.example` and `.env`. The gate stays where it is enforced, in the AI Service.

**Verify:** `COMPOSE_PROFILES=local docker compose build classification-service && COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/ -v` (28 tests) plus `docker exec ft_transcendence_classification_service python -c "from src.config import settings; print(hasattr(settings,'SPECIES_MIN_CONFIDENCE'))"` → `False`.

**Effort:** S - **Risk:** none in this service. Pydantic Settings ignores unknown env vars, so a stale `SPECIES_MIN_CONFIDENCE` line left in someone's `.env` will not break startup. Do not touch the AI Service copies — they are live.

<!-- item id=CLS-07 priority=P4 effort=S service=classification-service -->
### CLS-07 - TRANSFORMERS_CACHE is a deprecated HuggingFace variable

**Where:** `srcs/classification-service/src/config.py:32`, `srcs/classification-service/.env.example:24`

**Problem:** `TRANSFORMERS_CACHE` and `HF_HOME` are both set to the same path. `transformers==4.46.3` deprecated `TRANSFORMERS_CACHE` in favour of `HF_HOME` and emits a `FutureWarning` on every container start, adding noise to the startup logs of a service whose startup is already the slow, log-watched path. Identified from config and the pinned transformers version, not from a captured warning.

**Fix:** Drop the `TRANSFORMERS_CACHE` field from `Settings` and the line from `.env.example`/`.env`, keeping only `HF_HOME`. The duplicate `TRANSFORMERS_CACHE` in the compose `environment:` block (`docker-compose.yml:120`) is INFRA-12 and must be removed in the same pass — dropping the field from `Settings` alone leaves the variable set in the container, so the `FutureWarning` this item exists to silence keeps firing and the verify below still fails.

**Verify:** `COMPOSE_PROFILES=local docker compose up -d classification-service && COMPOSE_PROFILES=local docker compose logs classification-service | grep -i "TRANSFORMERS_CACHE"` returns nothing, and `docker exec ft_transcendence_classification_service ls /app/.cache/huggingface` still shows the populated model cache (proving `HF_HOME` alone resolves it).

**Effort:** S - **Risk:** if the cache path resolution regresses, the next start re-downloads several GB of weights into a fresh directory; check the `huggingface-cache` volume is still being hit before and after. No test covers cache location.

<!-- item id=CLS-08 priority=P4 effort=M service=classification-service -->
### CLS-08 - Multi-GB torchvision dependency exists only for a test-only helper

**Where:** `srcs/classification-service/src/services/image_utils.py:4-5,49-69`, `srcs/classification-service/Dockerfile:17-20`

**Problem:** `from torchvision import transforms` at module scope makes torchvision a hard runtime import for the whole service, but its only consumer is `ImageUtils.preprocess_for_model`, which is called from `tests/test_image_utils.py:56` and nowhere in production (`grep -rn preprocess_for_model srcs/` confirms). Every model in this service preprocesses through its own HuggingFace `AutoProcessor`. The image carries hundreds of MB of wheel for dead code, and the torch/torchvision version pin has already broken the build once (see the Dockerfile comment).

**Fix:** Step 1, reproduce the dependency: build a variant image without the `torchvision==0.26.0+cu128` install and run the suite — `transformers` may pull it in for fast image processors, so confirm before committing. If it is genuinely unused, delete `preprocess_for_model` and its `torchvision`/`Tuple` imports, delete the corresponding test in `tests/test_image_utils.py`, and drop `torchvision` from the `pip3 install` line in `Dockerfile:17-20`.

**Verify:** `COMPOSE_PROFILES=local docker compose build classification-service && COMPOSE_PROFILES=local docker compose run --rm classification-service python -c "import torchvision"` fails with `ModuleNotFoundError`, while `COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/ -v` still passes (28 tests minus the removed one) and `docker image ls | grep classification` shows the smaller image.

**Effort:** M - **Risk:** `transformers` selects torchvision-backed fast image processors for some checkpoints; if any of the four configured models does, `AutoImageProcessor.from_pretrained` degrades or fails at startup. `tests/test_nsfw_detector.py`, `tests/test_species_classifier.py` and `tests/test_breed_classifier.py` load all real models on CPU and are the gate for this — run them before merging.

<!-- item id=DB-03 priority=P4 effort=S service=db -->
### DB-03 - Init script creates an unused `ai_schema` and duplicates `recommendation_schema`

**Where:** `srcs/db/init-scripts/01-init-schemas.sql:12-13,16,21-22,25`, `srcs/recommendation-service/migrations/001_create_schema.sql:2`

**Problem:** `ai_schema` is created, granted and pushed onto the role's `search_path` on every fresh database, but nothing references it — grep over `srcs/` finds hits only in the init script and the db README; the AI service has no models, no migrations and no PostgreSQL client. `recommendation_schema` is created in two places with different privilege sets (init script: `AUTHORIZATION` + `GRANT ALL`; migration `001`: `USAGE` + default privileges), so which grants apply depends on execution order.

**Fix:** Delete the `ai_schema` CREATE and GRANT lines and remove it from the `ALTER ROLE ... SET search_path` list. Pick one owner for `recommendation_schema`: keep the `CREATE SCHEMA` in `migrations/001_create_schema.sql` (matching the per-service pattern) and drop it from the init script, or the reverse — but define its grants once.

**Verify:** `make downv && make up`, then `docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c '\dn'` shows exactly `auth_schema`, `user_schema`, `recommendation_schema`; `docker compose run --rm recommendation-service python -m pytest tests/unit/ -v` and `docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v` still pass.

**Effort:** S - **Risk:** shortening the role `search_path` is safe only because every consumer qualifies explicitly — auth (`settings.py:73`), user (`settings.py:77`), recommendation (`src/models/*.py` `{"schema": "recommendation_schema"}`); verified, but re-check before merging if a new service is added. Batching: DB-01 rewrites the same `ALTER ROLE ... SET search_path` and `GRANT` lines in `01-init-schemas.sql` — do both in one edit pass and run the two `make downv` verifies once. There is no ordering constraint between them; either can go first.

<!-- item id=NGX-09 priority=P4 effort=S service=nginx -->
### NGX-09 - 404.html is shipped into the image but nothing references it, and it is a 13-byte stub

**Where:** `srcs/nginx/Dockerfile:24`, `srcs/nginx/error_pages/404.html`, `srcs/nginx/conf.d/default.conf.template:52-63`

**Problem:** `COPY error_pages/` puts `404.html` in the image, but the server block only declares `error_page 500 502 503 504 /50x.html` and `error_page 429 /429.html`. There is no `error_page 404` directive, so 404s fall through to nginx's built-in page. The file itself contains only the literal text `404 Not Found` (13 bytes), unlike the styled 429/50x pages.

**Fix:** Either add `error_page 404 /404.html;` plus a `location = /404.html { root /usr/share/nginx/html/error_pages; internal; }` and flesh the page out to match `429.html`, or delete `error_pages/404.html`. Note `location = /50x.html` (line 54) is missing `internal;` that `429.html` has, so `/50x.html` is directly fetchable — add it while in there.

**Verify:** `curl -sk https://localhost:8443/definitely-not-a-route` returns the project's 404 body (or, if deleted, `docker exec ft_transcendence_nginx ls /usr/share/nginx/html/error_pages` no longer lists 404.html). `curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:8443/50x.html` returns 404 once `internal;` is added.

**Effort:** S - **Risk:** none.

<!-- item id=NGX-10 priority=P4 effort=S service=nginx -->
### NGX-10 - Generated certificate carries an invalid country code

**Where:** `srcs/nginx/docker-entrypoint.sh:23`

**Problem:** The `openssl req -subj` string is `/C=IY/ST=State/L=City/O=42/CN=${HOST_DOMAIN}`. `IY` is not an ISO 3166-1 alpha-2 country code (the intent, per the committed cert being replaced, was `IT`). OpenSSL accepts any two characters, so this is cosmetic, but it shows up in every browser certificate inspector and in any tooling that validates the subject.

**Fix:** Change `IY` to `IT`.

**Verify:** `docker compose up nginx -d --force-recreate && docker exec ft_transcendence_nginx openssl x509 -in /etc/nginx/ssl/selfsigned.crt -noout -subject` shows `C = IT`.

**Effort:** S - **Risk:** none. Browsers that already trusted the previous self-signed cert will prompt again, which they do on every restart anyway since the cert is regenerated each boot.

<!-- item id=NGX-11 priority=P4 effort=S service=nginx -->
### NGX-11 - Platform description hardcoded as a JSON string inside the nginx config

**Where:** `srcs/nginx/conf.d/default.conf.template:131-136`

**Problem:** `location /` returns a literal JSON blob describing the platform (`"message":"SmartBreeds API Gateway"`, `"note":"Frontend not yet implemented - use direct API calls"`). Product copy baked into infrastructure config goes stale silently and has no owner; the `api_endpoint` field also advertises `https://${HOST_DOMAIN}/api` with no port, which is unreachable under the current `8443:443` mapping (see NGX-07).

**Fix:** Reduce the response to something that cannot go stale — `return 204;` or a minimal `{"status":"ok"}` — and drop the descriptive fields. The commented-out frontend `location /` block directly above (lines 110-129) is the intended replacement and already carries its own CSP.

**Verify:** `curl -sk https://localhost:8443/` returns the reduced body, and `curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:8443/api/v1/auth/login -X POST` still reaches the gateway.

**Effort:** S - **Risk:** anything scripted against the current JSON body breaks; `grep -rn 'SmartBreeds API Gateway' srcs/ scripts/` returns only this line.

<!-- item id=REC-11 priority=P4 effort=S service=recommendation-service -->
### REC-11 - Feature index 10 is reserved-and-zero yet carries a full health weight

**Where:** `srcs/recommendation-service/src/services/feature_engineering.py:54,133`, `srcs/recommendation-service/src/config.py:33`

**Problem:** Index 10 is hard-zeroed on both the pet and the product side but is assigned the full `WEIGHT_HEALTH_CONDITIONS` in `WEIGHT_VECTOR`. Harmless today (0 × w = 0 in both the dot product and the norms), but the moment anyone populates that slot it silently gets the heaviest weight in the model.

**Fix:** Either shrink the vectors to 14 dimensions and drop the slot from both extractors, `WEIGHT_VECTOR` and the docstrings, or set `WEIGHT_VECTOR[10] = 0.0` with a comment tying it to the reserved slot. The second is a one-line, zero-behaviour-change fix.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/test_config.py tests/unit/test_feature_engineering.py -v`.

**Effort:** S - **Risk:** `tests/unit/test_config.py:19-27` asserts `len(WEIGHT_VECTOR) == 15` and slices `[4:11]` as the health block — both break if you resize the vector.

<!-- item id=REC-12 priority=P4 effort=M service=recommendation-service -->
### REC-12 - Product schema fields are written out three times

**Where:** `srcs/recommendation-service/src/schemas/products.py:7-123`

**Problem:** `ProductCreate`, `ProductUpdate` and `ProductResponse` repeat the same ~28 field declarations with no shared base. Adding one product column means five coordinated edits (migration, ORM model, three schemas) and any missed one silently drops the field from an API surface.

**Fix:** Extract a `ProductBase(BaseModel)` holding the shared fields with their validators; `ProductCreate(ProductBase)` keeps `name`/`brand`/`target_species` required, `ProductUpdate` derives all-optional fields (or declares only the fields that legitimately differ), `ProductResponse(ProductBase)` adds `id`/`is_active` and the ORM config.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/ -v` then `docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/test_admin_e2e.py -v` — the create/update round-trips there assert every field survives.

**Effort:** M - **Risk:** `ProductUpdate` relies on `exclude_unset=True` at `routes/admin.py:115`; if the refactor makes fields default-valued rather than unset, partial updates start overwriting columns with `None`. `tests/integration/test_admin_e2e.py` covers partial update.

<!-- item id=REC-13 priority=P4 effort=S service=recommendation-service -->
### REC-13 - `src/middleware/` is an empty dead package

**Where:** `srcs/recommendation-service/src/middleware/__init__.py`

**Problem:** The directory contains a single 0-byte `__init__.py` and nothing imports it. The service registers no middleware at all (`src/main.py` has no `add_middleware` call), so the package advertises a layer that does not exist.

**Fix:** `git rm -r srcs/recommendation-service/src/middleware/`.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/ -v` and `docker exec ft_transcendence_recommendation_service curl -sf http://localhost:3005/health`.

**Effort:** S - **Risk:** None; `grep -rn "src.middleware" srcs/recommendation-service/` returns nothing.

<!-- item id=REC-14 priority=P4 effort=M service=recommendation-service -->
### REC-14 - Pydantic v1 and SQLAlchemy 1.x APIs on v2 dependencies

**Where:** `srcs/recommendation-service/src/routes/admin.py:26,32,59,87,115,121`, `srcs/recommendation-service/src/routes/recommendations.py:94,171`, `srcs/recommendation-service/src/schemas/products.py:122`, `srcs/recommendation-service/src/schemas/recommendations.py:17`, `srcs/recommendation-service/src/utils/database.py:2,6`

**Problem:** On pydantic 2.6.1 the service still uses `.dict()`, `from_orm()` and `class Config`, each emitting a `PydanticDeprecatedSince20` warning on every request; they are scheduled for removal in pydantic 3. `src/utils/database.py` builds the session factory with `sqlalchemy.orm.sessionmaker(class_=AsyncSession)` instead of `async_sessionmaker`, the supported SQLAlchemy 2.0 construct.

**Fix:** Mechanical: `.dict()` → `.model_dump()`, `.from_orm(x)` → `.model_validate(x)`, `class Config: from_attributes = True` → `model_config = ConfigDict(from_attributes=True)`, and `from sqlalchemy.ext.asyncio import async_sessionmaker` with `AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)`. Do it in one pass so the codebase stays internally consistent.

**Verify:** `docker compose run --rm recommendation-service python -m pytest tests/unit/ -W error::DeprecationWarning -v`, then `docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v`.

**Effort:** M - **Risk:** `model_dump()` returns `Decimal`/`datetime` objects exactly as `.dict()` did, so the FastAPI JSON encoding is unchanged — but `tests/integration/test_admin_e2e.py` is the surface that proves it.

**Depends on:** REC-12

<!-- item id=INFRA-09 priority=P4 effort=S service=repo -->
### INFRA-09 - The unit-test runner prints invented test counts

**Where:** `scripts/run-unit-tests.sh:86-100,107-129`

**Problem:** `run_test_suite` takes an `expected_tests` literal (`:107-129`) and prints `✓ <service> tests passed (<n> tests)` plus a grand total built from those literals — the numbers are never read from pytest, so the summary is fiction the moment a test is added or removed. Three of the six have already drifted: api-gateway 28 (30 collected), ai-service 37 (104), recommendation-service 42 (48 in `tests/unit/`, which is all the runner invokes). The other three happen to still be right — auth-service 102, user-service 91, classification-service 28 — which is what makes the literals look trustworthy. Anyone using `make test` output as a regression signal is reading a constant.

**Fix:** Drop the third argument entirely. Either print only pass/fail per suite, or capture pytest's own summary line — e.g. run with `--json-report` or grep the tail of the captured output for `N passed` and sum that.

**Verify:** `./scripts/run-unit-tests.sh --gateway` prints the same number that `docker compose run --rm api-gateway python -m pytest tests/ -q` reports as `N passed`.

**Effort:** S - **Risk:** none beyond the script; `scripts/init-and-test.sh:68` only checks its exit status, not its stdout.

<!-- item id=INFRA-12 priority=P4 effort=S service=repo -->
### INFRA-12 - docker-compose hygiene: deprecated env var, dead volumes, unused mounts, stale comment

**Where:** `docker-compose.yml:109`, `:120`, `:66`, `:359-362`

**Problem:** Four small pieces of drift in one file. Line 120 sets `TRANSFORMERS_CACHE`, deprecated by HuggingFace in favour of `HF_HOME` which is already set on line 121 — every classification-service start logs a deprecation warning. Line 66 mounts the `models` named volume at `/models`, which nothing in the ollama image or `srcs/ollama/init.sh` reads; the only reference to `/models` is the commented-out open-webui block. The `open-webui` volume (line 361) is declared for a service that is entirely commented out. Line 109 still describes the classification-service GPU stack as "PyTorch 2.11 nightly + CUDA 12.8" while `srcs/classification-service/Dockerfile:14-20` pins stable `torch==2.11.0+cu128` / `torchvision==0.26.0+cu128`, contradicting the Dockerfile's own comment explaining why the nightlies were abandoned.

**Fix:** Remove the `TRANSFORMERS_CACHE` line, the `models:/models` mount and the `models` and `open-webui` volume declarations; update the line 109 comment to name the stable pin.

**Verify:** `COMPOSE_PROFILES=local docker compose config -q` succeeds (the `models` mount and classification-service only exist in that profile, so a bare `docker compose config` would not show the lines you edited); `make up COMPOSE_PROFILES=local && docker logs ft_transcendence_classification_service 2>&1 | grep -c TRANSFORMERS_CACHE` returns 0; `docker volume ls --filter name=ft_transcendence | grep -E 'models|open-webui'` prints nothing after `make downv`.

**Effort:** S - **Risk:** if anyone re-enables the commented open-webui block they must re-add its volume; removing a named volume declaration does not delete an existing volume, so `docker volume rm ft_transcendence_models` is needed to reclaim the space. Batching: INFRA-02 (drop ollama's published port), INFRA-04 (depends_on + ollama healthcheck), INFRA-10 (edge ports) and INFRA-11 (restart policy) all edit `docker-compose.yml`, as does NGX-12 (nginx healthcheck) and the `build.target` line AUTH-10/USER-08 need — take the file once. CLS-07 must land with the `TRANSFORMERS_CACHE` removal here or the variable stays set in the container.

<!-- item id=USER-09 priority=P4 effort=S service=user-service -->
### USER-09 - Deprecated `datetime.utcnow()` produces naive timestamps mislabelled `Z`

**Where:** `srcs/user-service/apps/profiles/utils.py:20,45`, `srcs/user-service/apps/profiles/middleware.py:49`

**Problem:** All three call sites use `datetime.utcnow()`, deprecated since Python 3.12 and slated for removal; the image is `python:3.11-slim` today, so a base-image bump starts emitting `DeprecationWarning` on every response. `utils.py` also appends a literal `'Z'` to a timezone-naive ISO string, while `Custom404Middleware` (`middleware.py:49`) emits no suffix at all — the same service produces two timestamp formats in the shared envelope.

**Fix:** Replace with `datetime.now(timezone.utc).isoformat()` in all three places and drop the manual `+ 'Z'` (the aware form already renders `+00:00`). Pick one format for the whole envelope and use it in both `utils.py` and `middleware.py`.

**Verify:** `docker compose run --rm user-service python -W error::DeprecationWarning -m pytest tests/test_utils.py tests/test_middleware.py -v` passes with no warnings.

**Effort:** S - **Risk:** any consumer parsing the trailing `Z` sees `+00:00` instead; `tests/test_utils.py` (11 tests) asserts on the envelope shape and may assert the suffix. Cross-service format unification is GW-05, AUTH-11 and AI-12 — the same `datetime.utcnow()` → `datetime.now(timezone.utc)` edit in four services; pick one output format and do all four together, or the envelope stays inconsistent across the platform.

<!-- item id=USER-10 priority=P4 effort=S service=user-service -->
### USER-10 - Dead code: duplicate health route and unused imports

**Where:** `srcs/user-service/apps/profiles/urls.py:12`, `srcs/user-service/config/urls.py:5`, `srcs/user-service/apps/profiles/models.py:3`, `srcs/user-service/apps/profiles/views.py:1`

**Problem:** `health_check` is mounted twice — `/health` (used by the compose healthcheck) and `/api/v1/health` — and neither is proxied by the gateway, so the second is unreachable and unused. `models.py:3` imports `django.conf.settings` and never references it; `views.py:1` imports `status` from `rest_framework` and never uses it (all handlers pass plain ints to `success_response`/`error_response`). Note the corpus also flagged `action` as unused — it is used at `views.py:31,56,172`.

**Fix:** Delete `path('health', views.health_check, name='health')` from `apps/profiles/urls.py:12`, keeping the root `/health` that the healthcheck hits. Remove the two unused imports.

**Verify:** `docker compose run --rm user-service python -m pytest tests/ -v` (91 tests) passes and `docker exec ft_transcendence_user_service curl -sf http://localhost:3002/health` still returns 200 while `/api/v1/health` returns the `NOT_FOUND` envelope.

**Effort:** S - **Risk:** anything scripted against `/api/v1/health` breaks; grep shows only the compose healthcheck uses `/health`. Covered by `tests/test_views.py`.

<!-- item id=USER-11 priority=P4 effort=S service=user-service -->
### USER-11 - The cascade-delete handler returns the raw exception text to the caller

**Where:** `srcs/user-service/apps/profiles/views.py:84-89`

**Problem:** `except Exception as e: return error_response('INTERNAL_ERROR', f'Failed to delete user data: {str(e)}', status=500)` puts the raw database/ORM error message — table names, constraint names, connection strings in some psycopg2 errors — into a response body that reaches the client via auth-service's account-deletion flow. Nothing is logged server-side, so the operator sees less than the caller does.

**Fix:** Log the exception with `logging.getLogger(__name__).exception(...)` and return a fixed message (`'Failed to delete user data'`) with no interpolated exception text.

**Verify:** `docker compose run --rm user-service python -m pytest tests/test_views.py::TestUserProfileViewSet::test_delete_user_data_removes_all_user_records -v`, plus a new case that patches `PetAnalysis.objects.filter` to raise and asserts the 500 body contains no exception text.

**Effort:** S - **Risk:** debugging deletion failures now requires reading container logs instead of the response body. Covered by the three `test_delete_user_data_*` tests in `tests/test_views.py`.

---

## Decisions needed

_The right fix depends on a product call. Each item states the options and the tradeoff instead of prescribing one._

<!-- item id=AUTH-15 priority=DEC effort=M service=auth-service -->
### AUTH-15 - Auth service calls user-service directly, bypassing the API Gateway

**Where:** `srcs/auth-service/apps/authentication/utils.py:169-194`, `srcs/auth-service/config/settings.py:167`

**Problem:** `delete_user_cascade` posts straight to `http://user-service:3002/api/v1/users/delete` with self-minted `X-User-ID`/`X-User-Role`/`X-Request-ID` headers. Those headers are exactly what the gateway injects after validating a JWT, so any service on `backend-network` can impersonate any user against user-service; auth-service doing it makes that trust model explicit. It also contradicts the repo rule that cross-service access goes through the gateway, and the code carries a `# TODO this will be replaced with a message queue` marker.

**Fix:** This needs a product/architecture call, not a patch. Options: **(a)** keep the direct call and accept that `backend-network` is a trusted zone — cheapest, but then the "always via the gateway" rule must stop being stated as a rule; **(b)** route through the gateway with a dedicated service credential (requires the gateway to accept a service token and user-service to distinguish gateway-injected headers from forged ones — work in three services); **(c)** implement the TODO: publish a `user.deleted` event and let user-service consume it, which also removes the atomicity problem in AUTH-04 but adds a broker to the stack. Tradeoff is (a) zero cost/zero isolation vs (b) real isolation for a cross-service refactor vs (c) correct decoupling for new infrastructure.

**Verify:** Whichever option is chosen, the check is the same: `docker exec ft_transcendence_auth_service curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'X-User-ID: <victim-uuid>' http://user-service:3002/api/v1/users/delete` must return 401/403 under (b) or (c); under (a) it will still return 200 and that must be a recorded decision.

**Effort:** M - **Risk:** option (b) or (c) rewrites the only outbound HTTP call in this service, which has no test coverage at all today (nothing in `srcs/auth-service/tests/` mocks httpx). The user-service delete endpoint (`srcs/user-service/apps/profiles/`) changes in lockstep and belongs to that agent.

<!-- item id=AUTH-16 priority=DEC effort=M service=auth-service -->
### AUTH-16 - No access-token revocation exists anywhere, so nothing invalidates a token before its `exp`

**Where:** `srcs/auth-service/apps/authentication/views.py:247-276`, `srcs/api-gateway/middleware/auth_middleware.py:31-69`, `docker-compose.yml` (redis)

**Problem:** `grep -rni blacklist srcs scripts` returns nothing, and auth-service has no Redis client in `requirements.txt` or `config/settings.py` — the token blacklist the platform's security model describes (`blacklist:token:{hash}` in Redis, checked by the gateway) was never built. Every revocation path is therefore refresh-only: logout, `change-password` and `DeleteUserView` all flip `refresh_tokens.is_revoked`, but the already-issued access token keeps validating against the public key until its `exp`. Concretely, after a user changes their password because they believe it was stolen, the attacker's access token still authorises every protected route for up to `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` (15 by default, `config/settings.py:131`); after account deletion the same holds, and the gateway does not re-check that the subject still exists, so the token authorises calls against a user row that is gone.

**Fix:** A decision, not a patch — the cost differs by an order of magnitude between the options. **(a)** Accept it: declare the 15-minute window the residual risk, and delete the blacklist from the stated security model so nobody assumes protection that does not exist. Zero code. **(b)** Blacklist on the revocation events that already exist: auth-service writes `blacklist:token:{sha256}` with TTL = remaining lifetime on logout / change-password / delete, and `JWTAuthMiddleware` adds one Redis lookup per request. Redis is already in the stack and the gateway already talks to it — but this puts a hard Redis dependency on the auth path (a Redis outage must fail closed or the blacklist is decorative) and adds a round trip to every request, on top of the blocking-client problem in GW-06. **(c)** Shorten the access-token lifetime to 2-5 minutes and lean on refresh rotation instead; no new dependency, but it multiplies refresh traffic and makes AUTH-01 and GW-15 (logout reachability) strictly load-bearing. Whichever is chosen, `delete`/`change-password` should also be considered: those are the two events where a 15-minute grace is least defensible.

**Verify:** log in, capture the `access_token`, call `PUT /api/v1/auth/change-password`, then replay the captured token against `GET /api/v1/users/me`. Under (a) it must still return 200 and that must be a recorded decision; under (b) or (c) it must return 401 within the agreed window.

**Effort:** M - **Risk:** option (b) touches the hot path of every authenticated request in the gateway and needs an explicit fail-open/fail-closed policy plus tests for the Redis-down case; option (c) changes a documented token lifetime that the frontend's refresh logic will have to keep up with. No test exists for post-revocation access-token behaviour in either service today.

<!-- item id=LLM-02 priority=DEC effort=S service=litellm -->
### LLM-02 - Decide whether a profile/alias mismatch should fail hard or fall back

**Where:** `srcs/litellm/config.yaml:6-27`, `docker-compose.yml` (`ollama` is `profiles: ["local"]`)

**Problem:** The proxy registers four aliases unconditionally: `vision-model`/`text-model` pointing at `os.environ/OLLAMA_BASE_URL`, and `vision-model-cloud`/`text-model-cloud` pointing at Mistral. Which pair is valid depends on the compose profile, but nothing enforces the pairing. Running the `cloud` profile with the AI Service still on `vision-model` sends every request to a host that does not exist; running `local` with `*-cloud` aliases and an empty `MISTRAL_API_KEY` produces a 401. Both surface to the operator as `ConnectionError: Failed to connect to Ollama` (see the ai-service naming item), which points at the wrong component.

**Fix (decision required):** (a) Add `litellm_settings.fallbacks: [{"vision-model": ["vision-model-cloud"]}, {"text-model": ["text-model-cloud"]}]` so a dead Ollama degrades to the hosted provider — resilient, but silently spends money and, in the `cloud` path, silently runs without the NSFW filter. (b) Keep the aliases strictly separated and instead fail loudly: have the AI Service assert at startup that its configured alias resolves, by calling the proxy's `/v1/models`. (c) Collapse to a single pair of alias names whose `litellm_params` are env-driven, so the profile alone picks the backend and mismatch becomes impossible. Tradeoff is cost-and-silence (a) vs. an extra startup check (b) vs. a one-time config restructure that removes the failure mode entirely (c).

**Verify:** whichever option is chosen, the AI Service must be able to resolve its own configured alias. `$LITELLM_MASTER_KEY` does not exist inside the ai-service container — the same value is injected there as `LLM_API_KEY` — so expand it container-side: `docker exec ft_transcendence_ai_service sh -c 'curl -s -H "Authorization: Bearer $LLM_API_KEY" http://litellm:4000/v1/models'` must list the alias named by `LLM_VISION_MODEL`, under both `make up COMPOSE_PROFILES=local` and `make up COMPOSE_PROFILES=cloud`.

**Effort:** S - **Risk:** option (a) can mask a broken GPU stack indefinitely and bills the hosted provider for it; option (c) changes alias names and requires a matching edit to `srcs/ai/.env` and `srcs/ai/.env.example`.

<!-- item id=REC-10 priority=DEC effort=M service=recommendation-service -->
### REC-10 - `recommendations` / `user_feedback` tables are unusable: INT ids against a UUID platform

**Where:** `srcs/recommendation-service/migrations/002_create_tables.sql:73-104`, `srcs/recommendation-service/src/models/recommendation.py:21-22`, `srcs/recommendation-service/src/models/user_feedback.py:24-26`

**Problem:** Both tables type `user_id` and `pet_id` as `INT`, while every user and pet id in the platform is a UUID (`srcs/user-service/apps/profiles/models.py:47-48`). Any insert would fail. Neither table is written by any code path — the recommendation route never persists history and nothing records feedback — so the schema, the two ORM models and their indexes are shipped dead weight that will mislead the next engineer into thinking history exists.

**Fix:** Product decision. **Option A — keep the feature:** change both columns to `UUID` in `002_create_tables.sql` and to `sqlalchemy.dialects.postgresql.UUID` in the models, add a new migration for existing deployments, and write recommendation history from `routes/recommendations.py`. Cost: a write on the hot path plus a feedback endpoint. **Option B — delete:** drop the two `CREATE TABLE` blocks, `src/models/recommendation.py`, `src/models/user_feedback.py` and `tests/unit/test_models.py`'s coverage of them; re-add when the feature is actually scheduled. Cost: none, loses the placeholder. Option B is cheap and reversible; A only pays off if analytics are on the roadmap.

**Verify:** Option A: `docker exec ft_transcendence_recommendation_service python scripts/validate_env.py` then insert a row with a real UUID via psql. Option B: `make migration` on a fresh volume, then `docker compose run --rm recommendation-service python -m pytest tests/unit/ -v`.

**Effort:** M - **Risk:** `tests/unit/test_models.py` imports both models; `scripts/seed_products.py --force` issues an unfiltered `delete(Product)` that will hit the FK from these tables if they ever hold rows.

<!-- item id=INFRA-10 priority=DEC effort=S service=repo -->
### INFRA-10 - Decide the published edge ports: 8000/8443 or 80/443

**Where:** `docker-compose.yml:11-13`, `Makefile:56`

**Problem:** nginx publishes `8000:80` and `8443:443`, but everything written around it assumes the privileged pair: `make up` prints "Access the application at: https://localhost", which lands on a closed port, and the HTTP→HTTPS redirect returns `301 https://$host$request_uri` (`srcs/nginx/conf.d/default.conf.template:162`) — no port — so `http://localhost:8000/` redirects to an unreachable `https://localhost/`. Nothing in the repo consumes 8000/8443 (grep found no references outside compose), so both directions are open.

**Fix (decision required):** (a) Publish `80:80` and `443:443` — every existing instruction becomes true, the redirect works unmodified, at the cost of needing a privileged port and colliding with anything else on the host's :80. (b) Keep 8000/8443 — no privileges needed, but the nginx redirect must become `301 https://$host:8443$request_uri` (or use a `$redirect_host` variable driven by an env substitution) and `Makefile:56` must print `https://localhost:8443`. Option (b) also leaves the redirect target hardcoded to a host-side port inside container config, which is the reason it is wrong today.

**Verify:** Whichever is chosen: `curl -sI http://localhost:<http-port>/ | grep -i ^location` must print a URL that `curl -skI <that url>` answers with 200 or 301, not a connection refusal.

**Effort:** S - **Risk:** the redirect half lands in `srcs/nginx/conf.d/default.conf.template` (nginx unit) and must ship in the same change as the compose port decision.

<!-- item id=USER-02 priority=DEC effort=S service=user-service -->
### USER-02 - `/api/v1/analyses*` is implemented but unreachable: expose it or delete it

**Where:** `srcs/user-service/apps/profiles/urls.py:9`, `srcs/user-service/apps/profiles/views.py:186-225`, gateway side `srcs/api-gateway/routes/proxy.py:40-48`

**Problem:** The router registers `analyses` (list/retrieve/create), but the gateway's `SERVICE_ROUTES` maps only `/api/v1/auth`, `/api/v1/users`, `/api/v1/pets`, `/api/v1/vision`, `/api/v1/recommendations`, `/api/v1/admin/products`. Every request to `/api/v1/analyses` 404s at the gateway, and backend services are not reachable from outside the backend network. The ViewSet, its serializers and 8 tests are maintained for an API nobody can call. `GET /api/v1/pets/{id}/analyses` (`views.py:172-183`) is reachable and already covers per-pet read access.

**Fix:** Product call, two options. (a) Expose: add `"/api/v1/analyses": settings.USER_SERVICE_URL` to `SERVICE_ROUTES` — one line, but only after USER-01, otherwise the forged-ownership hole becomes externally reachable. (b) Delete: drop the `analyses` router registration, `PetAnalysisViewSet`, `PetAnalysisCreateSerializer` and their tests, keep `PetAnalysis` the model plus the nested `/pets/{id}/analyses` read. Tradeoff: (a) gives AI-service a place to persist analysis history (nothing writes `pet_analyses` today); (b) removes ~60 lines of unreachable code and the whole USER-01 attack surface.

**Verify:** With the stack up, `curl -s -o /dev/null -w '%{http_code}' -b cookies.txt http://localhost:8001/api/v1/analyses` returns 200 (option a) or the route is gone from `docker exec ft_transcendence_user_service python manage.py show_urls` / `grep -rn analyses srcs/user-service/apps` (option b).

**Effort:** S - **Risk:** option (a) adds an unauthenticated-by-ownership write path until USER-01 lands; option (b) deletes tests in `tests/test_views.py` and `tests/test_serializers.py` — the hardcoded suite count in `scripts/run-unit-tests.sh:115-117` is a display label only and is deleted by INFRA-09.

**Depends on:** USER-01

---

## Out of scope

- **Frontend.** `srcs/frontend/` holds only empty placeholder files and its compose service is
  commented out. It is being built on a separate branch and no item here touches it.
- **Documentation.** Corrected in the same audit pass that produced this roadmap.
- **New features.** This is a defect roadmap. Items that would build something new appear only
  under *Decisions needed*, and only when the alternative is deleting existing dead code.

---

## Tracking

| ID | Band | Effort | Area | Title |
|----|------|--------|------|-------|
| `GW-01` | P0 | S | api-gateway | Gateway accepts a refresh token as an access token |
| `GW-16` | P0 | S | api-gateway | Client-supplied `X-User-ID` / `X-User-Role` headers are forwarded to backend services |
| `REC-01` | P0 | M | recommendation-service | Admin product endpoints accept any authenticated user |
| `INFRA-01` | P0 | S | repo | `make init` provisions an admin account whose password is published in the repo |
| `INFRA-02` | P0 | S | repo | Ollama's unauthenticated API is published on all host interfaces |
| `USER-01` | P0 | S | user-service | POST /api/v1/analyses trusts `user_id` and `pet_id` from the request body |
| `GW-02` | P1 | S | api-gateway | /api/v1/analyses is unreachable through the gateway |
| `GW-03` | P1 | M | api-gateway | CORS middleware is innermost: 401/429 carry no CORS headers and preflights are rejected |
| `GW-15` | P1 | S | api-gateway | Logout is unreachable once the access token expires, so the session cannot be ended |
| `AUTH-01` | P1 | M | auth-service | Logout never revokes the refresh token in a real browser |
| `CLS-01` | P1 | S | classification-service | NSFW safety verdict ignores its configured threshold |
| `NGX-02` | P1 | S | nginx | Vision endpoint 504s through NGINX: /api read timeout is 30s |
| `NGX-03` | P1 | S | nginx | No client_max_body_size: images the AI service accepts are rejected 413 at the edge |
| `REC-02` | P1 | S | recommendation-service | Recommendations 500 for any pet with a null age or weight |
| `INFRA-03` | P1 | S | repo | The Makefile exports COMPOSE_PROFILES, so the root `.env` can never select the stack |
| `AI-01` | P2 | S | ai-service | RAG routes answer HTTP 200 when the service is not initialised |
| `AI-02` | P2 | S | ai-service | Image validation errors return prose as the machine-readable error code |
| `AI-03` | P2 | S | ai-service | A LiteLLM 4xx/5xx during contextual analysis surfaces as 500, not 503 |
| `AI-04` | P2 | S | ai-service | Incomplete but valid LLM JSON crashes the pipeline with a 500 |
| `AI-05` | P2 | S | ai-service | Corrupt image bytes behind a valid data URI return 500 instead of 422 |
| `AI-06` | P2 | S | ai-service | ChromaDB chunk IDs are unstable across restarts and collide within a run |
| `AI-07` | P2 | M | ai-service | RAG breed context maps similarity-ranked chunks to fields positionally |
| `AI-08` | P2 | S | ai-service | Two uvicorn workers load the models twice and open the same ChromaDB directory concurrently |
| `GW-04` | P2 | S | api-gateway | Upstream failures report code HTTP_ERROR with a Python repr as the message |
| `GW-05` | P2 | S | api-gateway | Every gateway-generated error envelope reports the worker start time |
| `GW-06` | P2 | M | api-gateway | Rate limiting blocks the event loop and swallows Redis failures to stdout |
| `GW-07` | P2 | S | api-gateway | Repeated query parameters are flattened and non-POST/PUT/PATCH bodies are dropped |
| `GW-08` | P2 | S | api-gateway | X-Request-ID is missing on exactly the requests worth tracing |
| `GW-12` | P2 | S | api-gateway | Public-endpoint matching is exact-string: /redoc and trailing-slash variants return 401 |
| `AUTH-02` | P2 | S | auth-service | Concurrent token issuance collides on the `placeholder` token hash |
| `AUTH-03` | P2 | S | auth-service | `DeleteUserView` accepts disabled accounts |
| `AUTH-04` | P2 | M | auth-service | Cascade delete destroys remote data before the local delete, with no compensation |
| `AUTH-05` | P2 | S | auth-service | Refresh-token row lifecycle is half-implemented |
| `AUTH-07` | P2 | M | auth-service | Dependency pins are past upstream security support |
| `CLS-02` | P2 | S | classification-service | NSFW probability is read by tensor position, not by label |
| `CLS-03` | P2 | S | classification-service | Dog breed model id disagrees across three layers |
| `CLS-04` | P2 | S | classification-service | Route tests mock a species payload shape the classifier never emits |
| `DB-02` | P2 | S | db | auth_schema exists only via the first-boot init script; without it auth tables land silently in `public` |
| `DB-04` | P2 | S | db | Live Postgres password committed in plaintext in a config file no running service consumes |
| `NGX-01` | P2 | S | nginx | Delete the committed TLS private key from srcs/nginx/ssl/ |
| `NGX-04` | P2 | S | nginx | Two CORS layers on /api, and the preflight branch omits Allow-Credentials |
| `NGX-05` | P2 | S | nginx | Security headers are silently dropped on every /api response |
| `NGX-06` | P2 | S | nginx | Auth endpoints get no stricter edge rate limit: auth_limit and api_limit are declared but never used |
| `NGX-07` | P2 | S | nginx | HTTP-to-HTTPS redirect sends clients to a port that is not published |
| `OLL-01` | P2 | S | ollama | Ollama entrypoint neither waits for readiness nor checks that model pulls succeeded |
| `REC-03` | P2 | S | recommendation-service | Missing X-User-ID answers HTTP 200 with success:false |
| `REC-04` | P2 | S | recommendation-service | `include_inactive` on the admin product list is a no-op |
| `REC-05` | P2 | M | recommendation-service | A user-service outage is reported to the client as "pet not found", silently |
| `REC-06` | P2 | S | recommendation-service | Two feature weights are hard-coded literals, so `WEIGHT_INGREDIENT_PREFERENCES` is dead config |
| `REC-07` | P2 | S | recommendation-service | `products_above_threshold` reports the post-limit count |
| `REC-08` | P2 | S | recommendation-service | `match_reasons` explains only two of the six health conditions |
| `USER-03` | P2 | S | user-service | A request with no `X-User-ID` silently reads nothing or 500s instead of returning 401 |
| `USER-04` | P2 | S | user-service | A non-UUID id in the path 500s instead of 404 |
| `USER-05` | P2 | M | user-service | `UserProfileViewSet` publishes stock CRUD routes that return un-enveloped payloads and a guaranteed 500 |
| `USER-06` | P2 | S | user-service | `POST /api/v1/pets` silently discards `breed_confidence` and `image_url` |
| `USER-07` | P2 | S | user-service | `DEBUG` defaults to `True`, so a `.env` without the key starts the service in debug mode |
| `AI-09` | P3 | M | ai-service | Tunables hardcoded outside config.py, including the cloud profile's crossbreed gates |
| `AI-10` | P3 | M | ai-service | The VLM-only pipeline and the vision route have no test coverage |
| `GW-09` | P3 | S | api-gateway | Module-level httpx.AsyncClient is never closed |
| `GW-10` | P3 | S | api-gateway | Test suite cannot be collected without a container-supplied env var |
| `GW-11` | P3 | S | api-gateway | No .dockerignore, so the local .env and caches are baked into the image |
| `AUTH-06` | P3 | S | auth-service | With DEBUG=True, missing JWT keys are swallowed and the healthcheck stays green |
| `AUTH-08` | P3 | S | auth-service | Settings default to `DEBUG=True` and a shared known `SECRET_KEY` |
| `AUTH-09` | P3 | M | auth-service | `refresh_tokens` grows without bound |
| `AUTH-10` | P3 | M | auth-service | Image ships the Django dev server plus the whole test toolchain |
| `CLS-05` | P3 | S | classification-service | DEVICE is missing from the env template it is supposed to be set in |
| `DB-01` | P3 | S | db | Bootstrap SQL hardcodes the database name and role, so POSTGRES_* cannot be changed |
| `LLM-01` | P3 | S | litellm | Proxy timeout and retry policy are unset, so they cannot line up with the caller's 300s budget |
| `NGX-08` | P3 | S | nginx | Per-vhost logs are invisible to `docker logs` and vanish with the container; logrotate.conf is never installed |
| `NGX-12` | P3 | S | nginx | The nginx healthcheck only parses the config; it can never detect a dead edge |
| `OLL-02` | P3 | S | ollama | init.sh runs as PID 1 without signal forwarding, so ollama is always SIGKILLed |
| `REC-09` | P3 | S | recommendation-service | Seed script depends on an undeclared PyYAML |
| `INFRA-04` | P3 | M | repo | Startup ordering is unmanaged: nginx, litellm, ai-service and recommendation-service wait for nothing |
| `INFRA-05` | P3 | S | repo | `make exec-<service>` builds a container name that never exists |
| `INFRA-06` | P3 | S | repo | The cleanup targets either do not exist or remove nothing |
| `INFRA-07` | P3 | S | repo | `make migration` generates migrations at deploy time instead of applying the committed ones |
| `INFRA-08` | P3 | S | repo | Postgres credentials are configurable in three places and honoured in none |
| `INFRA-11` | P3 | S | repo | classification-service is the only application service with no restart policy |
| `USER-08` | P3 | M | user-service | Container runs Django's development server; no WSGI server is installed |
| `AI-11` | P4 | M | ai-service | "Ollama" naming survives everywhere despite the LiteLLM migration |
| `AI-12` | P4 | S | ai-service | Vision endpoint emits deprecated naive timestamps; RAG endpoints emit aware ones |
| `AI-13` | P4 | S | ai-service | Dead request models shadowed by the route's own definition |
| `AI-14` | P4 | S | ai-service | Dead configuration settings |
| `AI-15` | P4 | S | ai-service | `detect_species(top_k=...)` is never passed by the orchestrator |
| `AI-16` | P4 | S | ai-service | Route test leaks module globals and makes the suite order-dependent |
| `AI-17` | P4 | S | ai-service | Knowledge base directory is misspelled `spiecies` |
| `GW-13` | P4 | S | api-gateway | success_response() is dead and the error envelope is hand-rebuilt in five places |
| `GW-14` | P4 | S | api-gateway | requirements.txt: duplicate httpx, unused PyJWT, test deps in the runtime image |
| `AUTH-11` | P4 | S | auth-service | Deprecated `datetime.utcnow()` and inconsistent timestamp suffixes |
| `AUTH-12` | P4 | S | auth-service | `last_login` is never written |
| `AUTH-13` | P4 | S | auth-service | Unused test dependencies pinned and installed |
| `AUTH-14` | P4 | S | auth-service | `PORT` in `.env.example` is read by nothing |
| `CLS-06` | P4 | S | classification-service | Two dead confidence thresholds advertise a tuning knob that does nothing |
| `CLS-07` | P4 | S | classification-service | TRANSFORMERS_CACHE is a deprecated HuggingFace variable |
| `CLS-08` | P4 | M | classification-service | Multi-GB torchvision dependency exists only for a test-only helper |
| `DB-03` | P4 | S | db | Init script creates an unused `ai_schema` and duplicates `recommendation_schema` |
| `NGX-09` | P4 | S | nginx | 404.html is shipped into the image but nothing references it, and it is a 13-byte stub |
| `NGX-10` | P4 | S | nginx | Generated certificate carries an invalid country code |
| `NGX-11` | P4 | S | nginx | Platform description hardcoded as a JSON string inside the nginx config |
| `REC-11` | P4 | S | recommendation-service | Feature index 10 is reserved-and-zero yet carries a full health weight |
| `REC-12` | P4 | M | recommendation-service | Product schema fields are written out three times |
| `REC-13` | P4 | S | recommendation-service | `src/middleware/` is an empty dead package |
| `REC-14` | P4 | M | recommendation-service | Pydantic v1 and SQLAlchemy 1.x APIs on v2 dependencies |
| `INFRA-09` | P4 | S | repo | The unit-test runner prints invented test counts |
| `INFRA-12` | P4 | S | repo | docker-compose hygiene: deprecated env var, dead volumes, unused mounts, stale comment |
| `USER-09` | P4 | S | user-service | Deprecated `datetime.utcnow()` produces naive timestamps mislabelled `Z` |
| `USER-10` | P4 | S | user-service | Dead code: duplicate health route and unused imports |
| `USER-11` | P4 | S | user-service | The cascade-delete handler returns the raw exception text to the caller |
| `AUTH-15` | DEC | M | auth-service | Auth service calls user-service directly, bypassing the API Gateway |
| `AUTH-16` | DEC | M | auth-service | No access-token revocation exists anywhere, so nothing invalidates a token before its `exp` |
| `LLM-02` | DEC | S | litellm | Decide whether a profile/alias mismatch should fail hard or fall back |
| `REC-10` | DEC | M | recommendation-service | `recommendations` / `user_feedback` tables are unusable: INT ids against a UUID platform |
| `INFRA-10` | DEC | S | repo | Decide the published edge ports: 8000/8443 or 80/443 |
| `USER-02` | DEC | S | user-service | `/api/v1/analyses*` is implemented but unreachable: expose it or delete it |

