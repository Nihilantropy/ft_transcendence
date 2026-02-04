# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SmartBreeds** is a luxury pet companion platform using AI-powered computer vision for breed identification and health monitoring. The system employs a microservices architecture with Docker-based deployment.

**Core Technologies:**
- Frontend: React 19.2 + Vite + Tailwind CSS
- API Gateway: FastAPI (routing, JWT validation, rate limiting)
- Backend Services: Django 6.0.1 (auth-service, user-service)
- AI Services:
  - FastAPI + Ollama HTTP API (qwen3-vl:8b model) for multimodal vision
  - RAG (ChromaDB + sentence-transformers) for breed knowledge enrichment
  - HuggingFace Transformers for classification (species, breed, NSFW)
- Database: PostgreSQL 15+
- Cache: Redis 7
- Infrastructure: Docker Compose, Nginx reverse proxy

## Essential Commands

### Docker Management (via Makefile)
```bash
make all           # Build and start all services
make build         # Build Docker images (bakes in requirements)
make up            # Start services in detached mode
make down          # Stop and remove containers
make downv         # Stop and remove containers + volumes
make restart       # Restart all services
make logs          # Follow all logs
make logs-SERVICE  # View specific service logs (e.g., make logs-api-gateway)
make clean         # Remove containers and networks
make fclean        # Full cleanup (containers + volumes + images)
make re            # Soft rebuild (clean + all)
make ref           # Full rebuild (fclean + all)
make show          # Show system status (containers, networks, volumes)
make migration     # Run database migrations
make test [flags]  # Run tests; flags: init gateway auth user ai classification recommendation
```

### Development
```bash
# Access container shell
make exec-SERVICE  # e.g., make exec-api-gateway

# Direct Docker commands
docker compose up SERVICE -d    # Start specific service
docker compose ps               # Check service status
docker exec -it CONTAINER sh    # Shell into container
```

### Testing

**Critical Docker Workflow:**
- Code changes require rebuild: `make build` or `docker compose build SERVICE`
- Unit tests: `docker compose run --rm SERVICE pytest` works (no cross-service calls)
- Integration tests: MUST use `docker exec` on a running container — `run --rm` cannot
  resolve other service hostnames (e.g. `api-gateway`) even on the same network
- Direct exec only works when container running: `docker exec CONTAINER pytest`

**API Gateway Tests** (30 tests total):
```bash
# Run all tests - use `run --rm` (works even if container not running)
docker compose run --rm api-gateway python -m pytest tests/ -v

# Auth Service tests (77 tests total)
docker compose run --rm auth-service python -m pytest tests/ -v

# User Service tests (73 tests total)
docker compose run --rm user-service python -m pytest tests/ -v

# AI Service tests (47 tests total)
docker compose run --rm ai-service python -m pytest tests/ -v

# Classification Service tests (28 tests total)
docker compose run --rm classification-service python -m pytest tests/ -v

# Recommendation Service tests (53 tests total: 30 unit + 23 integration)
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

# With coverage
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=html
```

### IMPORTANT!
All services use a single database `smartbreeds`. Django services (auth, user) have pytest-django
auto-create an isolated test DB at runtime — no separate test database is provisioned or managed.
Services must only contain unit tests that are not dependent on other services.
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
Backend services (auth-service:3001, user-service:3002, ai-service:3003) are **NOT exposed to localhost**. All requests must go through API Gateway or Nginx to ensure authentication, rate limiting, and security boundaries are enforced.

## Architecture Key Concepts

### Microservices Communication

**Network Topology:**
- **Proxy Network**: Nginx ↔ Frontend ↔ API Gateway (public-facing)
- **Backend Network**: API Gateway ↔ Backend Services ↔ Databases (internal only, isolated)
- API Gateway bridges both networks as the sole entry point

**Authentication Flow:**
1. User logs in → Auth Service signs JWT with RS256 private key, issues HTTP-only cookies (24h access + 7d refresh)
2. Browser automatically sends cookies with each request
3. API Gateway validates JWT using RS256 public key, extracts user context (user_id, role)
4. Gateway forwards to backend services with headers: `X-User-ID`, `X-User-Role`, `X-Request-ID`
5. Backend services trust API Gateway validation (network isolation ensures security)

**Why RS256 Asymmetric Keys:** Auth Service signs tokens with private key (never leaves auth-service). API Gateway verifies with public key only (cannot forge tokens). More secure than HS256 symmetric secrets.

**Why HTTP-Only Cookies:** XSS protection (JavaScript cannot access), automatic transmission, CSRF protection via SameSite attribute.

**Backend Service Isolation:**
- ⚠️ **Backend services are NOT exposed to localhost** (no direct port access)
- Auth Service (3001), User Service (3002), AI Service (3003) are **internal only**
- All requests MUST go through API Gateway (8001) or Nginx (80/443)
- This enforces security boundaries and ensures authentication/rate limiting are applied

