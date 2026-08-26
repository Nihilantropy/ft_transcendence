# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SmartBreeds** is a luxury pet companion platform using AI-powered computer vision for breed identification and health monitoring. The system employs a microservices architecture with Docker-based deployment.

**Core Technologies:**
- Frontend: **not started**. `srcs/frontend/` holds only empty placeholder files and the compose
  service is commented out (docker-compose.yml:156-176). Intended stack: React + Vite + Tailwind CSS
- API Gateway: FastAPI (routing, JWT validation, rate limiting)
- Backend Services: Django 5.0.1 (auth-service) and Django 5.1.5 (user-service), both on `python:3.11-slim`
- AI Services:
  - FastAPI vision orchestrator talking to an LLM via the **LiteLLM proxy**
    (OpenAI-compatible) — routes to local Ollama (qwen3-vl:8b) or hosted Mistral
  - RAG (ChromaDB + sentence-transformers) for breed knowledge enrichment
  - HuggingFace Transformers for classification (species, breed, NSFW) — GPU, `local` profile only
- Inference gateway: LiteLLM (single OpenAI-compatible endpoint for all LLM calls)
- Database: PostgreSQL 15+
- Cache: Redis 8 (`redis:8.4.0-alpine3.22`, docker-compose.yml:228)
- Infrastructure: Docker Compose, Nginx reverse proxy

## Essential Commands

### Docker Management (via Makefile)
```bash
make all           # build + up + show + logs (Makefile:25) — ends tailing logs in the foreground
make build         # Build Docker images (bakes in requirements)
make up            # Start services in detached mode
make down          # Stop and remove containers
make downv         # Stop and remove containers + volumes
make restart       # Restart all services
make logs          # Follow all logs
make logs-SERVICE  # View specific service logs (e.g., make logs-api-gateway)
make purge         # `down -v` then remove containers/images/volumes/networks (Makefile:131)
make re            # Soft rebuild — literally `down all` (Makefile:157)
make ref           # Full rebuild — literally `purge all` (Makefile:160)
make show          # Show system status (containers, networks, volumes)
make migration     # Run database migrations (scripts/run-migrations.sh)
make seed          # Seed the product catalog (scripts/seed-db.sh)
make superuser     # Create test_admin@example.com / Password123! (scripts/create-superuser.sh)
make init          # build + up + migration + seed + superuser + rag (Makefile:28)
make test [flags]  # Run tests; flags: init gateway auth user ai classification recommendation
make test-integration  # recommendation-service tests/integration via docker exec
make rag           # Initialize RAG knowledge base (ingest all markdown docs into ChromaDB)
make elk           # Start the ELK log management stack (generates credentials on first run)
make elk-creds     # Reprint the ELK stack credentials without redeploying
```

⚠️ **`make clean` and `make fclean` do not exist.** Both names appear in `.PHONY` (`Makefile:22`) but
no rule defines them, so make just prints `Nothing to be done for 'clean'` and does nothing. Use
`make down` / `make downv` / `make purge`.

### Compose Profiles (local vs cloud)

Two inference backends, selected via `COMPOSE_PROFILES`. **`Makefile:9` currently sets
`COMPOSE_PROFILES ?= cloud` and `export`s it, which overrides the root `.env`**
(`.env.example:7` ships `local`). Always pass the profile explicitly rather than relying
on the default:

| Profile | LLM backend | GPU services | AI pipeline |
|---------|-------------|--------------|-------------|
| `local` | Ollama `qwen3-vl:8b` via LiteLLM | `ollama` + `classification-service` run | full (NSFW + HF species/breed + RAG + LLM) |
| `cloud` (current Makefile default) | Mistral via LiteLLM (needs `MISTRAL_API_KEY`) | none | VLM-only (LLM does species/breed; **no NSFW filter**) |

```bash
make up COMPOSE_PROFILES=local         # local profile (GPU: ollama + classification-service)
make up COMPOSE_PROFILES=cloud         # cloud profile (Mistral, no GPU) — current Makefile default
```

The `litellm` proxy runs in BOTH profiles. Switching backends is config-only: set the
model alias in `srcs/ai/.env` (`LLM_VISION_MODEL`/`LLM_TEXT_MODEL` → `*-cloud` for Mistral)
and, for cloud, set `CLASSIFICATION_ENABLED=false` (the classification-service is off in
`cloud`, so leaving it `true` yields 503s). Root config lives in `.env` (see `.env.example`).

### Log Management (ELK)

`make elk` starts Elasticsearch + Logstash + Kibana + Filebeat under a dedicated `elk` compose
profile — `make up` never touches it, so the default dev loop stays light. It is fully
zero-config: a one-shot `elk-setup` container generates TLS certs, per-component credentials
(random, printed to the terminal and stored in the gitignored root `.env`), an ILM retention
policy, an SLM archiving policy and a Kibana data view on first run. Filebeat ships every
container's stdout/stderr automatically — no per-service wiring needed. Kibana is at
`https://localhost:5601` (self-signed cert, same trust model as nginx). `make all` includes it;
`make down`/`downv`/`purge` tear it down regardless of which profile is active. Full detail,
including two non-obvious ordering bugs this stack will re-trigger if provisioning is ever
reordered, is in `srcs/elk/README.md`.

### Development
```bash
# Access container shell — exec-% takes the CONTAINER-name suffix (underscores),
# logs-% takes the COMPOSE-service name (hyphens). They are NOT interchangeable.
make exec-api_gateway      # NOT exec-api-gateway
make exec-auth_service     # also: exec-user_service, exec-ai_service
make exec-classification_service   # also: exec-recommendation_service
make logs-api-gateway      # hyphens here
# `make exec-ollama` does not work: that container is named `ollama`, not `ft_transcendence_ollama`

# Direct Docker commands
docker compose up SERVICE -d    # Start specific service
docker compose ps               # Check service status
docker exec -it CONTAINER sh    # Shell into container
```

### Testing

