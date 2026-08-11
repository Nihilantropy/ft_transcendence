# Recommendation Service

FastAPI microservice that ranks pet-food products for a given pet using content-based
filtering. It converts a pet profile (fetched from user-service) and every active product
row into a 15-dimensional feature vector, scores each pair with a weighted cosine
similarity, and returns an explainable, ranked list. It also owns the product catalogue and
exposes CRUD endpoints for it. The service is stateless per request except for the
PostgreSQL `recommendation_schema` it owns; there is no ML training step and no model file —
the "model" is the weight vector built in `src/config.py:22`.

## Responsibilities

- Own `recommendation_schema` in the shared `smartbreeds` PostgreSQL database (`products`,
  `recommendations`, `user_feedback` tables).
- Serve `GET /api/v1/recommendations/food` — ranked food recommendations for one pet.
- Serve product CRUD under `/api/v1/admin/products` (create, list, read, update, soft delete).
- Fetch the pet profile from user-service over HTTP, forwarding `X-User-ID` so user-service
  enforces ownership.
- Turn pet attributes and product attributes into comparable 15-dim vectors
  (`src/services/feature_engineering.py`) and score them (`src/services/similarity_engine.py`).
- Attach human-readable `match_reasons` and `nutritional_highlights` to every recommendation.

Not responsible for: authentication, rate limiting, image analysis, or any write to the
`recommendations` / `user_feedback` tables (those tables exist in the migrations and as
SQLAlchemy models but no code path writes to them).

## Architecture

```
client ──► nginx (host 8000/8443) ──► api-gateway (host 8001)
                                   │  JWT validated, X-User-ID / X-User-Role added
                                   ├─ /api/v1/recommendations/* ─┐
                                   └─ /api/v1/admin/products/*  ─┤
                                                                 ▼
                                              recommendation-service:3005
                                                    │            │
                                          HTTP      │            │  asyncpg
                                     X-User-ID      ▼            ▼
                                        user-service:3002    postgres db:5432
                                                             (recommendation_schema)
```

| Aspect | Value | Source |
|---|---|---|
| Container name | `ft_transcendence_recommendation_service` | docker-compose.yml:324 |
| Internal port | 3005 — **no host port mapping** | Dockerfile:29, docker-compose.yml (no `ports:`) |
| Network | `backend-network` only | docker-compose.yml:326-327 |
| Compose profile | none declared → runs in **both** `local` and `cloud` | docker-compose.yml:320-338 |
| GPU | none | — |
| `depends_on` | `user-service` (plain, no health condition) | docker-compose.yml:328-329 |
| Volume | `./srcs/recommendation-service:/app` (full source bind mount) | docker-compose.yml:332-333 |
| Healthcheck | `curl -f http://localhost:3005/health`, 30s/10s/3 | docker-compose.yml:334-338 |

The gateway routes both prefixes to this service (`srcs/api-gateway/routes/proxy.py:46-47`).
Because the service has no host port, every request must arrive through the gateway (host
8001) or nginx (host 8000 → container 80, host 8443 → container 443; docker-compose.yml:12-13).

**Profile note:** nothing in this service depends on Ollama, LiteLLM or the
classification-service, so its behaviour is identical in the `local` and `cloud` profiles.

**Outbound dependencies**

| Target | Purpose | Timeout / retry |
|---|---|---|
| `user-service:3002` | `GET /api/v1/pets/{pet_id}` with `X-User-ID` header | 10.0 s default, no retries; every failure (timeout, connection error, non-200, `success != true`) collapses to `None` → 404 `PET_NOT_FOUND` (`src/services/user_service_client.py:10,38,49-54`) |
| PostgreSQL `db:5432` | product catalogue via SQLAlchemy async engine + asyncpg | no explicit timeout/pool settings (`src/utils/database.py:5`) |

The service calls user-service **directly**, not through the API Gateway.

## API Reference

