# PostgreSQL Database (`db`)

The single PostgreSQL instance backing every stateful service in SmartBreeds. The platform uses
**one logical database, `smartbreeds`**, split into per-service **schemas** rather than one database
per service. Each service owns exactly one schema and reaches other services' data only through
their REST APIs — never with cross-schema SQL. The container is not published on the host: it is
reachable only as `db:5432` on the internal `backend-network`.

## Responsibilities

- Host the `smartbreeds` database and the `smartbreeds_user` role.
- Create the four service schemas on first boot (`srcs/db/init-scripts/01-init-schemas.sql`).
- Persist all relational state for auth-service, user-service and recommendation-service.
- Expose a readiness signal (`pg_isready`) that `auth-service` and `user-service` gate their startup on.

Explicitly **not** its job: vector storage (the AI Service uses ChromaDB in the `ai-chroma-data`
volume), caching / rate limiting (Redis), or session storage.

## Architecture

| Fact | Value | Source |
|------|-------|--------|
| Compose service | `db` | `docker-compose.yml:247` |
| Container name | `ft_transcendence_db` | `docker-compose.yml:248` |
| Image | `postgres:15-alpine` | `docker-compose.yml:249` |
| Network | `backend-network` only | `docker-compose.yml:255-256` |
| Host port | **none** — internal `db:5432` only | no `ports:` key in the `db` block |
| Profiles | none → runs in **both** `local` and `cloud` | no `profiles:` key |
| Restart policy | `on-failure` | `docker-compose.yml:257` |
| Log rotation | json-file, 5 MB × 2 files | `docker-compose.yml:264-268` |
| Healthcheck | `pg_isready -U ... -d ...`, 10s interval, 5s timeout, 5 retries, 10s start period | `docker-compose.yml:258-263` |

### Volumes

| Mount | Target | Purpose |
|-------|--------|---------|
| `db-data` (named volume `ft_transcendence_db-data`) | `/var/lib/postgresql/data` | Persistent `PGDATA` |
| `./srcs/db/init-scripts` (bind, `:ro`) | `/docker-entrypoint-initdb.d` | First-boot SQL bootstrap |

### Who connects

| Service | Driver | Schema (`search_path` / SQLAlchemy) | Config location |
|---------|--------|-------------------------------------|-----------------|
| auth-service | Django ORM (psycopg2-binary) | `-c search_path=auth_schema,public` | `srcs/auth-service/config/settings.py:64-77` (`search_path` at `:73`) |
| user-service | Django ORM (psycopg2-binary) | `-c search_path=user_schema,public` | `srcs/user-service/config/settings.py:68-81` (`search_path` at `:77`) |
| recommendation-service | SQLAlchemy async + asyncpg | `{"schema": "recommendation_schema"}` as the last element of `__table_args__` | `srcs/recommendation-service/src/models/product.py:54`, `recommendation.py:17`, `user_feedback.py:21` |
| ai-service | — | does not use PostgreSQL | — |

`auth-service` and `user-service` declare `depends_on: db: condition: service_healthy`
(`docker-compose.yml:198-200`, `222-224`). `recommendation-service` does **not** declare any
dependency on `db` (`docker-compose.yml:328-329`).

## Directory Contents

| Path | Role |
|------|------|
| `init-scripts/01-init-schemas.sql` | Schema bootstrap, executed once by the postgres entrypoint |
| `config/servers.json` | pgAdmin connection profile — consumed only by the **commented-out** `pgadmin` service (`docker-compose.yml:269-284`) |
| `.env.example` | Template for `srcs/db/.env` (gitignored, loaded via `env_file`) |

## Data Model

The database name is `smartbreeds` in every environment. Schemas:

| Schema | Owner service | Created by | Tables |
|--------|---------------|-----------|--------|
| `auth_schema` | auth-service | `init-scripts/01-init-schemas.sql:7` | `users`, `refresh_tokens` |
| `user_schema` | user-service | init script (`:10`) **and** `srcs/user-service/apps/profiles/migrations/0001_initial.py:12-15` | `user_profiles`, `pets`, `pet_analyses` |
| `recommendation_schema` | recommendation-service | init script (`:16`) **and** `srcs/recommendation-service/migrations/001_create_schema.sql` | `products`, `recommendations`, `user_feedback` |
| `ai_schema` | — | init script (`:13`) | **empty** — created but no service reads or writes it |

Django's `django_migrations` bookkeeping table plus the `django_content_type` / `auth_*` framework
tables land inside each Django service's own schema, following its `search_path`.