**Critical Docker Workflow:**
- Rebuild rules differ per service:
  - **classification-service**: no source bind mount — ANY `src/` or `tests/` edit needs
    `docker compose build classification-service`
  - **api-gateway**: only `src/`, `routes/`, `tests/` are mounted (docker-compose.yml:298-301) —
    editing `main.py`, `config.py`, `middleware/`, `auth/`, `utils/` needs a rebuild; mounted
    changes still need a restart (uvicorn runs without `--reload`)
  - **auth-service, user-service, recommendation-service**: whole service dir is mounted rw —
    only `requirements.txt` changes need a rebuild
  - **ai-service**: `src/` and `tests/` are mounted — only `requirements.txt`/Dockerfile changes
    need a rebuild
  - **No FastAPI service runs `--reload`** (`api-gateway/Dockerfile:21`, `ai/Dockerfile:35`,
    `recommendation-service/Dockerfile:32`), so a mounted code edit needs
    `docker compose restart SERVICE` to take effect. Only auth-service and user-service really
    hot-reload — they run `manage.py runserver`, which has Django's autoreloader. The
    "hot reload" comments on the compose volume blocks are aspirational
- Unit tests: `docker compose run --rm SERVICE pytest` works (no cross-service calls)
- Integration tests: MUST use `docker exec` on a running container — `run --rm` cannot
  resolve other service hostnames (e.g. `api-gateway`) even on the same network
- Direct exec only works when container running: `docker exec CONTAINER pytest`

**API Gateway Tests** (30 tests total):
```bash
# Run all tests - use `run --rm` (works even if container not running)
docker compose run --rm api-gateway python -m pytest tests/ -v

# Auth Service tests (102 tests total)
docker compose run --rm auth-service python -m pytest tests/ -v

# User Service tests (91 tests total)
docker compose run --rm user-service python -m pytest tests/ -v

# AI Service tests (104 tests total)
docker compose run --rm ai-service python -m pytest tests/ -v

# Classification Service tests (28 tests total)
docker compose run --rm classification-service python -m pytest tests/ -v

# Recommendation Service tests (71 tests total: 48 unit + 23 integration)
# Unit tests via run --rm:
docker compose run --rm recommendation-service python -m pytest tests/unit/ -v
# Integration tests MUST use exec (need api-gateway hostname):
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v

# Run specific test within a service
docker compose run --rm SERVICE python -m pytest tests/test_file.py::test_function -v

# Specific test file
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py -v

# Single test function
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py::test_function_name -v

# With coverage — pytest-cov is NOT in api-gateway's image, install it first or this fails
docker exec ft_transcendence_api_gateway pip install pytest-cov
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=html

# Coverage per service (pytest-cov pre-installed in ai-service, classification-service and
# recommendation-service via requirements.txt, and in auth-service via requirements-dev.txt —
# MISSING in api-gateway and user-service)
# Install on-the-fly for those two: docker exec CONTAINER pip install pytest-cov
# --cov target: api-gateway/auth-service/user-service → --cov=.
#               ai-service/classification-service/recommendation-service → --cov=src
# Note: recommendation-service unit coverage appears ~51% overall — routes/schemas/main.py/
# database.py are 0% in unit tests by design (covered by 23 integration tests).
# Service logic files (feature_engineering, similarity_engine, etc.) are 100%.
```

### IMPORTANT!
All services use a single database `smartbreeds`. Django services (auth, user) have pytest-django
auto-create an isolated test DB at runtime — no separate test database is provisioned or managed.
Services should keep `tests/` unit-level. The one deliberate exception is recommendation-service,
which also ships `tests/integration/` (23 tests) that hardcode `http://api-gateway:8001` and mutate
the live `smartbreeds` database — those MUST run via `docker exec`, never `docker compose run --rm`,
and they require `make up`, `make migration` and `make superuser` (which creates the
`test_admin@example.com` / `Password123!` account the fixtures hardcode).
Integration tests: Jupyter notebook (`scripts/jupyter/test_ai_service.ipynb`) for AI pipeline;
pytest-based for recommendation-service (`tests/integration/`). Integration tests that call
other services by hostname MUST run via `docker exec`, not `docker compose run --rm`.

#### Test Orchestration Scripts
```bash
# Run all unit tests (init skipped by default; pass --init to build/start/migrate first)
./scripts/init-and-test.sh [--init] [--gateway] [--auth] [--user] [--ai] [--classification] [--recommendation]
# Equivalent via make (extra words become flags):
make test [init] [gateway] [auth] [user] [ai] [classification] [recommendation]

# Unit tests directly (same flags, no init phase at all)
./scripts/run-unit-tests.sh [--gateway] [--auth] [--user] [--ai] [--classification] [--recommendation]

# Integration tests only (E2E via Jupyter notebook - manual for now)
jupyter notebook scripts/jupyter/test_ai_service.ipynb
```

**⚠️ Backend Services (DO NOT ACCESS DIRECTLY):**
Backend services (auth-service:3001, user-service:3002, ai-service:3003, classification-service:3004, recommendation-service:3005) are **NOT exposed to localhost**. All requests must go through API Gateway (8001) or Nginx (`https://localhost:8443`, self-signed → `curl -k`) to ensure authentication, rate limiting, and security boundaries are enforced. **`http://localhost:8000` cannot serve API traffic**: the port-80 server block only does `return 301 https://$host$request_uri` (`srcs/nginx/conf.d/default.conf.template:154-163`) and `$host` drops the port, so it redirects to `https://localhost/` — port 443, which is not published.

## Architecture Key Concepts

### Microservices Communication

**Network Topology:**
- **Proxy Network**: Nginx only (the `frontend` service is commented out in docker-compose.yml:156-176)
- **Backend Network**: Nginx ↔ API Gateway ↔ Backend Services ↔ Databases
- **Nginx** bridges both networks (docker-compose.yml:14-16). The API Gateway lives on
  `backend-network` only (docker-compose.yml:304-305) and is additionally published on host
  port 8001 for development (docker-compose.yml:294-295)