All paths below are the full paths served by the app (router prefix + route path). No
trailing slashes. Auth is enforced upstream by the API Gateway (JWT in the `access_token`
HTTP-only cookie); this service performs no JWT validation of its own.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none (internal only) | liveness probe |
| GET | `/api/v1/recommendations/food` | JWT (gateway) + `X-User-ID` | ranked food recommendations for one pet |
| POST | `/api/v1/admin/products` | JWT (gateway) | create product → 201 |
| GET | `/api/v1/admin/products` | JWT (gateway) | list products |
| GET | `/api/v1/admin/products/{product_id}` | JWT (gateway) | fetch one product |
| PUT | `/api/v1/admin/products/{product_id}` | JWT (gateway) | update product |
| DELETE | `/api/v1/admin/products/{product_id}` | JWT (gateway) | soft delete → 204 |

> The admin routes' docstrings claim "Requires admin role (enforced by API Gateway)", but the
> gateway only validates the JWT and forwards `X-User-Role`; neither the gateway nor this
> service checks that the role is admin. Any authenticated user can call the admin endpoints.

### GET /api/v1/recommendations/food

Query parameters (`src/routes/recommendations.py:20-22`):

| Param | Type | Required | Default | Constraint |
|---|---|---|---|---|
| `pet_id` | str (UUID) | yes | — | — |
| `limit` | int | no | `DEFAULT_RECOMMENDATION_LIMIT` (10) | `1 <= limit <= MAX_RECOMMENDATION_LIMIT` (50) |
| `min_score` | float | no | `0.0` | `0.0 <= min_score <= 1.0` |

Headers: `X-User-ID` (injected by the gateway).

Success (200):

```json
{
  "success": true,
  "data": {
    "pet": {
      "id": "…uuid…", "name": "Max", "species": "dog", "breed": "golden_retriever",
      "age_months": 36, "weight_kg": 28.5, "health_conditions": ["joint_health"]
    },
    "recommendations": [
      {
        "product_id": 12, "name": "…", "brand": "…", "price": "75.00",
        "product_url": null, "image_url": null,
        "similarity_score": 0.91, "rank_position": 1,
        "match_reasons": ["Targets joint health"],
        "nutritional_highlights": {
          "protein_percentage": "28.00", "fat_percentage": "14.00", "calories_per_100g": 360
        }
      }
    ],
    "metadata": {
      "total_products_evaluated": 8,
      "products_above_threshold": 5,
      "recommendations_returned": 5
    },
    "algorithm_version": "content-based-v1.0"
  },
  "error": null,
  "timestamp": "…"
}
```

`metadata.products_above_threshold` and `recommendations_returned` are both `len(recommendations)`
after the `limit` cap (`src/routes/recommendations.py:164-168`), so "above threshold" is capped
by `limit` too.

If the catalogue holds no active product for the pet's species, the response is still 200 and
`metadata` is replaced by
`{"message": "No products available for this species", "total_products_evaluated": 0, "products_above_threshold": 0}`
(`src/routes/recommendations.py:89-93`).

Errors:

| Status | Body | Cause |
|---|---|---|
| 200 | envelope with `success: false`, `error.code = UNAUTHORIZED` | `X-User-ID` header missing — the handler returns `error_response(...)` without raising, so the HTTP status stays 200 (`src/routes/recommendations.py:39-44`) |
| 404 | `{"detail": {…envelope…, "error": {"code": "PET_NOT_FOUND", …}}}` | user-service returned non-200 / `success != true`, timed out, or was unreachable |
| 422 | FastAPI validation error | `limit` out of `[1, 50]`, `min_score` out of `[0, 1]`, missing `pet_id` |
| 401 | gateway envelope | no/invalid JWT — produced by the API Gateway, never reaches this service |

`match_reasons` is derived from exactly two rules (`src/routes/recommendations.py:122-127`):
`for_joint_health` + pet has `joint_health` → `"Targets joint health"`;
`for_sensitive_stomach` + pet has `sensitive_stomach` → `"Good for sensitive stomach"`;
otherwise the single fallback `"Nutritionally compatible"`. The other four health flags
influence the score but never produce a reason string.