### `auth_schema` — `srcs/auth-service/apps/authentication/models.py`

`users` (`db_table = 'users'`, `models.py:67`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `uuid.uuid4` default, non-editable |
| `email` | varchar(255) | unique, indexed |
| `password` | varchar(128) | argon2 hash (from `AbstractBaseUser`) |
| `first_name`, `last_name` | varchar(150) | blank allowed |
| `role` | varchar(20) | `user` \| `admin`, default `user` |
| `is_active`, `is_verified` | bool | default `True` |
| `is_staff`, `is_superuser` | bool | default `False` |
| `last_login` | timestamptz | nullable |
| `created_at`, `updated_at` | timestamptz | `auto_now_add` / `auto_now` |

Indexes: `email`, `created_at`. `USERNAME_FIELD = 'email'`, `REQUIRED_FIELDS = []`.

`refresh_tokens` (`db_table = 'refresh_tokens'`, `models.py:98`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users.id` | `on_delete=CASCADE` |
| `token_hash` | varchar(64) | unique, SHA-256 of the refresh token |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `last_used_at` | timestamptz | nullable |
| `is_revoked` | bool | default `False` |

Indexes: `token_hash`, `(user, is_revoked)`, `expires_at`.
Because of the CASCADE, deleting one user row deletes its refresh tokens too — Django's
`queryset.delete()` therefore reports more rows than users deleted.

Migrations: `0001_initial.py` (User), `0002_refreshtoken.py`.

### `user_schema` — `srcs/user-service/apps/profiles/models.py`

`user_profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID | unique, indexed — **soft** reference to `auth_schema.users.id`, no FK constraint |
| `phone` | varchar(20) | blank allowed |
| `address` | jsonb | nullable |
| `preferences` | jsonb | default `{}` |
| `created_at`, `updated_at` | timestamptz | |

`pets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID | indexed, soft reference to `auth_schema.users.id` |
| `name` | varchar(100) | |
| `breed` | varchar(100) | blank allowed |
| `breed_confidence` | float | nullable |
| `species` | varchar(10) | `dog` \| `cat` \| `other`, default `dog` (`migrations/0003_alter_pet_species.py`) |
| `age` | int | nullable |
| `weight` | float | nullable |
| `health_conditions` | jsonb | default `[]` |
| `image_url` | varchar(500) | nullable |
| `created_at`, `updated_at` | timestamptz | |

Indexes: `(user_id, created_at)`, `species`.

`pet_analyses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `pet_id`, `user_id` | UUID | indexed, soft references |
| `image_url` | varchar(500) | |
| `breed_detected` | varchar(100) | |
| `confidence` | float | |
| `traits` | jsonb | default `{}` |
| `raw_response` | jsonb | nullable — full AI Service payload |
| `created_at` | timestamptz | default ordering `-created_at` |

Indexes: `(pet_id, created_at)`, `(user_id, created_at)`.

Migrations: `0001_initial.py` (creates `user_schema` + all three tables), `0002_…` (index renames,
PK field tweaks), `0003_alter_pet_species.py`.

### `recommendation_schema` — `srcs/recommendation-service/migrations/002_create_tables.sql`

`products` — `id SERIAL PK`, plus:

| Group | Columns |
|-------|---------|
| Basic | `name` varchar(255) NOT NULL, `brand` varchar(100) NOT NULL, `description` text, `price` numeric(10,2), `product_url` varchar(500), `image_url` varchar(500) |
| Targeting | `target_species` varchar(20) NOT NULL CHECK in (`dog`,`cat`), `min_age_months`/`max_age_months` int ≥ 0, `min_weight_kg`/`max_weight_kg` numeric(5,2) ≥ 0, `suitable_breeds text[]` |
| Nutrition | `protein_percentage`, `fat_percentage`, `fiber_percentage` numeric(5,2) in [0,100], `calories_per_100g` int > 0 |
| Ingredient flags | `grain_free`, `organic`, `hypoallergenic`, `limited_ingredient`, `raw_food` — bool NOT NULL default false |
| Health targeting | `for_sensitive_stomach`, `for_weight_management`, `for_joint_health`, `for_skin_allergies`, `for_dental_health`, `for_kidney_health` — bool NOT NULL default false |
| Metadata | `created_at`, `updated_at` timestamp default `CURRENT_TIMESTAMP`, `is_active` bool default true |

Table constraints: `valid_age_range` and `valid_weight_range` (min ≤ max when both present).
Indexes: `target_species`, `is_active`, `brand`, and a **GIN** index on `suitable_breeds`.

`recommendations` — `id SERIAL PK`, `user_id int`, `pet_id int`, `product_id int → products.id`,
`similarity_score numeric(5,4)` CHECK in [0,1], `rank_position int > 0`, `created_at`.
Indexes: `(user_id, pet_id)`, `created_at`.

`user_feedback` — `id SERIAL PK`, `user_id int`, `pet_id int`, `product_id int → products.id`,
`interaction_type varchar(20)` CHECK in (`click`,`view`,`purchase`,`rating`), `interaction_value numeric(3,2)`,
`similarity_score numeric(5,4)`, `created_at`. Constraint `valid_interaction_value`: ratings must be
1.0–5.0, other interaction types must be ≥ 0. Indexes: `product_id`, `created_at`.

Note the type mismatch across schemas: `recommendation_schema` stores `user_id` / `pet_id` as `INT`
while `user_schema` and `auth_schema` use `UUID`.

## Init Scripts

`init-scripts/01-init-schemas.sql` is mounted read-only into `/docker-entrypoint-initdb.d`. The
official postgres entrypoint runs everything in that directory **only when `PGDATA` is empty**, i.e.
on the very first boot of the `db-data` volume. Re-running it later requires `make downv` (destroys
the volume) or applying it manually with `psql`.

What it does, in order:

1. `\c smartbreeds` — switch to the application database (line 4).
2. `CREATE SCHEMA IF NOT EXISTS` for `auth_schema`, `user_schema`, `ai_schema`,
   `recommendation_schema`, each `AUTHORIZATION smartbreeds_user` (lines 7-16).
3. `GRANT ALL PRIVILEGES` on those four schemas to `smartbreeds_user` (lines 19-22).
4. `ALTER ROLE smartbreeds_user SET search_path TO auth_schema, user_schema, ai_schema,
   recommendation_schema, public` (line 25) — the role-level default. Both Django services override
   it per-connection via `OPTIONS.options`, so this default mainly affects interactive `psql` sessions.

The script **hardcodes** the database name `smartbreeds` and the role `smartbreeds_user`; changing
`POSTGRES_DB` / `POSTGRES_USER` without editing the SQL makes first boot fail.

Schema creation is not fully idempotent across the two mechanisms: `user_schema` and
`recommendation_schema` are also created by their services' own migrations, but `auth_schema` exists
only because of this init script.

## Configuration

Values below come from `srcs/db/.env.example`. The real `srcs/db/.env` is gitignored (`.gitignore:7-13`)
and is what `env_file` actually loads (`docker-compose.yml:250-251`).

| Variable | `.env.example` value | Purpose |
|----------|---------------------|---------|
| `POSTGRES_DB` | `smartbreeds` | Database created on first boot |
| `POSTGRES_USER` | `smartbreeds_user` | Superuser role created on first boot |
| `POSTGRES_PASSWORD` | `smartbreeds_password` | Password for that role |
| `POSTGRES_INITDB_ARGS` | `"--encoding=UTF8"` | Extra `initdb` flags |

**Healthcheck interpolation caveat.** The healthcheck reads
`${POSTGRES_USER-smartbreeds_user}` / `${POSTGRES_DB-smartbreeds}` (`docker-compose.yml:259`).
Compose interpolates those from the shell and the **root** `.env`, not from `srcs/db/.env` —
`env_file` only populates the container's environment. Changing the user or database name in
`srcs/db/.env` alone leaves the healthcheck probing the old defaults, so the container never becomes
healthy and every `depends_on: service_healthy` blocks.

### Client-side defaults (hardcoded in code, used when the env var is absent)

| Service | Variable | Code default | File:line |
|---------|----------|--------------|-----------|
| auth-service | `DB_NAME` | `smartbreeds` | `config/settings.py:67` |
| auth-service | `DB_USER` | `smartbreeds_user` | `config/settings.py:68` |
| auth-service | `DB_PASSWORD` | `smartbreeds_password` | `config/settings.py:69` |
| auth-service | `DB_HOST` | `db` | `config/settings.py:70` |
| auth-service | `DB_PORT` | `5432` | `config/settings.py:71` |
| user-service | `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | same values | `config/settings.py:71-75` |
| recommendation-service | `DATABASE_URL` | **no default — required** | `src/config.py:8` |

`srcs/recommendation-service/.env.example:2` shows the expected DSN shape:
`postgresql+asyncpg://smartbreeds_user:smartbreeds_password@db:5432/smartbreeds`.
`scripts/seed_products.py:54-55` falls back to that same DSN when `DATABASE_URL` is unset.

## Running

```bash
# Start just the database
docker compose up db -d

# Full stack (db comes up as a dependency of auth-service / user-service)
make up

# Apply all migrations in the required order (auth → user → recommendation)
make migration          # wraps scripts/run-migrations.sh

# Seed product catalogue
make seed               # wraps scripts/seed-db.sh
```

`scripts/run-migrations.sh` waits on `pg_isready` (line 20), then runs
`manage.py makemigrations && migrate` inside auth-service, then user-service, then pipes
`001_create_schema.sql` and `002_create_tables.sql` into `psql` for the recommendation schema
(lines 91-92). The order matters: user-service data soft-references `auth_schema.users`.

Destroying and rebuilding from scratch (this is the only way to re-trigger the init script):

```bash
make downv              # docker compose down -v — drops db-data
make up && make migration
```

## Operations

```bash
# Interactive psql
docker exec -it ft_transcendence_db psql -U smartbreeds_user -d smartbreeds

# List schemas / tables
docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c '\dn'
docker exec ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c '\dt auth_schema.*'

# Readiness probe (same command the healthcheck runs)
docker exec ft_transcendence_db pg_isready -U smartbreeds_user -d smartbreeds

# Logical dump / restore
docker exec ft_transcendence_db pg_dump -U smartbreeds_user smartbreeds > backup.sql
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < backup.sql
```

pgAdmin is available as a commented-out block (`docker-compose.yml:269-284`) wired to
`config/servers.json`. That file contains a plaintext password and the block hardcodes credentials —
move both out before re-enabling it.

## Testing

There is no test suite for this directory; it is validated indirectly by the services that use it.

```bash
# Django services: pytest-django creates an isolated test database
# (named after DB_NAME with a "test_" prefix) at runtime
docker compose run --rm auth-service python -m pytest tests/ -v
docker compose run --rm user-service python -m pytest tests/ -v

# recommendation-service unit tests (no DB access)
docker compose run --rm recommendation-service python -m pytest tests/unit/ -v

# recommendation-service E2E — hits the LIVE smartbreeds database through the API Gateway
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v

# Schema / connectivity sanity check for the recommendation schema
docker exec ft_transcendence_recommendation_service python scripts/validate_env.py
```

Notes derived from the test config:

- `srcs/auth-service/pytest.ini` sets `--reuse-db`, so the auth test database survives between runs;
  drop it manually if a migration changes shape unexpectedly.
- `srcs/user-service/tests/conftest.py:6-35` overrides `django_db_setup` with `serialize=False` and
  `keepdb=False`, because `django.contrib.auth`'s tables do not exist in `user_schema` (they live in
  `auth_schema`) and serialization would fail.
- The recommendation integration suite targets `http://api-gateway:8001`
  (`tests/integration/test_admin_e2e.py:20`) and therefore mutates real rows in `smartbreeds`.
  No separate test or staging database is provisioned.

## Troubleshooting

| Symptom | Likely cause | Check / fix |
|---------|--------------|-------------|
| `db` never reports healthy; auth/user never start | Healthcheck user/db mismatch (see interpolation caveat) or wrong credentials | `docker inspect --format '{{json .State.Health}}' ft_transcendence_db`; align root `.env` with `srcs/db/.env` |
| First boot fails inside `01-init-schemas.sql` | `POSTGRES_DB` / `POSTGRES_USER` changed but the SQL still hardcodes `smartbreeds` / `smartbreeds_user` | `docker compose logs db`; edit the init script or revert the env values |
| Init script "did not run" | `PGDATA` was not empty — the entrypoint skips `/docker-entrypoint-initdb.d` on non-first boots | `make downv` then `make up`, or apply the SQL manually via `psql` |
| Django `relation "..." does not exist` | Migrations not applied, or connection lacks the right `search_path` | `make migration`; confirm `OPTIONS.options` in the service's `settings.py` |
| `schema "recommendation_schema" does not exist` | The SQL migrations were never piped in | Re-run `make migration` (see `scripts/run-migrations.sh:91-92`) |
| recommendation-service fails at import with a `DATABASE_URL` validation error | `DATABASE_URL` has no default (`src/config.py:8`) | Set it in `srcs/recommendation-service/.env` |
| Connection refused to `localhost:5432` | The container publishes no host port by design | Connect from inside the network as `db:5432`, or use `docker exec ... psql` |
| Data unexpectedly gone | `make downv` / `docker compose down -v` removed `ft_transcendence_db-data` | Restore from a `pg_dump`; use `make down` (no `-v`) to preserve data |