**Authentication Flow:**
1. User logs in → Auth Service signs JWT with RS256 private key, issues HTTP-only cookies (15 min access + 7 day refresh; `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` / `JWT_REFRESH_TOKEN_LIFETIME_DAYS`, srcs/auth-service/config/settings.py:131-132). The `refresh_token` cookie is path-scoped to `/api/v1/auth/refresh` (srcs/auth-service/apps/authentication/utils.py:59)
2. Browser automatically sends cookies with each request
3. API Gateway validates JWT using RS256 public key, extracts user context (user_id, role)
4. Gateway forwards to backend services with headers: `X-User-ID`, `X-User-Role`, `X-Request-ID`
5. Backend services trust API Gateway validation (network isolation ensures security)

**Why RS256 Asymmetric Keys:** Auth Service signs tokens with private key (never leaves auth-service). API Gateway verifies with public key only (cannot forge tokens). More secure than HS256 symmetric secrets.

**Why HTTP-Only Cookies:** XSS protection (JavaScript cannot access), automatic transmission, CSRF protection via SameSite attribute.

**Backend Service Isolation:**
- ⚠️ **Backend services are NOT exposed to localhost** (no direct port access)
- Auth Service (3001), User Service (3002), AI Service (3003), Classification Service (3004)
  and Recommendation Service (3005) are **internal only**
- All requests MUST go through API Gateway (8001) or Nginx (`https://localhost:8443`; `http://localhost:8000`
  only 301-redirects to the unpublished `https://localhost/`)
- This enforces security boundaries and ensures authentication/rate limiting are applied
- Exception: `ollama` publishes its unauthenticated API on host port 11434 (docker-compose.yml:68-69)

### Service Responsibilities

**API Gateway (FastAPI - port 8001):**
- Single entry point for all requests
- JWT validation (extracts from HTTP-only cookies)
- Rate limiting: 60 req/min per user (Redis-backed)
- Request routing to backend services
- Adds user context headers (`X-User-ID`, `X-User-Role`)
- Prefix routing via the explicit `SERVICE_ROUTES` map (`routes/proxy.py:40-48`): `/api/v1/auth`,
  `/api/v1/users`, `/api/v1/pets`, `/api/v1/vision`, `/api/v1/recommendations`,
  `/api/v1/admin/products`. Matching is plain `startswith` over dict insertion order; any `/api/*`
  prefix not in the map returns 404 NOT_FOUND (this is why `/api/v1/analyses*` and `/api/v1/rag*`
  are unreachable from the host)
- Location: `srcs/api-gateway/`

**Auth Service (Django - port 3001):** [Complete - 102 passing tests]
- User model, RefreshToken model, JWT utilities, validators, serializers
- User registration (requires email, password, password_confirm) and login endpoints
- Password change endpoint (PUT /api/v1/auth/change-password) - revokes all sessions, re-issues tokens
- JWT token issuance and refresh
- Password hashing (argon2)
- Location: `srcs/auth-service/`

**User Service (Django - internal port 3002):** [Complete - 91 passing tests]
- User profile management (GET/PUT/PATCH /users/me)
- Pet profiles CRUD (name, breed, species, age, weight, health conditions)
- Pet analysis history (breed detection results from AI service)
- Ownership-based permissions (IsOwnerOrAdmin)
- Location: `srcs/user-service/`

**AI Service (FastAPI - internal port 3003):** [Complete - 104 passing tests]
- Multi-stage vision pipeline via VisionOrchestrator (full + VLM-only paths)
- LLM access via LiteLLM proxy (OpenAI chat-completions) — local Ollama or hosted Mistral
- RAG system: ChromaDB + sentence-transformers for breed knowledge enrichment
- Endpoint: POST /api/v1/vision/analyze (base64 image → enriched breed info)
- Coordinates between Classification Service (HF models, optional) and the LLM
- `CLASSIFICATION_ENABLED=false` → VLM-only pipeline (LLM does species/breed, no NSFW filter)
- Location: `srcs/ai/`

**Classification Service (FastAPI - internal port 3004):** [Complete - 28 passing tests]
- HuggingFace Transformers-based classification pipeline
- NSFW content detection (safety filter)
- Species classification (dog/cat/other)
- Breed classification (120 dog breeds, 70 cat breeds)
- Crossbreed detection with intelligent thresholding
- **GPU Support:** RTX 5060 Ti (Blackwell) via stable PyTorch 2.11.0 + CUDA 12.8 (`cu128`)
- **Compose profile:** `local` only (disabled in `cloud`)
- Location: `srcs/classification-service/`

**Recommendation Service (FastAPI - internal port 3005):** [Complete - 71 passing tests (48 unit + 23 integration)]
- Content-based product recommendations using 15-dimensional feature vectors
- Weighted cosine similarity matching pet profiles to products
- Product CRUD administration endpoints
- Direct integration with User Service for pet profile retrieval
- Location: `srcs/recommendation-service/`

**LiteLLM (internal port 4000 — no host port; `backend-network` only):**
- OpenAI-compatible inference gateway — the single LLM endpoint the AI Service calls
- Routes model aliases to local Ollama or hosted Mistral (see `srcs/litellm/config.yaml`)
- Auth via `LITELLM_MASTER_KEY` (must match AI Service `LLM_API_KEY`)
- Runs in both `local` and `cloud` profiles
- Location: `srcs/litellm/`

**Ollama (port 11434):** [`local` profile only]
- Self-hosted LLM server (GPU-accelerated, NVIDIA runtime)
- Hosts qwen3-vl:8b model for vision and text generation, fronted by LiteLLM
- Location: `srcs/ollama/`

**Nginx (host ports 8000→80, 8443→443):**
- TLS termination (`listen 443 ssl`, `default.conf.template:25`); port 80 only 301-redirects
  (`:154-163`) to `https://$host` — i.e. port 443, which is **not** published
- **No static application files are served.** The `frontend` proxy block is commented out
  (`:112-129`), `location /` just returns a hardcoded JSON blob (`:132-136`); the only files read
  from disk are the internal `/50x.html` and `/429.html` error pages (`:54-63`)
