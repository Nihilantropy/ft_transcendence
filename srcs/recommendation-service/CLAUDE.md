# CLAUDE.md - Recommendation Service

## Overview

FastAPI service on internal port 3005 (`ft_transcendence_recommendation_service`, no host
port, `backend-network` only, no compose profile → runs in both `local` and `cloud`).
It owns `recommendation_schema` (product catalogue) and scores pet↔product pairs with a
weighted cosine similarity over 15-dim feature vectors. Zero ML training, zero model files —
the "model" is `WEIGHT_VECTOR` built at import time in `src/config.py:22`.
The only outbound calls are user-service (HTTP) and PostgreSQL (asyncpg).

## Essential Commands

```bash
# Build / restart (no --reload; /app is bind-mounted, so a restart is enough for code edits)
docker compose build recommendation-service        # only needed after requirements.txt changes
docker compose restart recommendation-service      # needed after ANY src/ or config change

# Unit tests: 48. `run --rm` works, container need not be running.
docker compose run --rm recommendation-service python -m pytest tests/unit/ -v

# Integration tests: 23. MUST be docker exec — they resolve `api-gateway` by hostname.
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v

# All 71
docker exec ft_transcendence_recommendation_service python -m pytest tests/ -v

# Coverage (pytest-cov is in requirements.txt; target is `src`, not `.`)
docker compose run --rm recommendation-service python -m pytest tests/unit/ --cov=src --cov-report=term

# Shell
docker exec -it ft_transcendence_recommendation_service /bin/sh    # or: make exec-recommendation_service

# Env / schema sanity check (exits 1 on failure)
docker exec ft_transcendence_recommendation_service python scripts/validate_env.py

# Seeding — see Gotchas for --force semantics
docker compose run --rm recommendation-service python scripts/seed_products.py
docker exec ft_transcendence_recommendation_service python scripts/seed_products.py --force

# Migrations (raw SQL, no Alembic) — repo root
make migration
```

## Code Map

| Path | Responsibility |
|---|---|
| `src/main.py` | FastAPI app; includes both routers; defines `GET /health`. No lifespan, no middleware, no CORS. |
| `src/config.py` | `Settings` (pydantic-settings) + module-level `WEIGHT_VECTOR` / threshold / limit constants. |
| `src/routes/recommendations.py` | `GET /api/v1/recommendations/food` — the whole pipeline lives inline in this handler. |
| `src/routes/admin.py` | Product CRUD under `/api/v1/admin/products`. |
| `src/schemas/recommendations.py` | `PetProfile`, `NutritionalHighlights`, `RecommendationItem`, `RecommendationsResponse`. |
| `src/schemas/products.py` | `ProductCreate` / `ProductUpdate` / `ProductResponse` (three near-duplicate field lists). |
| `src/services/user_service_client.py` | `httpx` GET `{USER_SERVICE_URL}/api/v1/pets/{pet_id}` with `X-User-ID`, 10 s timeout. |
| `src/services/product_service.py` | All SQLAlchemy queries: `get_active_products`, `get_product_by_id`, create/update/soft-delete. |
| `src/services/feature_engineering.py` | `PetFeatureExtractor` / `ProductFeatureExtractor` → 15-element `np.ndarray`. |
| `src/services/similarity_engine.py` | Weighted cosine + threshold cut-off + descending ranking. |
| `src/models/product.py` | `Base` (declarative) + `Product`. Every other model imports `Base` from here. |
| `src/models/recommendation.py` | `Recommendation` table — declared and migrated, **never written**. |
| `src/models/user_feedback.py` | `UserFeedback` table — declared and migrated, **never written**. |
| `src/utils/database.py` | Async engine + `AsyncSessionLocal` + `get_db()` dependency. |
| `src/utils/responses.py` | `success_response` / `error_response` envelope builders. |
| `src/middleware/` | Empty package (`__init__.py` only). No middleware exists. |
| `migrations/` | `001_create_schema.sql` (schema + grants), `002_create_tables.sql` (3 tables + indexes). Applied by `scripts/run-migrations.sh` via `psql`. |
| `scripts/products.yaml` | 23 seed products (8 dog, 15 cat). Edit here, not in Python. |
| `scripts/seed_products.py` | YAML → `Product` rows. Idempotent unless `--force`. |
| `scripts/validate_env.py` | Asserts DB reachable + `recommendation_schema` + 3 tables. |
| `tests/unit/` | 48 tests, fully mocked. |
| `tests/integration/` | 23 tests through the real API Gateway + real DB. |

