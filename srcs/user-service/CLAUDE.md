# CLAUDE.md - User Service

## Overview

Django 5.1 + DRF service owning `user_schema` (`user_profiles`, `pets`, `pet_analyses`). Container
`ft_transcendence_user_service`, internal port 3002, no host port, no compose profile gate (runs in
both `local` and `cloud`). It authenticates nothing: identity is `request.user_id` /
`request.user_role`, copied verbatim from the `X-User-ID` / `X-User-Role` headers the API Gateway
injects. Only dependency is PostgreSQL. See `README.md` for the full route/field/config reference.

## Essential Commands

```bash
# Tests (91) — run --rm is fine everywhere; no test calls another service
docker compose run --rm user-service python -m pytest tests/ -v
docker compose run --rm user-service python -m pytest tests/test_views.py -v
docker compose run --rm user-service python -m pytest tests/test_views.py::TestPetViewSet::test_create_pet_sets_user_id_from_header -v
./scripts/run-unit-tests.sh --user      # same command; prints "91" as a label, never asserts it

# Migrations
docker exec ft_transcendence_user_service python manage.py makemigrations
docker exec ft_transcendence_user_service python manage.py migrate

# Shell / logs  (exec-% uses the container name, logs-% the compose service name)
make exec-user_service
make logs-user-service

# Rebuild — ONLY needed after requirements.txt changes (source is bind-mounted rw)
docker compose build user-service

# Coverage: pytest-cov is not installed here
docker exec ft_transcendence_user_service pip install pytest-cov
docker exec ft_transcendence_user_service python -m pytest tests/ --cov=apps --cov-report=html
```

Never `curl localhost:3002` — the port is not published. Go through the gateway (`localhost:8001`)
or Nginx (`https://localhost:8443`, host ports are `8000:80` / `8443:443`).

## Code Map

| Path | Responsibility |
|---|---|
| `manage.py` | Django entrypoint, `DJANGO_SETTINGS_MODULE=config.settings` |
| `config/settings.py` | Every setting; all env reads live here (decouple `config()`) |
| `config/urls.py` | Root URLconf: `GET /health` + `include('apps.profiles.urls')` under `api/v1/` |
| `config/wsgi.py`, `config/asgi.py` | `runserver` loads `config.wsgi.application` via `WSGI_APPLICATION` (`config/settings.py:65`); `asgi.py` is unused |
| `apps/profiles/urls.py` | `DefaultRouter(trailing_slash=False)`; registers `users`, `pets`, `analyses` |
| `apps/profiles/views.py` | `health_check` + `UserProfileViewSet`, `PetViewSet`, `PetAnalysisViewSet` |
| `apps/profiles/serializers.py` | 6 serializers: read vs. create variants for profile/pet/analysis |
| `apps/profiles/models.py` | `UserProfile`, `Pet`, `PetAnalysis` (UUID PKs, soft references) |
| `apps/profiles/permissions.py` | `IsOwnerOrAdmin`, `IsOwner` — object-level only |
| `apps/profiles/middleware.py` | `UserContextMiddleware` (header → request), `Custom404Middleware` (JSON 404s) |
| `apps/profiles/utils.py` | `success_response()` / `error_response()` — both return DRF `Response` |
| `apps/profiles/migrations/` | `0001` creates the schema + tables, `0002` renames indexes, `0003` alters `species` |
| `tests/` | 6 unit test modules + `conftest.py` (`django_db_setup` override) |
| `MICROSERVICES_REFACTOR.md` | Historical note on dropping cross-schema FKs — design claims hold, counts are stale |

## Request / Data Flow

```
client → nginx → api-gateway (JWT cookie → X-User-ID/X-User-Role) → user-service:3002
  SecurityMiddleware → Cors → Session → Common → Csrf → Messages → XFrameOptions
    → UserContextMiddleware      sets request.user_id / request.user_role
      → URLconf: /api/v1/ → DefaultRouter → ViewSet action
        → get_queryset() filters by request.user_id (admin role = no filter)
        → serializer validate → ORM (search_path=user_schema,public)
        → success_response(...) / error_response(...)
    ← Custom404Middleware rewrites any 404 (HTML or DRF) into the standard envelope
```

Two callers bypass the gateway entirely and set the headers themselves: auth-service
(`DELETE /api/v1/users/delete`, cascade account deletion) and recommendation-service
(`GET /api/v1/pets/{id}`, `X-User-ID` only → role defaults to `user`).

## Conventions & Patterns