- Reverse proxy of `/api` → `api-gateway:8001` (`:73-108`)
- Rate limiting: `general_limit` = 200 r/m per client IP, `burst=20 nodelay` (`:18,77`). The
  `api_limit` (100 r/m) and `auth_limit` (5 r/m) zones are declared at `:16-17` but never applied
- Location: `srcs/nginx/`

### Database Architecture

**Shared PostgreSQL with Logical Separation** (single database `smartbreeds`, compose service `db`,
schemas created by `srcs/db/init-scripts/01-init-schemas.sql`):
- `auth_schema`: users, refresh_tokens (owned by auth-service)
- `user_schema`: user_profiles, pets, pet_analyses (owned by user-service)
- `recommendation_schema`: products (live), plus `recommendations` and `user_feedback` — migrated
  but **never written**, and they type `user_id`/`pet_id` as INT while the platform uses UUID
- `ai_schema`: created and granted by the init script (`:13`) but **unused** — no service reads or writes it

**Rule:** Services NEVER directly access other services' schemas — cross-service data access goes
through REST APIs.

**Reality check:** two services call user-service *directly* on the backend network rather than
through the gateway, and both inject `X-User-ID` themselves: auth-service
`DELETE /api/v1/users/delete` (`apps/authentication/utils.py:181`, 10 s httpx timeout, no retry)
and recommendation-service `GET /api/v1/pets/{id}` (`src/services/user_service_client.py:34`).
Treat these as known exceptions, not as the pattern to copy.

**Note:** AI Service (vision pipeline) is stateless - uses ChromaDB for vector storage, no PostgreSQL tables yet.

**Redis Usage:**
- Rate limiting (**the only implemented use**): `rate_limit:user:{user_id}` when authenticated,
  `rate_limit:ip:{client_ip}` otherwise. Fixed 60-second window (`SETEX key 60 1` then `INCR`), so a
  caller can burst 2× the limit across a window boundary. Fails **open** if Redis errors.
  `srcs/api-gateway/middleware/rate_limit.py:10,25,33,37,45,54,56-58` — note this is the
  **synchronous** redis client called from async middleware.
- Not implemented (aspirational only): token blacklist, breed response cache.

### AI/ML Architecture

**Multi-Stage Vision Pipeline (VisionOrchestrator) — full path (`CLASSIFICATION_ENABLED=true`):**
1. Classification Service analyzes image (NSFW → species → breed via HuggingFace)
2. RAG Service retrieves relevant breed knowledge from ChromaDB (best-effort; any failure degrades to `None`)
3. The vision LLM (via the LiteLLM proxy → Ollama locally, or Mistral in `cloud`) generates contextual analysis
4. Returns enriched breed information with health insights and recommendations

**VLM-only path (`CLASSIFICATION_ENABLED=false`, the `cloud` profile):** `vision_orchestrator.py:57`
branches to `_analyze_vlm_only` (`:134`), which calls `analyze_breed(detect_crossbreed=True,
top_n_breeds=2)` and then the same RAG + `analyze_with_context` steps. **There is no NSFW filter and
no species allow-list on this path.**

**Classification Models (HuggingFace Transformers):**
- NSFW Detector: Content safety filter (pre-classification step)
- Species Classifier: Dog/Cat/Other identification
- Breed Classifiers: 120 dog breeds, 70 cat breeds
- Crossbreed Detection: Multi-rule heuristic (confidence thresholds, probability gaps)
- Device: GPU-accelerated (RTX 5060 Ti Blackwell via stable PyTorch 2.11.0 + CUDA 12.8)

**ChromaDB Vector Store:**
- Embeddings: 384-dimensional (sentence-transformers/all-MiniLM-L6-v2)
- Collection: `pet_knowledge` (species info, breed standards, health conditions)
- Knowledge Base: Markdown documents in `srcs/ai/data/knowledge_base/`
  - Layout: `spiecies/{dogs,cats}/{purebreeds,crossbreeds,health}/*.md` — **34 files total**,
    per species 10 purebreeds + 3 crossbreeds + 4 health. There are no top-level `dogs.md` / `cats.md`
  - The directory is spelled `spiecies` (sic). Do not rename it — `KNOWLEDGE_BASE_DIR` and the
    read-only mount at docker-compose.yml:91 depend on the misspelling
- ChromaDB starts empty - use `make rag` to bulk ingest (calls `scripts/init-rag-kb.sh` which hits the localhost-only endpoint)
- Initialization: `make rag` (preferred) or directly: `docker exec ft_transcendence_ai_service curl -X POST http://localhost:3003/api/v1/admin/rag/initialize`
- Workflow: Document → chunk → embed → store → semantic search
- RAG retrieval enriches the LLM context with factual breed knowledge
- Volume mount: `/app/data/chroma` (persisted in `ai-chroma-data` volume)

**LLM Integration (via LiteLLM — the AI Service never calls Ollama directly):**
- Single call shape: `POST {LLM_BASE_URL}/chat/completions` with `Authorization: Bearer {LLM_API_KEY}`,
  payload `{model, messages, temperature, stream:false}`, response read as
  `choices[0].message.content` (`srcs/ai/src/services/ollama_client.py:22,48-62`). Default
  `LLM_BASE_URL=http://litellm:4000/v1` (`src/config.py:13`)
- Images are OpenAI multimodal content parts:
  `{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,…"}}` (`ollama_client.py:37-44`) —
  always relabelled `image/jpeg` regardless of the real format
- Model aliases resolve in `srcs/litellm/config.yaml`: `vision-model`/`text-model` →
  `ollama_chat/qwen3-vl:8b` (local profile), `vision-model-cloud` → `mistral/mistral-medium-latest`,
  `text-model-cloud` → `mistral/mistral-large-latest`
- Uses RAG-retrieved context for factually grounded responses
- **Naming drift:** the file, class and tests are still `ollama_client.py` / `OllamaVisionClient` /
  `test_ollama_*.py`, and error strings still say "Ollama" (`ollama_client.py:115,372,406,409`).
  Tests assert on those strings — renaming requires touching the tests

