# User Service

Django + Django REST Framework microservice that owns the `user_schema` PostgreSQL schema: extended
user profiles, pet profiles, and the history of AI breed-identification analyses. It performs **no
authentication of its own** — it runs on the internal `backend-network` with no host port and trusts
the `X-User-ID` / `X-User-Role` headers injected by the API Gateway after JWT validation.

## Responsibilities

- Own and migrate the `user_schema` tables: `user_profiles`, `pets`, `pet_analyses`.
- Serve the current user's profile (`/api/v1/users/me`), auto-creating a row on first read.
- Full CRUD for pets, scoped to the caller (`user_id` from the gateway header).
- Store and read back pet analysis records produced by the AI pipeline.
- Provide the cascade-delete endpoint (`/api/v1/users/delete`) that auth-service calls before
  deleting the account itself.
- Expose ownership filtering / permission enforcement (`IsOwnerOrAdmin`) for all owned rows.
- Return the platform-standard `{success, data, error, timestamp}` envelope
  (`apps/profiles/utils.py:5`, `apps/profiles/utils.py:24`).

Explicitly **not** its job: JWT validation, rate limiting, password handling, breed inference.

## Architecture

| Aspect | Value | Source |
|---|---|---|
| Compose service / container | `user-service` / `ft_transcendence_user_service` | `docker-compose.yml:202-204` |
| Listen address | `0.0.0.0:3002` (`manage.py runserver`) | `Dockerfile:24` |
| Host port | none — internal only | `docker-compose.yml:202-224` (no `ports:`) |
| Networks | `backend-network` only | `docker-compose.yml:213-214` |
| Compose profile | none declared → runs in **both** `local` and `cloud` | `docker-compose.yml:202-224` |
| Depends on | `db` (`condition: service_healthy`) | `docker-compose.yml:222-224` |
| Healthcheck | `curl -f http://localhost:3002/health`, 30s / 10s / 3 retries / 60s start | `docker-compose.yml:216-221` |
| Bind mount | `./srcs/user-service:/app:rw` (live code, dev autoreload) | `docker-compose.yml:210-212` |

Nothing in this service differs between the `local` and `cloud` compose profiles: it has no GPU,
no LLM and no classification dependency.

### Inbound callers

| Caller | How | Notes |
|---|---|---|
| API Gateway (`ft_transcendence_api_gateway`) | `http://user-service:3002` for `/api/v1/users*` and `/api/v1/pets*` | `srcs/api-gateway/routes/proxy.py:42-43`. Gateway validates the `access_token` cookie, then sets `X-User-ID`, `X-User-Role`, `X-Request-ID`, `X-Correlation-ID` (`srcs/api-gateway/middleware/auth_middleware.py:57-62`). Cookies are stripped for non-`/api/v1/auth` paths. Proxy timeout is the default **30 s** (no override for user paths, `srcs/api-gateway/routes/proxy.py:16-18`). |
| Auth Service | `DELETE http://user-service:3002/api/v1/users/delete`, direct service-to-service, **bypasses the gateway** | `srcs/auth-service/apps/authentication/utils.py:169-194`; `httpx.Client(timeout=10.0)`, headers `X-User-ID` / `X-User-Role` / `X-Request-ID`; any non-200 aborts the account deletion. |
| Recommendation Service | `GET http://user-service:3002/api/v1/pets/{pet_id}`, direct, **bypasses the gateway** | `srcs/recommendation-service/src/services/user_service_client.py:34-53`; sends only `X-User-ID`, `timeout=10.0`, swallows any non-200 / timeout into `None`. |

### Outbound dependencies

Only PostgreSQL (`db:5432`, database `smartbreeds`, `search_path=user_schema,public`,
`config/settings.py:77`). No Redis, no HTTP clients, no message bus — `httpx`/`requests` are not
even installed.

### Trust model

`UserContextMiddleware` (`apps/profiles/middleware.py:18-24`) copies two headers onto the request:

```python
request.user_id   = request.headers.get('X-User-ID')          # None when absent
request.user_role = request.headers.get('X-User-Role', 'user')
```