## Request / Data Flow

`GET /api/v1/recommendations/food?pet_id=…&limit=…&min_score=…`
(`src/routes/recommendations.py`, single handler, steps numbered in comments):

1. `x_user_id` header missing → `return error_response("UNAUTHORIZED", …)` — plain return, so
   **HTTP 200 with `success: false`** (:39-44).
2. `UserServiceClient().get_pet_profile(pet_id, user_id)` → `None` on any failure → raise
   `HTTPException(404, detail=error_response("PET_NOT_FOUND", …))` (:49-60).
3. Field-name bridge: `pet_data["age_months"] = pet_data.get("age")`,
   `pet_data["weight_kg"] = pet_data.get("weight")` (:64-65). user-service has no unit suffixes.
4. `ProductService(db).get_active_products(species=pet_data["species"])`. Empty → early 200 with
   `metadata.message = "No products available for this species"` (:72-95).
5. `PetFeatureExtractor().extract(dict)` and `ProductFeatureExtractor().extract(Product)` — note
   the asymmetric inputs: dict on the pet side, ORM object on the product side.
6. `SimilarityEngine().rank_products(...)` → `[(product_index, score)]` sorted descending, with
   sub-`MIN_SIMILARITY_THRESHOLD` entries already dropped.
7. Walk the ranked list: `break` on the first `score < min_score`, `break` when `rank > limit`,
   build `match_reasons` from two hard-coded rules, emit `RecommendationItem` (:109-146).
8. `success_response(RecommendationsResponse(...).dict())`.

Admin CRUD is a thin wrapper: schema → `ProductService` → `ProductResponse.from_orm(...).dict()`
→ `success_response(...)`, with a 404 `PRODUCT_NOT_FOUND` guard on the three `{product_id}`
routes.

## Conventions & Patterns

- **Full paths are composed**: `APIRouter(prefix=...)` at `routes/recommendations.py:15`
  (`/api/v1/recommendations`) and `routes/admin.py:12` (`/api/v1/admin`). No trailing slashes
  anywhere. The API Gateway matches both prefixes (`srcs/api-gateway/routes/proxy.py:46-47`);
  a new prefix here needs a matching entry in that dict or the gateway 404s.
- **Envelope everywhere**: return `success_response(data)` for 2xx and
  `raise HTTPException(status_code=..., detail=error_response(CODE, msg, details))` for errors.
  Never `return Response(success_response(...))` and never a bare dict.
- **No auth in this service.** The gateway validates the JWT and injects `X-User-ID` /
  `X-User-Role`. Ownership is enforced by user-service, which receives the forwarded `X-User-ID`.
  Nothing here reads `X-User-Role`.
- **DB access only through `ProductService`.** Routes never build a `select()`. `get_db` is
  injected with `Depends(get_db)`; the session commits inside `ProductService`, not in routes.
- **Thresholds and weights come from `Settings`, never from literals in service code.** New
  tunables go in `src/config.py` + `.env.example`, and get read through `settings.*`.
- **Schemas are hand-mirrored**: adding a `Product` column means touching five places —
  `migrations/002_create_tables.sql`, `src/models/product.py`, and all three classes in
  `src/schemas/products.py`. There is no shared base class.
- **Async everywhere**: SQLAlchemy `AsyncSession` + `asyncpg`, `httpx.AsyncClient`. Do not
  introduce a sync session — `psycopg2-binary` is listed in `requirements.txt` but no module
  imports it.
- Pydantic v1-style APIs are in use throughout (`.dict()`, `from_orm`, `class Config`).
  Match the surrounding style rather than mixing in `model_dump` / `model_validate`.