**Model Performance Characteristics:**
- Dog breed classifier trained ONLY on purebreds (Stanford Dogs, 120 classes) → crossbreeds naturally have low confidence (5-10%)
- Crossbreed images show diffuse probability distributions (e.g., 8.86% top breed, 8.45% second breed) vs purebreds (20-30%+)
- When debugging low confidence: test with both problematic image AND known-good reference to isolate model limitation vs preprocessing bug

**Threshold Configuration Pattern:**
- All confidence/rejection thresholds must be in `.env` files (never hardcoded)
- AI Service thresholds: `SPECIES_MIN_CONFIDENCE`, `BREED_MIN_CONFIDENCE` (in `srcs/ai/src/config.py`)
- Classification Service thresholds: `CROSSBREED_MIN_SECOND_BREED` (in `srcs/classification-service/src/config.py`)
- Vision orchestrator and crossbreed detector accept `config` parameter for threshold access

## Important Patterns

### FastAPI Access Control

- APIRouter doesn't support `add_middleware()` - use `Depends()` for route-level restrictions
- Localhost check dependency: `async def require_localhost(request: Request)` in `src/middleware/localhost.py`
- Allow Docker internal IPs (`172.x.x.x`) for container-to-container calls
- Test with dependency overrides: `app.dependency_overrides[require_localhost] = mock_function`

### Dockerfile Structure

All services use **custom Dockerfiles that bake in requirements** during build:
- Base image (`python:3.11-slim` for api-gateway/auth-service/user-service; `python:3.12.10-slim`
  for ai-service and classification-service; `python:3.12-slim` for recommendation-service)
- Install system dependencies
- Copy and install `requirements.txt` (dependencies frozen in image). auth-service is the only
  service with a second file — it also installs `requirements-dev.txt` (pytest, pytest-django,
  pytest-cov, factory-boy, freezegun) at `Dockerfile:18,23`, which is why it has no test deps in
  `requirements.txt` yet still runs pytest
- Copy application code
- Create non-root user (uid 1000)
- Expose port and set CMD

**No Dockerfile declares a HEALTHCHECK** — every healthcheck lives in `docker-compose.yml`.

**Implication:** Changes to `requirements.txt` require `make build` to rebuild images.

**Django Version:** Django 6.x requires Python >=3.12. Use Django 5.1.x for Python 3.11 compatibility.

**Classification Service PyTorch:** Stable pinned wheels for RTX 5060 Ti Blackwell support:
- PyTorch: 2.11.0+cu128
- Torchvision: 0.26.0+cu128
- Installed in the Dockerfile (NOT requirements.txt): `pip3 install torch==2.11.0+cu128 torchvision==0.26.0+cu128 --index-url https://download.pytorch.org/whl/cu128`
- Keep the pair version-matched (torch 2.11 ↔ torchvision 0.26). This replaced the earlier
  unpinned nightly, which broke when the nightlies drifted out of sync on the ephemeral index.

### Middleware Stack (API Gateway)

Order of execution (bottom to top):
1. **CORS Middleware**: Whitelist origins, allow credentials
2. **Logging Middleware**: Structured JSON logs with request_id, timing, user_id
3. **Rate Limiting Middleware**: Redis-backed, per-user or per-IP
4. **Authentication Middleware**: JWT validation, extracts user context

Public paths (exact match, `middleware/auth_middleware.py:22-29`): `/health`, `/docs`,
`/openapi.json`, `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh`.
Everything else requires the `access_token` cookie — including `/redoc` (served by FastAPI but never
added to the set), `/api/v1/auth/logout`, `/api/v1/auth/verify`, `/api/v1/auth/delete` and
`/api/v1/auth/change-password`.

### Standardized Error Responses

Most services return this consistent JSON format:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "2026-01-14T12:00:00.000000"
}
```

Common codes: `UNAUTHORIZED` (401), `RATE_LIMIT_EXCEEDED` (429), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `INTERNAL_ERROR` (500)

Location: `srcs/api-gateway/utils/responses.py`

**Exception — classification-service** returns bare dicts on success and
`{"detail": {"code", "message"}}` on error (`src/routes/classify.py:60-71`). It is internal-only and
`srcs/ai/src/services/classification_client.py` depends on that shape — do not "fix" it without
updating the client. user-service also falls back to DRF's bare `{"detail": ...}` for malformed
request JSON.

### Vision Pipeline Flow

**End-to-End Request Flow for Image Analysis:**
1. User uploads image → API Gateway (JWT auth, rate limiting)
2. API Gateway → AI Service `/api/v1/vision/analyze`
3. AI Service (VisionOrchestrator) orchestrates 3-stage pipeline:
   - **Stage 1:** Classification Service analyzes image
     - NSFW check (reject unsafe content)
     - Species identification (dog/cat confidence check)
     - Breed classification (purebred or crossbreed detection)
   - **Stage 2:** RAG Service retrieves breed context from ChromaDB
     - Query: species name + breed name(s)
     - Returns: health info, breed standards, care guidelines
   - **Stage 3:** The vision LLM generates contextual analysis via the LiteLLM proxy
     (`POST http://litellm:4000/v1/chat/completions`)
     - Input: image + classification results + RAG context
     - Output: Natural language breed description, health insights, recommendations
4. AI Service returns enriched response to API Gateway
5. API Gateway returns to user

**Key Design Decisions:**
- Classification Service uses HuggingFace for structured predictions (species, breed, confidence scores)
- The vision LLM (LiteLLM → Ollama or Mistral) provides contextual, conversational analysis
- RAG bridges the two: provides factual breed knowledge to ground the vision LLM's (LiteLLM → Ollama
  or Mistral) responses
- Pipeline fails fast: rejects low-confidence species/breed early to avoid hallucinations

**Rejection Thresholds (VisionOrchestrator):**
- Species confidence: < `SPECIES_MIN_CONFIDENCE` = **0.10** — `vision_orchestrator.py:73` (`srcs/ai/src/config.py:34`)
- Breed confidence: < `BREED_MIN_CONFIDENCE` = **0.05** — `vision_orchestrator.py:85`, and again on
  the VLM-only path at `:154` (`srcs/ai/src/config.py:35`)