### POST /api/v1/admin/products

Body = `ProductCreate` (`src/schemas/products.py:7-43`). Required: `name` (1-255),
`brand` (1-100), `target_species` (`dog`|`cat`). Everything else is optional; the eleven
boolean flags default to `false`. Numeric guards: `price >= 0`, `*_percentage` in `[0, 100]`,
`calories_per_100g > 0`, `min/max_age_months >= 0`, `min/max_weight_kg >= 0`.

Returns **201** with `success_response(ProductResponse)`. Fields not present on `ProductCreate`
(for example `is_active`) are silently ignored by Pydantic; `is_active` is forced to `True` by
`Product.__init__` (`src/models/product.py:116`). Invalid `target_species` → 422.

### GET /api/v1/admin/products

Query parameters (`src/routes/admin.py:38-40`):

| Param | Type | Default | Constraint |
|---|---|---|---|
| `species` | str | `None` | pattern `^(dog|cat)$` |
| `include_inactive` | bool | `false` | — |
| `limit` | int | `50` | `1 <= limit <= 200` |

Response: `{"success": true, "data": {"products": [...], "total": <len(products)>}, ...}`.
`total` is the size of the returned page, not the catalogue size.

> `include_inactive` has no effect: the handler calls `ProductService.get_active_products()`,
> which already filters `is_active == True` in SQL (`src/services/product_service.py:32`), so
> the subsequent Python-side filter can never add rows.

### GET / PUT / DELETE /api/v1/admin/products/{product_id}

`product_id` is an `int` path parameter. All three return
`{"detail": {…envelope with error.code = PRODUCT_NOT_FOUND…}}` and status **404** when the row
does not exist. `GET` reads with no `is_active` filter, so it can return soft-deleted rows.
`PUT` applies `ProductUpdate` with `exclude_unset=True` (only supplied keys are written).
`DELETE` sets `is_active = False` and returns **204** with an empty body — the row is never
removed.

### Error envelope

Success bodies and the handler-level error at `recommendations.py:39` use the platform
envelope from `src/utils/responses.py`:
`{"success", "data", "error": {"code", "message", "details"}, "timestamp"}`.
Errors raised via `HTTPException` nest that same envelope inside FastAPI's `detail` key, so a
404 body is `{"detail": {"success": false, …}}`. The API Gateway forwards JSON bodies
unchanged (it only rewrites HTML error pages), so clients see the `detail` wrapper.

## Recommendation Algorithm

Both extractors emit a 15-element `numpy` vector; the same index means the same concept on
both sides (`src/services/feature_engineering.py`).

| idx | Pet value | Product value | Weight (defaults) |
|---|---|---|---|
| 0 | `min(age_months / 200, 1.0)` | midpoint of `min/max_age_months` ÷ 200; `0.5` if both null | `WEIGHT_AGE_COMPATIBILITY` = 0.20 |
| 1 | `min(weight_kg / 100, 1.0)` | midpoint of `min/max_weight_kg` ÷ 100; `0.5` if both null | `WEIGHT_SIZE_COMPATIBILITY / 2` = 0.05 |
| 2 | `1.0` if `breed` else `0.5` | `1.0` if `suitable_breeds` else `0.5` | `0.05`, hard-coded at `src/config.py:25` |
| 3 | same as idx 1 | same as idx 1 | `WEIGHT_SIZE_COMPATIBILITY / 2` = 0.05 |
| 4 | `sensitive_stomach` ∈ health_conditions | `for_sensitive_stomach` | `WEIGHT_HEALTH_CONDITIONS` = 0.40 |
| 5 | `weight_management` | `for_weight_management` | 0.40 |
| 6 | `joint_health` | `for_joint_health` | 0.40 |
| 7 | `skin_allergies` | `for_skin_allergies` | 0.40 |
| 8 | `dental_health` | `for_dental_health` | 0.40 |
| 9 | `kidney_health` | `for_kidney_health` | 0.40 |
| 10 | always `0.0` (reserved) | always `0.0` (reserved) | 0.40 (no effect — both sides are 0) |
| 11 | protein need by life stage | `protein_percentage / 100` | `WEIGHT_NUTRITIONAL_PROFILE / 2` = 0.10 |
| 12 | fat need by life stage | `fat_percentage / 100` | `WEIGHT_NUTRITIONAL_PROFILE / 4` = 0.05 |
| 13 | calorie need by life stage | `min((calories_per_100g - 250) / 250, 1.0)` | `WEIGHT_NUTRITIONAL_PROFILE / 4` = 0.05 |
| 14 | always `0.0` | `grain_free` 0.3 + `organic` 0.3 + `hypoallergenic` 0.4, capped at 1.0 | `0.0`, hard-coded at `src/config.py:37` |