## Gotchas

- **`age` / `weight`, not `age_months` / `weight_kg`.** The user-service `Pet` model uses
  `age` (IntegerField) and `weight` (FloatField) with no unit suffix, and
  `PetCreateSerializer.fields` is `[name, species, breed, age, weight, health_conditions]` —
  DRF silently drops anything else. The mapping at `src/routes/recommendations.py:64-65` is the
  only bridge; if you touch it, both the pipeline and `PetProfile` break.
- **Null age/weight → 500.** Both fields are optional in user-service. `pet_data.get("age_months", 0)`
  returns `None` (the key exists), then `min(None / 200.0, 1.0)` raises `TypeError`
  (`src/services/feature_engineering.py:36-41`). The default `0` never applies.
- **Missing `X-User-ID` returns HTTP 200**, not 401 (`src/routes/recommendations.py:39-44`).
  Any test asserting a 401 here will fail.
- **Two independent score filters.** `MIN_SIMILARITY_THRESHOLD` (default 0.3) zeroes scores
  *inside* `SimilarityEngine.calculate_similarity` (`similarity_engine.py:45-47`) and
  `rank_products` then drops them; the request's `min_score` filters again in the route. A
  request with `min_score=0` still cannot see anything below 0.3.
- **`WEIGHT_VECTOR` is computed at import time** (`src/config.py:22-38`). Weight env changes
  need a container restart. Index 2 (`0.05`) and index 14 (`0.0`) are hard-coded literals, not
  settings — so `WEIGHT_INGREDIENT_PREFERENCES` is dead config and the ingredient dimension
  contributes nothing.
- **`include_inactive` on `GET /api/v1/admin/products` is a no-op.** The handler calls
  `get_active_products()`, which filters `is_active == True` in SQL
  (`src/services/product_service.py:32`), so the Python-side filter at `admin.py:52-53` can only
  ever remove rows. Single-product `GET` *does* return soft-deleted rows.
- **DELETE is a soft delete** (`is_active = False`) returning 204 with an empty body.
  Integration tests rely on the row still being readable afterwards.
- **`--force` seeding is a full table wipe.** `delete(Product)` with no `WHERE`
  (`scripts/seed_products.py:67`) drops admin-created rows too, and will hit a FK violation if
  `recommendations` / `user_feedback` ever contain rows.
- **`PyYAML` is not in `requirements.txt`** — `scripts/seed_products.py` imports `yaml` and only
  works because `uvicorn[standard]` pulls PyYAML in transitively. Do not drop the `[standard]`
  extra without adding an explicit pin.
- **`.env` is excluded from the image** (`.dockerignore`) even though `src/config.py:6` sets
  `env_file=".env"`. Config reaches the container via compose `env_file` plus the `/app`
  bind mount. A `docker run` of the bare image with no env vars fails at import with a
  pydantic `ValidationError` on `DATABASE_URL` / `USER_SERVICE_URL`.
- **`recommendations` and `user_feedback` tables are inert** and type `user_id` / `pet_id` as
  `INT` while the platform uses UUIDs. Do not assume they are usable persistence.
- **No logging anywhere.** `LOG_LEVEL` is declared but unused, `UserServiceClient` swallows all
  exceptions with a `# Log …` comment (`user_service_client.py:49-54`). Debugging an upstream
  failure means reproducing the call by hand, not reading logs.
- **`match_reasons` only covers two conditions** (`joint_health`, `sensitive_stomach`,
  `src/routes/recommendations.py:122-127`); the other four health flags affect the score but
  produce the `"Nutritionally compatible"` fallback.

## Testing Notes

- **There is no `conftest.py`** in this service. `tests/`, `tests/unit/` and `tests/integration/`
  each carry an `__init__.py`, which is what makes pytest's prepend import mode put `/app` on
  `sys.path` so `import src.…` resolves. Deleting those `__init__.py` files breaks collection.
- `pytest.ini` sets `asyncio_mode = auto` and registers the `unit` / `integration` / `asyncio`
  markers with `--strict-markers`; an unregistered marker is a hard error.