- Note: test comments may reference outdated 0.60/0.40 values — those are the (dead)
  identically-named fields in `srcs/classification-service/src/config.py:22-23`, which nothing in
  that service reads

### Crossbreed Detection Thresholds

- **Two-stage threshold system** (both must be tuned together):
  1. Classification Service: `CROSSBREED_MIN_SECOND_BREED` (default 0.05) - flags as crossbreed if second breed > threshold
  2. Vision Orchestrator: `BREED_MIN_CONFIDENCE` (default 0.05) - accepts/rejects final result
- Crossbreed confidence calculated as average of top 2 breeds: `(top + second) / 2`
- Example: Top 8.86%, second 8.45% → crossbreed flagged, confidence 8.65% → passes 5% threshold

### Service Configuration

Services use environment variables from `.env` files:
- Pydantic Settings for validation and type safety
- Loaded from `.env` in service directory
- JWT Key Pair (RS256):
  - Auth Service: Private key at `srcs/auth-service/keys/jwt-private.pem` (signs tokens)
  - API Gateway: Public key mounted read-only from auth-service keys directory (verifies tokens)
  - Generated once, never regenerate in production (invalidates all tokens)
- Service URLs use Docker Compose service names (e.g., `http://auth-service:3001`)
- `.env.example` files exist for ai, api-gateway, auth-service, classification-service, db, nginx,
  recommendation-service and user-service. **`srcs/litellm/` and `srcs/ollama/` have none** — they
  are configured entirely from the root `.env` (`LITELLM_MASTER_KEY`, `OLLAMA_BASE_URL`,
  `MISTRAL_API_KEY`) plus `srcs/litellm/config.yaml`. `srcs/frontend/.env.example` exists but is 0 bytes

## Development Workflow

### Adding a New Backend Service

1. Create service directory in `srcs/`
2. Add `Dockerfile` that bakes in requirements
3. Create `.env.example` with required environment variables
4. Add service to `docker-compose.yml` (assign to `backend-network`)
5. Add service URL to `srcs/api-gateway/.env` and `.env.example`: `NEW_SERVICE_URL=http://new-service:PORT`
6. Add `NEW_SERVICE_URL: str` (no default — a missing value must fail fast at startup) to
   `srcs/api-gateway/config.py`
7. Add a `"/api/v1/newthing": settings.NEW_SERVICE_URL` entry to `SERVICE_ROUTES` in
   `srcs/api-gateway/routes/proxy.py:40-48`. Matching is plain `startswith` over insertion order, so
   a more specific prefix must be inserted before any prefix of it. Without this entry the path
   returns 404
8. If the endpoint is slow, add its prefix to `SERVICE_TIMEOUTS` (`routes/proxy.py:16-18`) — do not
   raise the shared 30 s default on `httpx_client`
9. Also add `srcs/api-gateway/tests/conftest.py` env setup if the new URL has no default
10. Copy `.env.example` to `.env` and configure before first run

### Modifying API Gateway Behavior

**Add public endpoint** (no auth): Edit `srcs/api-gateway/middleware/auth_middleware.py` and add the
**exact full path** to the `self.public_endpoints` set (`:22-29`). Matching is exact equality on
`request.url.path` (`:33`), not a prefix test — `/api/v1/auth/logout` is protected precisely because
only the exact literals are listed.

**Change rate limits**: Update `RATE_LIMIT_PER_MINUTE` in `srcs/api-gateway/.env`.

**Custom routing logic**: Edit `srcs/api-gateway/routes/proxy.py` for non-standard routing.

### Testing Strategy

1. **Unit tests**: Test components in isolation with mocked dependencies
2. **Integration tests**: Use API Gateway (localhost:8001) - backend services are NOT directly accessible
3. **E2E tests**: Use the NGINX proxy at `https://localhost:8443/api` (self-signed cert — pass `curl -k`) for the full production-like stack
4. **Load tests**: Test through NGINX to validate both rate limiting layers
5. **Dependency override pattern**: Use `app.dependency_overrides[dep] = fixture` for mocking route dependencies
6. **HTTPException detail format**: Error responses wrapped in `detail` field - test with `response.json()["detail"]`

**⚠️ Important:** Backend services (auth:3001, user:3002, ai:3003, classification:3004, recommendation:3005) have NO external port exposure. All API requests must go through API Gateway (8001) or Nginx (`https://localhost:8443`; `http://localhost:8000` only 301-redirects to the unpublished `https://localhost/`). Note: `ollama` is an exception — docker-compose.yml:68-69 publishes its unauthenticated API on host port 11434.

**Test Script Organization:**
```bash
# Run specific test suites
./scripts/run-unit-tests.sh [flags]                   # Unit tests (--all default; flags: --gateway --auth --user --ai --classification --recommendation)
./scripts/init-and-test.sh [--init] [flags]           # Orchestrator: --init enables build/start/migrate; flags forwarded to run-unit-tests.sh
make test [init] [flags]                              # make shortcut (no -- prefix needed)
```

**FastAPI Lifespan Testing Pattern:**
- Problem: TestClient triggers lifespan startup → loads real models → overwrites mocks
- Solution: Create app WITHOUT lifespan in conftest.py, pre-inject mocks before router inclusion
- Example: `srcs/classification-service/tests/conftest.py` (bypasses model loading in tests)

**Docker Test File Changes:**
- New test files need NO rebuild for api-gateway, ai-service, auth-service, user-service or
  recommendation-service — `tests/` is bind-mounted in all five
- **classification-service is the exception**: `src/` and `tests/` are baked in (Dockerfile:23-24),
  so every new or edited test file requires `docker compose build classification-service`
- Use `docker compose run --rm SERVICE pytest` (works even when the container is not running)

**AsyncMock Defensive Pattern:**
- Always mock ALL async methods in execution path, even when expecting early rejection
- Prevents breakage if thresholds/conditions change in future
- Example: Low-confidence rejection tests should still mock downstream services (RAG, Ollama)