- **Always return the envelope.** Use `success_response(data, status=...)` /
  `error_response(code, message, details, status=...)` from `apps/profiles/utils.py`. They already
  return `Response`; `return Response(success_response(...))` raises
  `TypeError: Object of type Response is not JSON serializable`.
- **Error codes/statuses in use:** `VALIDATION_ERROR`→422, `NOT_FOUND`→404, `UNAUTHORIZED`→401,
  `INTERNAL_ERROR`→500. Validation failures pass `serializer.errors` as `details`.
- **No trailing slashes.** `APPEND_SLASH = False` (`config/settings.py:46`) and
  `DefaultRouter(trailing_slash=False)` (`apps/profiles/urls.py:6`). New paths must follow.
- **Ownership = queryset filter, not 403.** `get_queryset()` filters on `request.user_id`; ViewSet
  methods then `get_queryset().get(pk=pk)` inside `try/except Model.DoesNotExist` and return 404.
  `self.check_object_permissions(request, obj)` is called afterwards as defence in depth.
- **Admin bypass** is `request.user_role == 'admin'` inside `get_queryset()`
  (`apps/profiles/views.py:101-103`, `:196-198`) and in `IsOwnerOrAdmin.has_object_permission`.
- **Server-side ownership on create:** `serializer.save(user_id=request.user_id)`
  (`apps/profiles/views.py:116`); `user_id` is `read_only` in the read serializers.
- **Two serializers per resource:** a `*Serializer` (full, read + update) and a narrow write-surface
  twin — `PetCreateSerializer` / `PetAnalysisCreateSerializer` for pets and analyses, but
  `UserProfileUpdateSerializer` (not `…CreateSerializer`) for profiles. Validators are duplicated
  between the pair — change both.
- **Soft references only.** `user_id` / `pet_id` are `UUIDField`, never `ForeignKey`. Do not add a
  cross-schema FK; cross-service consistency is handled by the cascade-delete endpoint.
- **Comparisons are string-based:** `str(obj.user_id) == str(user_id)` because the header is a
  string and the column is a UUID (`apps/profiles/permissions.py:17`).

## Gotchas

1. **Missing `X-User-ID` is not rejected.** `request.user_id` becomes `None`
   (`apps/profiles/middleware.py:20`). Reads then filter on `user_id IS NULL` (empty 200), writes
   blow up with a `NOT NULL` `IntegrityError` (500). Only `delete_user_data` has an explicit 401
   guard (`apps/profiles/views.py:61-62`). If you add a write endpoint, add the same guard.
2. **`X-User-Role` defaults to `'user'`** (`apps/profiles/middleware.py:21`) — an absent header is
   never an error, so never treat "no role" as a failure signal.
3. **`/api/v1/analyses*` is not routed by the API Gateway.** `SERVICE_ROUTES` only maps
   `/api/v1/users` and `/api/v1/pets` here (`srcs/api-gateway/routes/proxy.py:42-43`). Adding an
   endpoint under a new prefix requires a gateway change too, otherwise it is unreachable
   externally.
4. **`POST /api/v1/analyses` takes `user_id` from the request body**, not from the header
   (`PetAnalysisCreateSerializer`, `apps/profiles/serializers.py:132-138`) — unlike pets. Keep this
   in mind before treating stored `user_id` on analyses as trusted.
5. **Invalid UUID in a path segment → 500, not 404.** `Pet.objects.get(pk='abc')` raises
   `django.core.exceptions.ValidationError`, which is not caught by the `except Model.DoesNotExist`
   blocks. The gateway papers over it by converting HTML 500s containing `DoesNotExist`/`Not Found`
   into a JSON 404 (`srcs/api-gateway/routes/proxy.py:205-224`).
6. **`UserProfileViewSet` is a full `ModelViewSet`.** Besides `me` and `delete`, the router publishes
   `GET/POST /api/v1/users` and `GET/PUT/PATCH/DELETE /api/v1/users/{id}` with DRF's stock handlers,
   which return bare payloads (no envelope) and, for POST, cannot succeed (`user_id` is read-only,
   column is NOT NULL). If you touch that ViewSet, decide deliberately whether to keep or restrict
   them (e.g. via `http_method_names`, the way `PetAnalysisViewSet` does at
   `apps/profiles/views.py:190`).
7. **`DefaultRouter` also mounts an API-root view at `/api/v1/`.** Harmless, but it is a real route
   when you enumerate the URLconf.
8. **`request.user` does not exist.** `AuthenticationMiddleware` is intentionally not installed
   (`config/settings.py:36-37`); `django.contrib.auth` is in `INSTALLED_APPS` only so DRF imports
   cleanly, and `auth_user` does not live in `user_schema`. Never write `request.user`,
   `@login_required`, or anything that touches Django's auth tables.