Life stage buckets for indices 11-13 (`feature_engineering.py:59-70`):
senior `age_months > 84` → `(0.8, 0.6, 0.7)`; puppy `age_months < 12` → `(0.9, 0.8, 0.9)`;
adult otherwise → `(0.7, 0.5, 0.6)`.

Scoring (`src/services/similarity_engine.py`):

1. Multiply both vectors element-wise by `WEIGHT_VECTOR`.
2. `sklearn.metrics.pairwise.cosine_similarity` on the two weighted vectors.
3. If the result is `< MIN_SIMILARITY_THRESHOLD` (default 0.3) the score is forced to `0.0`
   (`similarity_engine.py:45-47`).
4. `rank_products` drops every zero score and sorts descending (`similarity_engine.py:66-71`).
5. The route walks the sorted list, stops at the first score `< min_score`, and caps at `limit`
   (`src/routes/recommendations.py:111-116`).

`WEIGHT_INGREDIENT_PREFERENCES` is declared in `Settings` (`src/config.py:14`) but is not used
to build `WEIGHT_VECTOR` — index 14 is hard-coded to `0.0`, so ingredient flags currently
contribute nothing to the score.

`WEIGHT_VECTOR` is built once at import time. Changing any weight env var requires a container
restart, not just a new request.

## Data Model

Schema `recommendation_schema` in the shared `smartbreeds` database. DDL lives in raw SQL
(`migrations/001_create_schema.sql`, `migrations/002_create_tables.sql`) — there is no Alembic
and the app never runs `create_all`. SQLAlchemy models mirror the DDL and all declare
`{"schema": "recommendation_schema"}`.

### `products` (`src/models/product.py`)

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | SERIAL | no | PK |
| `name` | VARCHAR(255) | no | |
| `brand` | VARCHAR(100) | no | |
| `description` | TEXT | yes | |
| `price` | DECIMAL(10,2) | yes | |
| `product_url`, `image_url` | VARCHAR(500) | yes | |
| `target_species` | VARCHAR(20) | no | CHECK `IN ('dog','cat')` |
| `min_age_months`, `max_age_months` | INT | yes | CHECK `>= 0`, CHECK `min <= max` |
| `min_weight_kg`, `max_weight_kg` | DECIMAL(5,2) | yes | CHECK `>= 0`, CHECK `min <= max` |
| `suitable_breeds` | TEXT[] | yes | GIN index |
| `protein_percentage`, `fat_percentage`, `fiber_percentage` | DECIMAL(5,2) | yes | CHECK `0..100` |
| `calories_per_100g` | INT | yes | CHECK `> 0` |
| `grain_free`, `organic`, `hypoallergenic`, `limited_ingredient`, `raw_food` | BOOLEAN | no | default `false` |
| `for_sensitive_stomach`, `for_weight_management`, `for_joint_health`, `for_skin_allergies`, `for_dental_health`, `for_kidney_health` | BOOLEAN | no | default `false` |
| `created_at`, `updated_at` | TIMESTAMP | no | `CURRENT_TIMESTAMP`; `updated_at` also has `onupdate` in the ORM |
| `is_active` | BOOLEAN | no | default `true`; soft-delete flag |