**Flags:**
- `scripts/run-unit-tests.sh`: `--all` (default) or any combination of
  `--gateway --auth --user --ai --classification --recommendation`
- `scripts/init-and-test.sh`: `--init` opts *into* build/start/migrate (skipped by default); every
  other flag is forwarded verbatim to `run-unit-tests.sh`
- `make test [init] [gateway] [auth] [user] [ai] [classification] [recommendation]` — extra words
  become `--flags`. **`init` is a trap**: it is also a real target (`Makefile:28`), so `make test init`
  runs `init-and-test.sh --init` *and then* the whole `build up migration seed superuser rag` chain
  (verify with `make -n test init`). Prefer `./scripts/init-and-test.sh --init` if you only want the
  script's build/start/migrate phase

Note: `run-unit-tests.sh` hardcodes expected test counts that are stale — gateway 28 (real 30,
`:109`), ai 37 (real 104, `:121`), recommendation 42 (real 48, `:129`). They only feed a printed
total; do not trust them.

**Jupyter Notebook Testing (E2E Integration):**
- Location: `scripts/jupyter/test_ai_service.ipynb`
- Purpose: Test full vision pipeline with real images through API Gateway
- Setup: Notebook handles JWT authentication automatically
- Images: Place test images in `scripts/jupyter/test_data/images/` directory
- Run: `jupyter notebook scripts/jupyter/test_ai_service.ipynb` (requires `make up` first)
- Note: All requests route through API Gateway (localhost:8001) with proper JWT tokens
- Note: notebooks uses real database transactions on `smartbreeds` database (production-like). Make sure to clean up test data as needed. Every run must use unique user accounts to avoid conflicts and leave a clean state.
- **Headless execution:** `jupyter-nbconvert --to notebook --execute --allow-errors --ExecutePreprocessor.timeout=600 notebook.ipynb --output out.ipynb` — use `--allow-errors` to capture all cell outputs even when cells fail; set timeout ≥600 for AI notebooks

**Debugging ML Models in Containers:**
- Direct `docker exec` Python commands loading large models often hang → use script approach instead
- Pattern: Create test script locally, `docker cp script.py container:/tmp/`, then `docker exec container python /tmp/script.py`
- For image testing: Copy test images into container with `docker cp` (test directories not mounted by default)
- Use `timeout` command wrapper for long-running inference: `timeout 60 docker exec container python script.py`

## Security Considerations

- **JWT Tokens**: RS256 asymmetric algorithm, stored in HTTP-only cookies
  - Auth Service: Signs tokens with RSA private key (jwt-private.pem, never shared)
  - API Gateway: Verifies tokens with RSA public key only (jwt-public.pem, read-only mount)
  - Key generation: 4096-bit RSA (`srcs/auth-service/keys/generate-keys.sh:11`), stored in `srcs/auth-service/keys/`
  - Volume mount: `./srcs/auth-service/keys/jwt-public.pem:/app/keys/jwt-public.pem:ro`
- **Network Isolation**: Backend services not exposed externally, only via API Gateway
- **Rate Limiting**: Two layers (NGINX: 200/min, API Gateway: 60/min per user)
- **Password Hashing**: argon2 in auth service
- **HTTPS**: TLS 1.2+ via Nginx (self-signed cert in dev, replace in production)
- **Token Blacklist**: **not implemented.** Logout clears the cookies and marks the `refresh_tokens`
  row revoked; a stolen access token remains valid until its 15-minute `exp`. (In a real browser the
  revocation branch never even runs: the `refresh_token` cookie is `Path=/api/v1/auth/refresh`, so it
  is not sent to `/api/v1/auth/logout`.)

## Current State

**Completed:**
- API Gateway (FastAPI) with full middleware stack - 30 passing tests
- Auth Service (Django) with authentication endpoints - 102 passing tests
- User Service (Django) with profile and pet management - 91 passing tests
- AI Service (FastAPI) with multi-stage vision pipeline - 104 passing tests
- Classification Service (FastAPI) with HuggingFace models - 28 passing tests
- Multi-stage vision pipeline (Classification → RAG → LLM orchestration via LiteLLM)
- Crossbreed detection with intelligent thresholding
- RAG system with ChromaDB for breed knowledge enrichment + bulk initialization endpoint
- Docker infrastructure with isolated networks
- Nginx reverse proxy configuration
- Redis integration for rate limiting (caching is not implemented — see Redis Usage above)
- Ollama GPU setup for AI inference (qwen3-vl:8b model, `local` profile, fronted by LiteLLM)
- Jupyter notebook for E2E pipeline testing

**Not Started:**
- Frontend — `srcs/frontend/` contains only empty placeholder files (.env, .env.example, Dockerfile,
  README.md, all 0 bytes) and the compose service is commented out (docker-compose.yml:156-176)

**Recently Completed:**
- LiteLLM inference gateway — `local` (Ollama) / `cloud` (Mistral) compose profiles; AI Service
  talks OpenAI chat-completions to the proxy; VLM-only pipeline when classification is disabled
- Classification Service torch pin moved from unpinned nightly → stable 2.11.0+cu128 (Blackwell)
- Recommendation Service — content-based filtering with 71 passing tests (48 unit + 23 integration)

## Common Troubleshooting

**"Connection refused" on localhost:8001:**
- Check: `docker compose ps api-gateway`
- Fix: `docker compose up api-gateway -d`

**"502 Bad Gateway" from NGINX:**
- API Gateway down or unreachable
- Check: `curl http://localhost:8001/health`
- Check networks: `docker network inspect ft_transcendence_backend-network`

**JWT always rejected:**
- Verify RSA key pair exists: `ls -la srcs/auth-service/keys/`
- Ensure public key is mounted in API Gateway: `docker exec ft_transcendence_api_gateway ls /app/keys/jwt-public.pem`
- Check key permissions: Public key must be readable
- Verify cookie is being set: `curl -v http://localhost:8001/api/v1/auth/login -d '{"email":"user@example.com","password":"pass"}' -H "Content-Type: application/json" 2>&1 | grep -i "set-cookie"`
- Test token signature: Tokens signed with RS256 private key must be verifiable with RS256 public key