There is no signature, no allow-list and no rejection path: **any** process able to reach
`user-service:3002` on the backend network can impersonate any user by setting these headers. The
security boundary is network isolation plus the gateway, not this service. Only
`DELETE /api/v1/users/delete` explicitly rejects a missing `X-User-ID` with 401
(`apps/profiles/views.py:61-62`); every other endpoint proceeds with `user_id = None`, which either
returns an empty result set or raises a `NOT NULL` `IntegrityError` (500) on write.

`IsOwnerOrAdmin` (`apps/profiles/permissions.py:10-17`) implements only `has_object_permission`;
`has_permission` falls back to the DRF default `True`. Row scoping therefore comes from
`get_queryset()` filtering by `user_id`, and a non-owner sees **404, not 403**
(`apps/profiles/views.py:122-130`).

## API Reference

Django is configured for slash-free RESTful URLs: `APPEND_SLASH = False`
(`config/settings.py:46`) and `DefaultRouter(trailing_slash=False)` (`apps/profiles/urls.py:6`).
Paths below are exact and final.

| Method | Path | Reachable via gateway | Purpose |
|---|---|---|---|
| GET | `/health` | no (container-local only) | Docker healthcheck |
| GET | `/api/v1/health` | no (gateway has no route for it) | Same handler, mounted under the API prefix |
| GET | `/api/v1/users/me` | yes | Get own profile (creates it if missing) |
| PUT / PATCH | `/api/v1/users/me` | yes | Replace / partially update own profile |
| DELETE | `/api/v1/users/delete` | yes | Delete all data for the caller (profile + pets + analyses) |
| GET | `/api/v1/pets` | yes | List own pets (all pets when role is `admin`) |
| POST | `/api/v1/pets` | yes | Create a pet |
| GET | `/api/v1/pets/{id}` | yes | Get one pet |
| PUT | `/api/v1/pets/{id}` | yes | Full update |
| PATCH | `/api/v1/pets/{id}` | yes | Partial update |
| DELETE | `/api/v1/pets/{id}` | yes | Delete a pet |
| GET | `/api/v1/pets/{id}/analyses` | yes | Analysis history for that pet |
| GET | `/api/v1/analyses` | **no** | List own analyses (all when `admin`) |
| POST | `/api/v1/analyses` | **no** | Create an analysis record |
| GET | `/api/v1/analyses/{id}` | **no** | Get one analysis |
| GET / POST | `/api/v1/users` | yes | Router-inherited DRF handlers, see "Inherited routes" |
| GET / PUT / PATCH / DELETE | `/api/v1/users/{id}` | yes | Router-inherited DRF handlers, see "Inherited routes" |

`/api/v1/analyses*` has no entry in the gateway's `SERVICE_ROUTES`
(`srcs/api-gateway/routes/proxy.py:40-48`), so external clients get the gateway's own 404. It is
only reachable from inside `backend-network`.

`DefaultRouter` also mounts an API-root view at `/api/v1/`; it is not routed by the gateway either.

### Envelopes

Success (`apps/profiles/utils.py:5`):

```json
{ "success": true, "data": {}, "error": null, "timestamp": "2026-08-10T12:00:00.000000Z" }
```

Error (`apps/profiles/utils.py:24`):

```json
{ "success": false, "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": {} },
  "timestamp": "2026-08-10T12:00:00.000000Z" }
```

Codes actually emitted by this service: `VALIDATION_ERROR` (422), `NOT_FOUND` (404),
`UNAUTHORIZED` (401, delete only), `INTERNAL_ERROR` (500, delete only). Unmatched URLs and DRF's own
`{"detail": "Not found."}` are rewritten to the `NOT_FOUND` envelope by `Custom404Middleware`
(`apps/profiles/middleware.py:35-54`). Malformed JSON is handled by DRF's exception handler and
returns **400 with DRF's `{"detail": ...}` shape**, not the envelope
(`tests/test_views.py:630-646`).

### GET /api/v1/users/me