### Service Responsibilities

**API Gateway (FastAPI - port 8001):**
- Single entry point for all requests
- JWT validation (extracts from HTTP-only cookies)
- Rate limiting: 60 req/min per user (Redis-backed)
- Request routing to backend services
- Adds user context headers (`X-User-ID`, `X-User-Role`)
- Zero-touch routing: automatically proxies `/api/*` to backend services
- Location: `srcs/api-gateway/`

**Auth Service (Django - port 3001):** [Complete - 77 passing tests]
- User model, RefreshToken model, JWT utilities, validators, serializers
- User registration and login endpoints
- JWT token issuance and refresh
- Password hashing (argon2)
- Location: `srcs/auth-service/`

**User Service (Django - port 3002):** [Complete - 73 passing tests]
- User profile management (GET/PUT/PATCH /users/me)
- Pet profiles CRUD (name, breed, species, age, weight, health conditions)
- Pet analysis history (breed detection results from AI service)
- Ownership-based permissions (IsOwnerOrAdmin)
- Location: `srcs/user-service/`

**AI Service (FastAPI - internal port 3003):** [Complete - 47 passing tests]
- Multi-stage vision pipeline via VisionOrchestrator
- Ollama HTTP API integration (qwen3-vl:8b model) for contextual analysis
- RAG system: ChromaDB + sentence-transformers for breed knowledge enrichment
- Endpoint: POST /api/v1/vision/analyze (base64 image → enriched breed info)
- Coordinates between Classification Service (HuggingFace models) and Ollama (LLM)
- Location: `srcs/ai/`

**Classification Service (FastAPI - internal port 3004):** [Complete - 28 passing tests]
- HuggingFace Transformers-based classification pipeline
- NSFW content detection (safety filter)
- Species classification (dog/cat/other)
- Breed classification (120 dog breeds, 70 cat breeds)
- Crossbreed detection with intelligent thresholding
- **GPU Support:** RTX 5060 Ti (Blackwell) via PyTorch nightly (2.11.0.dev20260128+cu128)
- Location: `srcs/classification-service/`

**Ollama (port 11434):**
- Self-hosted LLM server (GPU-accelerated, NVIDIA runtime)
- Hosts qwen3-vl:8b model for vision and text generation
- Location: `srcs/ollama/`

**Nginx (ports 80, 443):**
- TLS termination
- Static file serving
- Reverse proxy to API Gateway
- Rate limiting: 200 req/min (NGINX layer)
- Location: `srcs/nginx/`

### Database Architecture

**Shared PostgreSQL with Logical Separation:**
- `auth_schema`: users, refresh_tokens (owned by auth-service)
- `user_schema`: user_profiles, pets, pet_analyses (owned by user-service)
- `ai_schema`: (reserved for future features - product recommendations, user preferences)

**Rule:** Services NEVER directly access other services' schemas. Cross-service data access MUST go through REST APIs via API Gateway.

**Note:** AI Service (vision pipeline) is stateless - uses ChromaDB for vector storage, no PostgreSQL tables yet.

**Redis Usage:**
- Token blacklist: `blacklist:token:{hash}` (TTL: token lifetime)
- Rate limiting: `rate_limit:user:{user_id}:{endpoint}` (TTL: 1 min)
- API response cache: `cache:breed:{name}` (TTL: 7 days)

### AI/ML Architecture

**Multi-Stage Vision Pipeline (VisionOrchestrator):**
1. Classification Service analyzes image (species + breed identification via HuggingFace)
2. RAG Service retrieves relevant breed knowledge from ChromaDB
3. Ollama generates contextual analysis combining classification + RAG context
4. Returns enriched breed information with health insights and recommendations

**Classification Models (HuggingFace Transformers):**
- NSFW Detector: Content safety filter (pre-classification step)
- Species Classifier: Dog/Cat/Other identification
- Breed Classifiers: 120 dog breeds, 70 cat breeds
- Crossbreed Detection: Multi-rule heuristic (confidence thresholds, probability gaps)
- Device: GPU-accelerated (RTX 5060 Ti Blackwell via PyTorch 2.11 nightly + CUDA 12.8)

**ChromaDB Vector Store:**
- Embeddings: 384-dimensional (sentence-transformers/all-MiniLM-L6-v2)
- Collection: `pet_knowledge` (species info, breed standards, health conditions)
- Knowledge Base: Markdown documents in `srcs/ai/data/knowledge_base/`
  - `spiecies/`: General species info (dogs.md, cats.md)
  - Directory structure: `spiecies/{species}/{purebreeds,crossbreeds,health}/*.md`
  - Future: breed-specific files for detailed breed standards