**Rate limiting not working:**
- Check Redis: `docker exec ft_transcendence_redis redis-cli ping`
- Verify `REDIS_URL` in api-gateway `.env`

**Ollama GPU not detected:**
- Verify NVIDIA runtime: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
- Check docker-compose.yml: `runtime: nvidia` and `deploy.resources.reservations.devices`

**Django trailing slash conflicts:**
- DRF `DefaultRouter` adds trailing slashes by default (Django convention)
- For API-only services, use `APPEND_SLASH = False` in settings.py and `DefaultRouter(trailing_slash=False)` in urls.py
- This matches RESTful conventions (no trailing slashes)

**Response object double-wrapping:**
- Utility functions that return `Response` objects should NOT be wrapped in `Response()` again
- Symptoms: `TypeError: Object of type Response is not JSON serializable`
- Fix: `return success_response(data)` NOT `return Response(success_response(data))`

**Classification Service GPU troubleshooting:**
- Using stable PyTorch 2.11.0+cu128 (torchvision 0.26.0+cu128) for RTX 5060 Ti Blackwell support
- CUDA 12.8 runtime required
- Only runs in the `local` compose profile (absent in `cloud`)
- Environment variable `DEVICE=auto` detects GPU automatically (falls back to CPU if unavailable)
- Verify GPU: `docker exec ft_transcendence_classification_service python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"`
- Check docker-compose.yml: `runtime: nvidia` and `deploy.resources.reservations.devices` configured
- **Note:** torch/torchvision are pinned in the Dockerfile (not requirements.txt); keep the pair version-matched

**Crossbreed detection returning false positives:**
- Thresholds live in `srcs/classification-service/src/config.py:26-29` (and `.env`), not in
  `crossbreed_detector.py` — that class only copies them in its constructor (`:16-19`)
- `CROSSBREED_MIN_SECOND_BREED` = **0.05 (5%)** — the minimum second-breed probability for rule 2
- Rule 1: second breed > `CROSSBREED_PROBABILITY_THRESHOLD` (0.35). Rule 2: top <
  `PUREBRED_CONFIDENCE_THRESHOLD` (0.75) AND gap < `PUREBRED_GAP_THRESHOLD` (0.30) AND second > 0.05
- Review test cases: `test_crossbreed_detector.py` for expected behavior
- Confidence scale is 0.0-1.0 (0.26 = 26%)
- Note: Low confidence scores may indicate image quality issues or model limitations, need further investigation

**Low breed confidence / BREED_DETECTION_FAILED:**
- Crossbreeds naturally have lower confidence (5-10%) than purebreds (20-30%+) - this is expected
- Test with known purebred image to confirm model is working (e.g., pure Golden Retriever should get 20%+)
- Check thresholds: `BREED_MIN_CONFIDENCE` in `srcs/ai/.env` (default 0.05 for crossbreed support)
- Check logs: `docker logs ft_transcendence_ai_service | grep "VisionOrchestrator initialized"` shows active thresholds
- Adjust crossbreed detection: `CROSSBREED_MIN_SECOND_BREED` in `srcs/classification-service/.env` (default 0.05)

**RAG embedder method errors:**
- ChromaDB embedder uses `embed()` method, NOT `embed_text()`
- Location: `srcs/ai/src/services/rag_service.py`
- Common mistake: calling non-existent methods on embedder wrapper

**Vision orchestrator parameter mismatches:**
- Ollama client expects `image_base64` parameter, NOT `image`
- Location: `srcs/ai/src/services/vision_orchestrator.py`
- Parameter names must match method signatures exactly

**503 on /api/v1/vision/analyze:**
- Root cause: API Gateway has a 30s global proxy timeout; LLM inference takes 20–120s
- Fix is in place: `SERVICE_TIMEOUTS` in `srcs/api-gateway/routes/proxy.py:16-18` overrides to 300s
  for `/api/v1/vision` (and `LLM_TIMEOUT` in `srcs/ai/src/config.py:17` is also 300)
- **But this only works on the direct gateway port 8001.** nginx caps `location /api` at
  `proxy_read_timeout 30s` (`srcs/nginx/conf.d/default.conf.template:89`), so a long vision call
  through `https://localhost:8443` still fails at the edge. Raise the nginx timeout too if
  you need vision through nginx
- If adding a new slow endpoint, add its prefix to `SERVICE_TIMEOUTS`

**Django `.delete()` count returns wrong number:**
- `queryset.delete()` returns `(total_rows, {model_label: count})` where `total_rows` includes CASCADE-deleted related rows
- Example: deleting a User also deletes RefreshTokens, so `total_rows = 2` for 1 user
- Always use `deleted_counts.get('authentication.User', 0)` for per-model accuracy

**Recommendation service product duplicates:**
- Seed script is idempotent — skips if any products exist, prints a warning
- Use `--force` flag to clear and re-seed: `docker exec ft_transcendence_recommendation_service python scripts/seed_products.py --force`
- Product data lives in `scripts/products.yaml` — edit there, not in Python

## Reference Documentation

- Full architecture details: `ARCHITECTURE.md` — **mixed reliability; prefer this file and the
  per-service `srcs/*/CLAUDE.md`.** Its body sections have been refreshed (it correctly states the
  8000→80 / 8443→443 host ports and that LlamaIndex is *not* used anywhere in the repo), but the
  trailing appendices — the sample `.env` block, the "Technology Decisions" table and the "Service
  Inventory" table — are still pre-LiteLLM and contradict reality: `postgres`/`transcendence` DB
  host+name, `JWT_ALGORITHM=HS256`, `OLLAMA_BASE_URL` as an AI Service variable, Django 6.0.1,
  React 19.2, "AI Orchestration: LlamaIndex", and nginx on `80, 443`. Line numbers are deliberately
  omitted — the file is being edited and they drift
- API testing workflows: `docs/API_TESTING_GUIDE.md`
- Implementation plans: `docs/plans/` (TDD step-by-step guides for each service)