No body. Returns 200 with the profile; the row is created on the fly via `get_or_create`
(`apps/profiles/views.py:37`).

```json
{ "id": "uuid", "user_id": "uuid", "phone": "", "address": null,
  "preferences": {}, "created_at": "...", "updated_at": "..." }
```

### PUT / PATCH /api/v1/users/me

Accepts only `phone`, `address`, `preferences` (`UserProfileUpdateSerializer`,
`apps/profiles/serializers.py:35-58`). PUT is a full update of those three, PATCH is partial
(`partial=(request.method == 'PATCH')`, `apps/profiles/views.py:46`). Response is the full
`UserProfileSerializer` payload.

Validation:

| Field | Rule |
|---|---|
| `phone` | after removing `+`, `-` and spaces the remainder must be all digits (`serializers.py:42-46`) |
| `address` | `null`, a string, or an object whose keys ⊆ `{street, city, state, zip, country}` (`serializers.py:48-58`) |
| `preferences` | free-form JSON object |

Errors: 422 `VALIDATION_ERROR` with `error.details` = DRF field errors.

### DELETE /api/v1/users/delete

No body. Deletes, inside one transaction (`apps/profiles/views.py:65-82`), all `PetAnalysis`, then
all `Pet`, then the `UserProfile` for `request.user_id`.

```json
{ "message": "User data deleted successfully",
  "deleted": { "profiles": 1, "pets": 2, "analyses": 5 } }
```

Errors: 401 `UNAUTHORIZED` when `X-User-ID` is absent; 500 `INTERNAL_ERROR` on any exception.
Counts come from `QuerySet.delete()[0]`; these models have no related objects, so the totals are
per-model.

### GET /api/v1/pets

Returns a JSON array in `data`. Queryset is `Pet.objects.filter(user_id=...)`, or **all pets** when
`X-User-Role: admin` (`apps/profiles/views.py:97-103`). No pagination is configured.

### POST /api/v1/pets

`PetCreateSerializer` (`apps/profiles/serializers.py:92-116`) — accepted fields only:

| Field | Required | Rule |
|---|---|---|
| `name` | yes | non-blank, ≤ 100 chars |
| `species` | yes | one of `dog`, `cat`, `other` |
| `breed` | no | ≤ 100 chars, may be blank |
| `age` | no | integer ≥ 0 |
| `weight` | no | float > 0 |
| `health_conditions` | no | any JSON value; model default `[]`, no list-type enforcement |

`user_id` is injected server-side from the header (`serializer.save(user_id=request.user_id)`,
`apps/profiles/views.py:116`). `breed_confidence` and `image_url` cannot be set at creation time —
only through PUT/PATCH. Returns 201 with the full `PetSerializer` payload, or 422.

### PUT / PATCH /api/v1/pets/{id}

Both use `PetSerializer` (`apps/profiles/serializers.py:61-89`), so `breed_confidence` and
`image_url` are writable here. `id`, `user_id`, `created_at`, `updated_at` are read-only.
Extra rule: `breed_confidence` must be within `0 <= value <= 1`. Returns 200, 422, or 404 when the
pet does not exist **or belongs to someone else**.

### DELETE /api/v1/pets/{id}

Returns 200 `{"message": "Pet deleted successfully"}` or 404.

### GET /api/v1/pets/{id}/analyses

Returns all `PetAnalysis` rows with `pet_id == id` (ordered newest first by the model's
`Meta.ordering`). Ownership is checked on the *pet*, not on each analysis
(`apps/profiles/views.py:176-181`).

### /api/v1/analyses (internal)

`PetAnalysisViewSet` sets `http_method_names = ['get', 'post']`
(`apps/profiles/views.py:190`), so PUT/PATCH/DELETE on `/api/v1/analyses/{id}` return 405.
`PetAnalysisCreateSerializer` (`apps/profiles/serializers.py:132-138`) accepts `pet_id`, `user_id`,
`image_url`, `breed_detected`, `confidence`, `traits`, `raw_response`; `pet_id`, `user_id`,
`image_url`, `breed_detected` and `confidence` are required. `user_id` is taken **from the request
body**, not from the header.