Indexes: `idx_products_species`, `idx_products_active`, `idx_products_brand`,
`idx_products_suitable_breeds` (GIN).

### `recommendations` (`src/models/recommendation.py`)

`id`, `user_id INT`, `pet_id INT`, `product_id INT → products.id`,
`similarity_score DECIMAL(5,4)` CHECK `0..1`, `rank_position INT` CHECK `> 0`, `created_at`.
Indexes on `(user_id, pet_id)` and `created_at`. **No code writes to this table.**

### `user_feedback` (`src/models/user_feedback.py`)

`id`, `user_id INT`, `pet_id INT`, `product_id INT → products.id`,
`interaction_type VARCHAR(20)` CHECK `IN ('click','view','purchase','rating')`,
`interaction_value DECIMAL(3,2)` (CHECK: 1.0-5.0 for ratings, `>= 0` otherwise),
`similarity_score DECIMAL(5,4)`, `created_at`. **No code writes to this table.**

> Both history tables type `user_id` and `pet_id` as `INT`, while auth-service and
> user-service use UUID primary keys (`srcs/user-service/apps/profiles/models.py:47-48`).
> They are unusable as-is.

## Configuration

Settings are read by `pydantic-settings` in `src/config.py`. `.env` is gitignored and is
excluded from the image by `.dockerignore`; values reach the container through
`env_file: ./srcs/recommendation-service/.env` in docker-compose.yml:330-331 and through the
bind mount at `/app/.env`.

| Variable | Read at | Code default | `.env.example` | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | `src/config.py:8` | **required** | `postgresql+asyncpg://…@db:5432/smartbreeds` | async SQLAlchemy DSN; must use the `asyncpg` driver |
| `USER_SERVICE_URL` | `src/config.py:9` | **required** | `http://user-service:3002` | base URL for the pet-profile lookup |
| `WEIGHT_HEALTH_CONDITIONS` | `src/config.py:10` | `0.40` | `0.40` | weight for indices 4-10 |
| `WEIGHT_AGE_COMPATIBILITY` | `src/config.py:11` | `0.20` | `0.20` | weight for index 0 |
| `WEIGHT_NUTRITIONAL_PROFILE` | `src/config.py:12` | `0.20` | `0.20` | split ½ / ¼ / ¼ over indices 11-13 |
| `WEIGHT_SIZE_COMPATIBILITY` | `src/config.py:13` | `0.10` | `0.10` | split in half over indices 1 and 3 |
| `WEIGHT_INGREDIENT_PREFERENCES` | `src/config.py:14` | `0.10` | `0.10` | declared but **not used** in `WEIGHT_VECTOR` |
| `MIN_SIMILARITY_THRESHOLD` | `src/config.py:15` | `0.3` | `0.3` | scores below this become `0.0` and are dropped |
| `DEFAULT_RECOMMENDATION_LIMIT` | `src/config.py:16` | `10` | `10` | default `limit` query value |
| `MAX_RECOMMENDATION_LIMIT` | `src/config.py:17` | `50` | `50` | upper bound validated on `limit` |
| `LOG_LEVEL` | `src/config.py:18` | `"INFO"` | `INFO` | declared but **not used** — the service configures no logging |

`scripts/seed_products.py:53-56` reads `DATABASE_URL` directly via `os.getenv` with its own
hard-coded fallback DSN; `scripts/validate_env.py:12` reads it with no fallback.

Two constants are not configurable: the breed weight (`0.05`, `src/config.py:25`) and the
ingredient weight (`0.0`, `src/config.py:37`).

## Running

```bash
# From the repo root
docker compose build recommendation-service
docker compose up -d recommendation-service     # pulls in user-service via depends_on

# Or the whole stack
make up                                          # profile from COMPOSE_PROFILES
```

Order of operations for a usable service:

```bash
make up                                          # start the stack
make migration                                   # scripts/run-migrations.sh; step 6 pipes
                                                 # both .sql files into ft_transcendence_db
make seed                                        # scripts/seed-db.sh → seed_products.py
```

Sanity checks (all from inside the container — there is no host port):