9. **`.delete()[0]` is used for the deletion counts** (`apps/profiles/views.py:67-73`). It is
   correct only because these models have no related objects — adding a related model with CASCADE
   would inflate the numbers auth-service reports.
10. **`PetCreateSerializer` silently ignores `breed_confidence` and `image_url`** — they are not in
    its `fields` list, so a POST that sets them succeeds while dropping them. They are writable via
    PUT/PATCH (`PetSerializer`).
11. **Two `health` routes exist**: `/health` (root, used by the compose healthcheck) and
    `/api/v1/health` (`apps/profiles/urls.py:12`). Neither is proxied by the gateway.
12. **`age` and `weight` have no unit in this model.** recommendation-service reinterprets them as
    `age_months` / `weight_kg` (`srcs/recommendation-service/src/routes/recommendations.py:63-65`);
    changing their meaning breaks that consumer.
13. **Gateway proxy timeout for these paths is 30 s** (no `SERVICE_TIMEOUTS` override,
    `srcs/api-gateway/routes/proxy.py:16-18`). Slow endpoints surface to the client as a 503.
14. **No pagination anywhere.** `list()` serializes the entire queryset.

## Testing Notes

- **`docker compose run --rm` always works**; `docker exec` is never required (no cross-service
  calls). The bind mount `./srcs/user-service:/app:rw` means **new test files need no rebuild** —
  unlike services whose code is only baked into the image.
- **The `db` container must be up:** `tests/conftest.py:6-35` overrides `django_db_setup` and calls
  `setup_databases(verbosity=1, interactive=False, keepdb=False, serialize=False)`. `serialize=False`
  is the load-bearing part — `django.contrib.auth` is installed but `auth_user` is not in this
  schema, so the default serialization step fails. Do not remove that override; do not add
  `--reuse-db`, `keepdb=False` recreates the DB each session.
- **View tests bypass URLs and middleware.** They build the request with
  `RequestFactory()` and then set `request.user_id` / `request.user_role` by hand before calling
  `ViewSet.as_view({'get': 'list'})(request)`. Consequences: routing/trailing-slash regressions are
  *not* covered by tests, and any new attribute you read off `request` must be set in every test.
- **Fixtures** (`tests/conftest.py:38-85`): `user_id`, `admin_user_id` (bare UUIDs),
  `user_profile`, `pet`, `pet_analysis` (DB rows). Most view tests ignore them and create rows
  inline.
- **DB-touching tests need `@pytest.mark.django_db`** on the class (or the `db` fixture);
  `test_middleware.py`, `test_permissions.py` and `test_utils.py` deliberately run without it.
- Counts by file: views 36, serializers 18, models 12, utils 11, middleware 9, permissions 5 = **91**.
  `scripts/run-unit-tests.sh:115-117` hardcodes 91 as a display label only (`run_test_suite`
  prints it and adds it to the total on exit 0, `:86-100`) — update it if you add tests.
- `pytest.ini` sets `DJANGO_SETTINGS_MODULE=config.settings`, `--strict-markers`, and declares the
  `slow` / `integration` markers (both currently unused).

## Config & Thresholds

- **Every** environment read is a `decouple.config()` call in `config/settings.py`:
  `SECRET_KEY` (`:11`), `DEBUG` (`:12`, code default `True` — `.env.example` ships `False`),
  `ALLOWED_HOSTS` (`:13`), `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` (`:71-75`),
  `CORS_ALLOWED_ORIGINS` (`:107`). Nothing is read anywhere else — no `os.getenv` in app code.
- Add a new variable in three places: `config/settings.py` (with a safe default),
  `.env.example`, and the local `.env`. Never hardcode a tunable value in a view or serializer, and
  never read a value from `.env` in documentation or tests.
- This service has **no thresholds** (confidence/limits/timeouts live in ai-, classification- and
  api-gateway configs). The only numeric constraints are serializer validators —
  `age >= 0`, `weight > 0`, `0 <= breed_confidence <= 1` (`apps/profiles/serializers.py:73-89`) —
  and field `max_length`s in `models.py`.
- `requirements.txt` is baked into the image at build time: `Django==5.1.5`,
  `djangorestframework==3.15.2`, `psycopg2-binary`, `python-decouple`, `django-cors-headers`,
  `pytest`, `pytest-django`. Django 6.x needs Python ≥3.12 and the image is `python:3.11-slim` — do
  not bump Django without changing the base image.