### Inherited routes

`UserProfileViewSet` is a `ModelViewSet`, so besides `me` and `delete` the router also publishes
`GET/POST /api/v1/users` and `GET/PUT/PATCH/DELETE /api/v1/users/{id}` using DRF's stock handlers.
Those bypass `success_response`, so they return bare DRF payloads rather than the platform envelope,
and `POST /api/v1/users` cannot succeed because `user_id` is read-only in `UserProfileSerializer`
(`apps/profiles/serializers.py:14`) and the column is `NOT NULL`.

## Data Model

Schema `user_schema` (created by `srcs/db/init-scripts/01-init-schemas.sql` at DB bootstrap and again
idempotently by migration `0001_initial`). Connection pins `search_path=user_schema,public`
(`config/settings.py:77`).

### `user_profiles` (`apps/profiles/models.py:6-31`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `default=uuid.uuid4` |
| `user_id` | UUID | **unique**, indexed — soft reference to `auth_schema.users.id` |
| `phone` | varchar(20) | `blank=True`; Django returns `''` when unset |
| `address` | JSONB | nullable |
| `preferences` | JSONB | `default=dict` |
| `created_at` / `updated_at` | timestamptz | `auto_now_add` / `auto_now` |

Indexes: `user_id`, `created_at`.

### `pets` (`apps/profiles/models.py:34-72`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | indexed, soft reference |
| `name` | varchar(100) | required |
| `breed` | varchar(100) | `blank=True` |
| `breed_confidence` | float | nullable, serializer-bounded to 0..1 |
| `species` | varchar(10) | choices `dog`/`cat`/`other`, `default='dog'` (set by migration `0003`) |
| `age` | integer | nullable; no unit in the model — recommendation-service maps it to `age_months` (`srcs/recommendation-service/src/routes/recommendations.py:63-65`) |
| `weight` | float | nullable; mapped to `weight_kg` by recommendation-service |
| `health_conditions` | JSONB | `default=list` |
| `image_url` | varchar(500) | nullable |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `(user_id, created_at)`, `(species)`.

### `pet_analyses` (`apps/profiles/models.py:75-104`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `pet_id` | UUID | indexed, soft reference to `pets.id` |
| `user_id` | UUID | indexed, soft reference |
| `image_url` | varchar(500) | required |
| `breed_detected` | varchar(100) | required |
| `confidence` | float | required |
| `traits` | JSONB | `default=dict` |
| `raw_response` | JSONB | nullable — intended for the full AI payload |
| `created_at` | timestamptz | `auto_now_add` |

`Meta.ordering = ['-created_at']`. Indexes: `(pet_id, created_at)`, `(user_id, created_at)`.

### Soft references

No cross-schema foreign keys exist. `user_id` / `pet_id` are plain `UUIDField`s, so deleting a user
in auth-service does not cascade at the database level — that is why auth-service calls
`/api/v1/users/delete` first. See `MICROSERVICES_REFACTOR.md` for the historical rationale (its
test numbers are stale; the design statements still match the code).

### Migrations (`apps/profiles/migrations/`)

| File | Content |
|---|---|
| `0001_initial.py` | `CREATE SCHEMA IF NOT EXISTS user_schema` + the three models + 6 indexes |
| `0002_rename_pet_user_created_idx_...py` | Renames the hand-named indexes to Django auto-names, adds `serialize=False` to the PKs |
| `0003_alter_pet_species.py` | `species`: `max_length` 20 → 10, adds `default='dog'` |

## Configuration

All variables are read through `python-decouple` in `config/settings.py`. Values below are the
**hardcoded code defaults** and the values shipped in the checked-in `.env.example`; the real `.env`
is gitignored and is not documented here.