- ChromaDB starts empty - use `POST /api/v1/admin/rag/initialize` to bulk ingest (localhost-only)
- Initialization: `docker exec ft_transcendence_ai_service curl -X POST http://localhost:3003/api/v1/admin/rag/initialize`
- Workflow: Document → chunk → embed → store → semantic search
- RAG retrieval enriches Ollama context with factual breed knowledge
- Volume mount: `/app/data/chroma` (persisted in `ai-chroma-data` volume)

**Ollama Integration:**
- Model: qwen3-vl:8b (multimodal - vision + text)
- Direct HTTP API (NOT LlamaIndex - doesn't support Ollama multimodal)
- Generates contextual breed descriptions, health insights, recommendations
- Uses RAG-retrieved context for factually grounded responses

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
- Base image (e.g., `python:3.11-slim`)
- Install system dependencies
- Copy and install `requirements.txt` (dependencies frozen in image)
- Copy application code
- Create non-root user
- Define healthcheck
- Expose port and set CMD

**Implication:** Changes to `requirements.txt` require `make build` to rebuild images.

**Django Version:** Django 6.x requires Python >=3.12. Use Django 5.1.x for Python 3.11 compatibility.

**Classification Service PyTorch:** Uses nightly builds for RTX 5060 Ti Blackwell support:
- PyTorch: 2.11.0.dev20260128+cu128
- Torchvision: 0.25.0.dev20260128+cu128
- Installed via: `pip install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128`
- Pin specific nightly build in requirements.txt to avoid breaking changes

### Middleware Stack (API Gateway)

Order of execution (bottom to top):
1. **CORS Middleware**: Whitelist origins, allow credentials
2. **Logging Middleware**: Structured JSON logs with request_id, timing, user_id
3. **Rate Limiting Middleware**: Redis-backed, per-user or per-IP
4. **Authentication Middleware**: JWT validation, extracts user context

Public paths (no auth): `/health`, `/api/v1/auth/*`

### Standardized Error Responses

All services return consistent JSON format:
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
   - **Stage 3:** Ollama generates contextual analysis
     - Input: image + classification results + RAG context
     - Output: Natural language breed description, health insights, recommendations
4. AI Service returns enriched response to API Gateway
5. API Gateway returns to user

**Key Design Decisions:**
- Classification Service uses HuggingFace for structured predictions (species, breed, confidence scores)
- Ollama uses multimodal LLM for contextual, conversational analysis
- RAG bridges the two: provides factual breed knowledge to ground Ollama responses
- Pipeline fails fast: rejects low-confidence species/breed early to avoid hallucinations

**Rejection Thresholds (VisionOrchestrator):**
- Species confidence: < 0.1 (vision_orchestrator.py:63)
- Breed confidence: < 0.1 (vision_orchestrator.py:75)
- Note: Test comments may reference outdated thresholds (0.60/0.40) - trust the code

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
- `.env.example` files provided in each service directory

## Development Workflow

### Adding a New Backend Service

1. Create service directory in `srcs/`
2. Add `Dockerfile` that bakes in requirements
3. Create `.env.example` with required environment variables
4. Add service to `docker-compose.yml` (assign to `backend-network`)
5. Add service URL to `srcs/api-gateway/.env`: `NEW_SERVICE_URL=http://new-service:PORT`
6. Update `srcs/api-gateway/config.py` to include new URL
7. API Gateway will automatically proxy `/api/*` requests
8. Copy `.env.example` to `.env` and configure before first run

### Modifying API Gateway Behavior

**Add public endpoint** (no auth): Edit `srcs/api-gateway/middleware/auth_middleware.py`, add path to `PUBLIC_PATHS` list.

**Change rate limits**: Update `RATE_LIMIT_PER_MINUTE` in `srcs/api-gateway/.env`.

**Custom routing logic**: Edit `srcs/api-gateway/routes/proxy.py` for non-standard routing.

### Testing Strategy

1. **Unit tests**: Test components in isolation with mocked dependencies
2. **Integration tests**: Use API Gateway (localhost:8001) - backend services are NOT directly accessible
3. **E2E tests**: Use NGINX proxy (localhost/api) for full production-like stack
4. **Load tests**: Test through NGINX to validate both rate limiting layers
5. **Dependency override pattern**: Use `app.dependency_overrides[dep] = fixture` for mocking route dependencies
6. **HTTPException detail format**: Error responses wrapped in `detail` field - test with `response.json()["detail"]`

**⚠️ Important:** Backend services (auth:3001, user:3002, ai:3003) have NO external port exposure. All API requests must go through API Gateway (8001) or Nginx (80/443).

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
- Adding new test files requires: `docker compose build SERVICE` (copies into container)
- Use `docker compose run --rm SERVICE pytest` (works even when container not running)
- Changes to existing test files use volume mounts (no rebuild needed)

**AsyncMock Defensive Pattern:**
- Always mock ALL async methods in execution path, even when expecting early rejection
- Prevents breakage if thresholds/conditions change in future
- Example: Low-confidence rejection tests should still mock downstream services (RAG, Ollama)

**Flags:**
- `--all` (default): Run both unit and integration tests
- `--unit`: Unit tests only
- `--integration`: Integration tests only
- `--skip-init`: Skip build/start/migrations (services already running)

**Jupyter Notebook Testing (E2E Integration):**
- Location: `scripts/jupyter/test_ai_service.ipynb`
- Purpose: Test full vision pipeline with real images through API Gateway
- Setup: Notebook handles JWT authentication automatically
- Images: Place test images in `scripts/jupyter/` directory
- Run: `jupyter notebook scripts/jupyter/test_ai_service.ipynb` (requires `make up` first)
- Note: All requests route through API Gateway (localhost:8001) with proper JWT tokens
- Note: notebooks uses real database transactions on `smartbreeds` database (production-like). Make sure to clean up test data as needed. Every run must use unique user accounts to avoid conflicts and leave a clean state.

**Debugging ML Models in Containers:**
- Direct `docker exec` Python commands loading large models often hang → use script approach instead
- Pattern: Create test script locally, `docker cp script.py container:/tmp/`, then `docker exec container python /tmp/script.py`
- For image testing: Copy test images into container with `docker cp` (test directories not mounted by default)
- Use `timeout` command wrapper for long-running inference: `timeout 60 docker exec container python script.py`

## Security Considerations

- **JWT Tokens**: RS256 asymmetric algorithm, stored in HTTP-only cookies
  - Auth Service: Signs tokens with RSA private key (jwt-private.pem, never shared)
  - API Gateway: Verifies tokens with RSA public key only (jwt-public.pem, read-only mount)
  - Key generation: 2048-bit RSA, stored in `srcs/auth-service/keys/`
  - Volume mount: `./srcs/auth-service/keys/jwt-public.pem:/app/keys/jwt-public.pem:ro`
- **Network Isolation**: Backend services not exposed externally, only via API Gateway
- **Rate Limiting**: Two layers (NGINX: 200/min, API Gateway: 60/min per user)
- **Password Hashing**: argon2 in auth service
- **HTTPS**: TLS 1.2+ via Nginx (self-signed cert in dev, replace in production)
- **Token Blacklist**: Redis-backed for logout (optional: check in API Gateway middleware)

## Current State

**Completed:**
- API Gateway (FastAPI) with full middleware stack - 30 passing tests
- Auth Service (Django) with authentication endpoints - 77 passing tests
- User Service (Django) with profile and pet management - 73 passing tests
- AI Service (FastAPI) with multi-stage vision pipeline - 47 passing tests
- Classification Service (FastAPI) with HuggingFace models - 28 passing tests
- Multi-stage vision pipeline (Classification → RAG → Ollama orchestration)
- Crossbreed detection with intelligent thresholding
- RAG system with ChromaDB for breed knowledge enrichment + bulk initialization endpoint
- Docker infrastructure with isolated networks
- Nginx reverse proxy configuration
- Redis integration for rate limiting and caching
- Ollama GPU setup for AI inference (qwen3-vl:8b model)
- Jupyter notebook for E2E pipeline testing

**In Progress:**
- Frontend (React scaffolding exists, needs implementation)

**Recently Completed:**
- Recommendation Service — content-based filtering with 53 passing tests (30 unit + 23 integration)
- Classification Service GPU support for RTX 5060 Ti (Blackwell) using PyTorch 2.11 nightly

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
- Using PyTorch 2.11 nightly (2.11.0.dev20260128+cu128) for RTX 5060 Ti Blackwell support
- Torchvision: 0.25.0.dev20260128+cu128
- CUDA 12.8 runtime required
- Environment variable `DEVICE=auto` detects GPU automatically (falls back to CPU if unavailable)
- Verify GPU: `docker exec ft_transcendence_classification_service python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"`
- Check docker-compose.yml: `runtime: nvidia` and `deploy.resources.reservations.devices` configured
- **Note:** Nightly PyTorch versions may have breaking changes - pin to specific nightly build in requirements.txt

**Crossbreed detection returning false positives:**
- Check confidence thresholds in `crossbreed_detector.py`
- Minimum second breed threshold: 20% (prevents noise from triggering crossbreed)
- Review test cases: `test_crossbreed_detector.py` for expected behavior
- Confidence scale is 0.0-1.0 (0.26 = 26%, not 74%)
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

## Reference Documentation

- Full architecture details: `ARCHITECTURE.md`
- API testing workflows: `docs/API_TESTING_GUIDE.md`
- Implementation plans: `docs/plans/` (TDD step-by-step guides for each service)