- Importing anything under `src` instantiates `Settings()` at import time, so unit tests still
  need `DATABASE_URL` and `USER_SERVICE_URL` present. Inside compose these come from `env_file`,
  which is why `docker compose run --rm` works and a bare host `pytest` does not.
- **DB mocking pattern** (`tests/unit/test_product_service.py:7-14`): `AsyncMock()` session with
  `execute` / `commit` / `refresh` as `AsyncMock`s, and a `MagicMock()` result whose
  `scalars.return_value.all.return_value` or `scalar_one_or_none.return_value` is set per test.
- **HTTP mocking pattern** (`tests/unit/test_user_service_client.py`):
  `patch('httpx.AsyncClient.get', new_callable=AsyncMock)`, returning a `Mock()` with
  `status_code` and `json.return_value`. Assert headers via `mock_get.call_args.kwargs`.
- Integration modules are module-scoped: `@pytest.mark.asyncio(scope="module")` on tests and
  `@pytest_asyncio.fixture(scope="module")` on `admin_auth` / `seeded_products` / `test_pet`.
  Fixtures named `test_user_auth` and `test_pet` start with `test_` but are fixtures — pytest
  does not collect them, which is why the file's 12 `def test_*` yield 10 tests.
- Integration prerequisites: `make up`, `make migration`, and `make superuser` (which creates
  exactly `test_admin@example.com` / `Password123!`, the constants both modules hard-code).
  Without the superuser the fixtures call `pytest.skip`, so you get skips, not failures.
  `make seed` is **not** required — each module seeds its own products through the admin API.
- Integration tests only soft-delete their products, so `recommendation_schema.products`
  accumulates `SeedBrand` rows across runs.
- **Rebuild rules:** existing files are picked up from the `/app` bind mount, so editing a test
  needs nothing. A *new* file is also visible through the mount for `docker exec`; only
  `requirements.txt` changes require `docker compose build recommendation-service`.
- `scripts/run-unit-tests.sh:129` records an expected count of `42` for this suite — stale, the
  real count is 48.

## Config & Thresholds

Every tunable lives in `src/config.py` as a `Settings` field and is mirrored in `.env.example`.
Do not hard-code a threshold, weight or limit in a route, service or extractor.

| Constant | Defined at | Default | Consumed at |
|---|---|---|---|
| `WEIGHT_VECTOR` | `src/config.py:22-38` | derived from the 5 weight settings | `similarity_engine.py:18` |
| `MIN_SIMILARITY_THRESHOLD` | `src/config.py:15,40` | `0.3` | `similarity_engine.py:19,45` |
| `DEFAULT_RECOMMENDATION_LIMIT` | `src/config.py:16,41` | `10` | `routes/recommendations.py:21` |
| `MAX_RECOMMENDATION_LIMIT` | `src/config.py:17,42` | `50` | `routes/recommendations.py:21` (`le=`) |
| breed weight (index 2) | `src/config.py:25` | `0.05` | hard-coded literal — no env var |
| ingredient weight (index 14) | `src/config.py:37` | `0.0` | hard-coded literal — `WEIGHT_INGREDIENT_PREFERENCES` is unused |
| user-service timeout | `src/services/user_service_client.py:10` | `10.0` s | constructor default — no env var |
| admin list `limit` bounds | `src/routes/admin.py:40` | `50`, `1..200` | hard-coded `Query(...)` |

Feature-vector normalisation divisors are also literals inside
`src/services/feature_engineering.py`: age ÷ 200 (:37, :99), weight ÷ 100 (:41, :110),
calories `(x - 250) / 250` (:142), life-stage cut-offs 84 and 12 months (:59, :63), and the
ingredient contributions 0.3 / 0.3 / 0.4 (:146-151). Changing any of them changes every stored
comparison, so update `tests/unit/test_feature_engineering.py` in the same edit.

`.env` is gitignored and may hold values that differ from `.env.example`; treat `.env.example`
and the `Settings` defaults as the source of truth when reasoning about behaviour.