```bash
docker exec ft_transcendence_recommendation_service curl -sf http://localhost:3005/health
docker exec ft_transcendence_recommendation_service python scripts/validate_env.py
```

`validate_env.py` asserts the DB connection works and that `recommendation_schema` plus all
three tables exist; it exits `1` on failure.

The container runs `uvicorn src.main:app --host 0.0.0.0 --port 3005` (Dockerfile:32) with **no**
`--reload`, and `/app` is bind-mounted from the host. Editing source therefore takes effect only
after `docker compose restart recommendation-service`. Changing `requirements.txt` requires
`docker compose build recommendation-service`.

Image facts (Dockerfile): base `python:3.12-slim`; apt packages `gcc g++ libpq-dev curl`
(curl exists because the compose healthcheck uses it); dependencies installed from
`requirements.txt` only — nothing is pinned outside it; non-root user `appuser` (uid 1000);
`EXPOSE 3005`; there is no `HEALTHCHECK` instruction in the Dockerfile, only in compose.

### Seeding products

Product rows live in `scripts/products.yaml` (23 products: 8 `dog`, 15 `cat`). Edit the YAML,
never the Python.

```bash
# Idempotent: prints a warning and does nothing if any product row exists
docker compose run --rm recommendation-service python scripts/seed_products.py

# Destructive: DELETE FROM products, then re-insert everything from products.yaml
docker exec ft_transcendence_recommendation_service python scripts/seed_products.py --force
```

`--force` issues a bare `delete(Product)` with no `WHERE` (`scripts/seed_products.py:67`), so it
removes **every** product row including ones created through the admin API, and — because
`recommendations.product_id` / `user_feedback.product_id` are FKs to `products.id` — it will
fail with a FK violation if either history table ever holds rows.

YAML entries accept exactly the `Product` column names. Omitted booleans default to `false`;
`price`, `min/max_weight_kg` and the three `*_percentage` fields are converted to `Decimal`
(`scripts/seed_products.py:25-32`). `is_active`, `product_url`, `image_url`, `organic` and
`raw_food` are not set by any current YAML entry.

## Testing

71 tests total: **48 unit** + **23 integration**.

```bash
# Unit tests (48) — `run --rm` is fine, nothing crosses the network
docker compose run --rm recommendation-service python -m pytest tests/unit/ -v

# Integration tests (23) — MUST use docker exec on a running container:
# they resolve the `api-gateway` hostname, which `run --rm` cannot do
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v

# Everything (71)
docker exec ft_transcendence_recommendation_service python -m pytest tests/ -v

# One file / one test
docker compose run --rm recommendation-service python -m pytest tests/unit/test_similarity_engine.py -v
docker exec ft_transcendence_recommendation_service python -m pytest \
  tests/integration/test_recommendations_e2e.py::test_get_recommendations_success -v

# Coverage (pytest-cov is in requirements.txt)
docker compose run --rm recommendation-service python -m pytest tests/unit/ --cov=src --cov-report=term
```

Repo-level shortcuts:

```bash
make test recommendation      # → scripts/init-and-test.sh --recommendation → unit tests only
make test-integration         # → scripts/run-integration-tests.sh (docker exec, integration only)
```

> `scripts/run-unit-tests.sh:129` still asserts an expected count of `42` for this suite; the
> real unit count is 48.

### Unit tests (`tests/unit/`, no network, no DB)

| File | Tests | Covers |
|---|---|---|
| `test_config.py` | 3 | `Settings` env loading, `WEIGHT_VECTOR` length 15, health weights dominate |
| `test_feature_engineering.py` | 18 | both extractors: age/weight normalisation and caps, health flags, life-stage nutrition, age/weight range fallbacks, ingredient score capping |
| `test_models.py` | 4 | `Product` construction, boolean defaults, nullable age range, `Recommendation` construction |
| `test_product_service.py` | 6 | every `ProductService` method against an `AsyncMock` session |
| `test_responses.py` | 2 | `success_response` / `error_response` envelope shape |
| `test_similarity_engine.py` | 10 | identical/orthogonal vectors, weighting, threshold cut-off, ranking order, indices, empty input |
| `test_user_service_client.py` | 5 | 200 success, 404, `X-User-ID` header, timeout, generic exception |