| Variable | Code default (`config/settings.py`) | `.env.example` | Purpose |
|---|---|---|---|
| `SECRET_KEY` | `django-insecure-dev-key-change-in-production` (`:11`) | `django-insecure-dev-key-user-service-change-in-prod` | Django signing key |
| `DEBUG` | `True` (`:12`) | `False` | Django debug mode — note the code default differs from the example file |
| `ALLOWED_HOSTS` | `user-service,localhost` (CSV, `:13`) | `user-service,localhost` | Must contain `user-service` (gateway calls) and `localhost` (healthcheck) |
| `DB_NAME` | `smartbreeds` (`:71`) | `smartbreeds` | Shared database |
| `DB_USER` | `smartbreeds_user` (`:72`) | `smartbreeds_user` | |
| `DB_PASSWORD` | `smartbreeds_password` (`:73`) | `smartbreeds_password` | Dev credential |
| `DB_HOST` | `db` (`:74`) | `db` | Compose service name |
| `DB_PORT` | `5432` (`:75`) | `5432` | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` (CSV, `:107`) | same | Only meaningful for direct calls; browsers reach the gateway, not this service |

No other environment variable is read anywhere in the service. There are no tunable thresholds.

Fixed settings worth knowing: `APPEND_SLASH = False` (`:46`), `CORS_ALLOW_CREDENTIALS = True`
(`:108`), DRF restricted to `JSONRenderer` + `JSONParser` (`:97-104`),
`ATOMIC_REQUESTS = False` (`:79`), and `django.contrib.auth.middleware.AuthenticationMiddleware` is
deliberately absent (`:36-37`) so `request.user` never exists.

## Running

The service is part of the default stack; it has no profile gate and starts with everything else.

```bash
make up                          # whole stack
docker compose up user-service -d # this service (+ db, via depends_on)
make logs-user-service            # follow logs (compose service name)
make exec-user_service            # shell (container name uses underscores)
```

`db` must be healthy first — compose enforces this. The service is unreachable from the host by
design; exercise it through the API Gateway on `http://localhost:8001` or Nginx on
`https://localhost:8443` (nginx publishes `8000:80` and `8443:443`, `docker-compose.yml:11-13`).

Migrations (run for the whole platform by `make migration` → `scripts/run-migrations.sh:66-69`,
which runs user-service *after* auth-service):

```bash
docker exec ft_transcendence_user_service python manage.py makemigrations
docker exec ft_transcendence_user_service python manage.py migrate
```

The whole service directory is bind-mounted read-write, so edits to `.py` files are picked up by the
`runserver` autoreloader without a rebuild. Only `requirements.txt` changes require
`docker compose build user-service`.

Runtime image facts (`Dockerfile`): `python:3.11-slim`, apt `curl` + `postgresql-client`,
requirements baked at build time, non-root user `userservice` (uid 1000), `EXPOSE 3002`,
`CMD python manage.py runserver 0.0.0.0:3002`. No WSGI server is installed — `config/wsgi.py` exists
but `gunicorn`/`uwsgi` are not in `requirements.txt`; the container runs Django's development server.

## Testing

91 tests, all unit-level (`pytest` + `pytest-django`, `pytest.ini`). No test in this service calls
another service, so `docker compose run --rm` works everywhere.

```bash
# Full suite (91 tests) — starts db via depends_on if needed
docker compose run --rm user-service python -m pytest tests/ -v

# Via the platform orchestrator (prints "91" as a label; it is not asserted, scripts/run-unit-tests.sh:115-117)
./scripts/run-unit-tests.sh --user
make test user

# One file / one test
docker compose run --rm user-service python -m pytest tests/test_views.py -v
docker compose run --rm user-service python -m pytest tests/test_views.py::TestPetViewSet::test_create_pet_sets_user_id_from_header -v

# Coverage (pytest-cov is NOT in requirements.txt — install it in the container first)
docker exec ft_transcendence_user_service pip install pytest-cov
docker exec ft_transcendence_user_service python -m pytest tests/ --cov=apps --cov-report=html
```