### Integration tests (`tests/integration/`, real gateway + real DB)

`test_admin_e2e.py` (13) — full CRUD through the gateway, species filter, `limit`, soft-delete
verification, 404s, 422 validation, 401 when unauthenticated.
`test_recommendations_e2e.py` (10) — recommendations for a dog and for a cat, health-condition
prioritisation, species filtering, `limit`, `min_score`, match reasons, nutritional highlights,
401 unauthenticated, and 403/404 for a `pet_id` the caller does not own.

Prerequisites (missing any of these makes the suite skip or fail):

```bash
make up
make migration
make superuser        # creates test_admin@example.com / Password123! — exactly the
                      # credentials both integration modules expect
```

Both modules build their own product fixtures through the admin API and soft-delete them on
teardown, so `make seed` is **not** required for them. `test_recommendations_e2e.py` registers
`recotest@example.com`, creates pets, and calls `DELETE /api/v1/users/delete` on teardown; the
auth record survives so re-runs log in instead of registering. Products created by the fixtures
are only soft-deleted, so rows accumulate in `recommendation_schema.products` across runs.

Both fixtures call `pytest.skip(...)` when the admin login fails, so a missing superuser shows
up as skips, not failures.

## Troubleshooting

**404 `PET_NOT_FOUND` for a pet that exists.** `UserServiceClient.get_pet_profile` swallows
every failure into `None` (`src/services/user_service_client.py:47-54`), so this one code path
also covers: user-service down, a >10 s response, a network error, and a pet owned by another
user. Check user-service directly:
`docker exec ft_transcendence_recommendation_service curl -s -H "X-User-ID: <uuid>" http://user-service:3002/api/v1/pets/<pet_id>`.

**500 on a pet with no age or weight.** `age` and `weight` are optional on user-service's pet
model and serializer. The route copies them into `age_months` / `weight_kg` unconditionally
(`src/routes/recommendations.py:64-65`) and `PetFeatureExtractor.extract` then computes
`min(None / 200.0, 1.0)`, raising `TypeError`. Give the pet an age and weight.

**Empty `recommendations` array with a populated catalogue.** Three independent filters can
empty it: species mismatch (`get_active_products(species=…)`), the global
`MIN_SIMILARITY_THRESHOLD` (0.3) zeroing scores inside the engine, and the caller's `min_score`.
Re-request with `min_score=0` and inspect `metadata.total_products_evaluated` — if it is `0`,
no active product matches the species.

**`"No products available for this species"` in `metadata`.** The catalogue has no
`is_active = true` row with that `target_species`. Run `make seed` (dog + cat rows), or check
`GET /api/v1/admin/products?species=dog`.

**`⚠️ Skipping seed: N products already exist.`** Expected — the seeder is idempotent. Use
`--force` only if you accept losing every existing product row.

**`UNAUTHORIZED` in the body but HTTP 200.** The gateway did not inject `X-User-ID`, which in
practice means the request bypassed the gateway. Call through 8001 or nginx.

**Container unhealthy / `curl` failing.** The compose healthcheck hits
`http://localhost:3005/health`. The endpoint returns `{"status": "healthy", "service":
"recommendation-service"}` and does not touch the database, so a healthy container says nothing
about DB reachability — use `scripts/validate_env.py` for that.

**Code edits have no effect.** No `--reload`: `docker compose restart recommendation-service`.
New dependency: `docker compose build recommendation-service`.

**`relation "recommendation_schema.products" does not exist`.** Migrations were never applied.
Run `make migration`, or pipe the two SQL files manually:
`docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql`.

**Integration tests fail with a DNS/connection error on `api-gateway`.** They were started with
`docker compose run --rm`. Use `docker exec ft_transcendence_recommendation_service …` instead.