| File | Tests | Covers |
|---|---|---|
| `tests/test_views.py` | 36 | All three ViewSets: `/users/me` GET/PUT/PATCH, cascade delete (incl. 401 and cross-user isolation), pet CRUD, ownership → 404, admin bypass, analyses list/create/retrieve, and a large block of 422 validation cases |
| `tests/test_serializers.py` | 18 | Profile/pet/analysis serializer field sets and every validator |
| `tests/test_models.py` | 12 | Field defaults, `user_id` uniqueness, species choices, `-created_at` ordering, `__str__` |
| `tests/test_utils.py` | 11 | Envelope shape, status codes, ISO-8601 `Z` timestamps |
| `tests/test_middleware.py` | 9 | Header extraction + role default, and `Custom404Middleware` rewriting HTML/DRF 404s while leaving 200/500 alone |
| `tests/test_permissions.py` | 5 | `IsOwnerOrAdmin` and `IsOwner` object permissions |

`tests/conftest.py` overrides pytest-django's `django_db_setup` with
`setup_databases(..., keepdb=False, serialize=False)` (`tests/conftest.py:6-35`): `django.contrib.auth`
is installed (DRF needs it) but `auth_user` lives in auth-service's schema, so the default
serialization step would fail. A fresh test database is created per session against the `db`
container — the DB must therefore be reachable even for "unit" tests.

Views are tested by calling `ViewSet.as_view({...})` with a bare `RequestFactory` request and setting
`request.user_id` / `request.user_role` manually, so the URLconf and middleware are not exercised by
`test_views.py`.

End-to-end coverage lives in `scripts/jupyter/test_user_service.ipynb`, which drives the real stack
through the gateway at `http://localhost:8001` with real cookies (including the auth-service cascade
deletion scenario). It writes to the production `smartbreeds` database.

## Troubleshooting

| Symptom | Cause | Fix / check |
|---|---|---|
| 500 on `POST /api/v1/pets` or `GET /api/v1/users/me` | `X-User-ID` missing → `user_id=None` → `NOT NULL` violation on insert | Call through the gateway; only `/api/v1/users/delete` returns a clean 401 (`apps/profiles/views.py:61`) |
| Empty list instead of an error on `GET /api/v1/pets` without the header | `filter(user_id=None)` becomes `user_id IS NULL` | Same as above |
| 404 for a pet you know exists | Ownership is enforced by queryset filtering, not by a 403 | Check `X-User-Role`; `admin` sees everything (`apps/profiles/views.py:101-103`) |
| 500 (or gateway-rewritten 404) for `/api/v1/pets/not-a-uuid` | `Pet.objects.get(pk=...)` raises Django's `ValidationError`, not `DoesNotExist`, and is not caught | Gateway converts HTML 500s containing `Not Found`/`DoesNotExist` to a JSON 404 (`srcs/api-gateway/routes/proxy.py:205-224`) |
| Gateway returns 404 `Service not found` for `/api/v1/analyses` | The prefix is absent from `SERVICE_ROUTES` | Reach it from inside `backend-network`, or add the prefix in the gateway |
| Gateway 503 (body reports `error.code: "HTTP_ERROR"`, with the intended `SERVICE_UNAVAILABLE` dict stringified into `error.message` by `srcs/api-gateway/main.py:20-30`) | No per-path timeout override for user paths → 30 s default; also raised when the container is down | `srcs/api-gateway/routes/proxy.py:13,113-116,145-157` |
| Account deletion fails in auth-service | The `DELETE /api/v1/users/delete` call returned non-200 or timed out (10 s) | `srcs/auth-service/apps/authentication/utils.py:179-194`; check user-service logs first |
| `DisallowedHost` / 400 on every request | Host header not in `ALLOWED_HOSTS` | Keep `user-service` and `localhost` in the list (`config/settings.py:13`) |
| Container stuck `unhealthy` | Healthcheck curls `http://localhost:3002/health`; fails if Django did not boot or `localhost` was removed from `ALLOWED_HOSTS` | `docker logs ft_transcendence_user_service` |
| `relation "pets" does not exist` | Migrations not applied to `user_schema` | `make migration`, or `docker exec ft_transcendence_user_service python manage.py migrate` |
| Malformed-JSON request returns `{"detail": ...}` instead of the envelope | DRF's parser exception bypasses `error_response` | Expected (`tests/test_views.py:630-646`) |
