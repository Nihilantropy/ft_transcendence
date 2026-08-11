# SmartBreeds - Architecture Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Microservices Architecture](#microservices-architecture)
3. [AI/ML Services Architecture](#aiml-services-architecture)
4. [Service Communication](#service-communication-architecture)
5. [Authentication Flow](#authentication-flow)
6. [Technology Stack](#technology-stack--rationale)
7. [Data Flow & Integration](#data-flow--integration-patterns)
8. [Database Architecture](#database-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Architecture Summary](#architecture-summary)

---

## Architecture Overview

SmartBreeds uses a **microservices architecture** with clear separation of concerns. The system is divided into specialized services that communicate via REST APIs, orchestrated through a central API Gateway. This design provides scalability, maintainability, and allows independent deployment of services.

### Core Design Principles

- **Separation of concerns**: Each microservice handles a specific domain (auth, users, AI vision, ML recommendations, RAG)
- **API Gateway pattern**: Single entry point for clients, handles routing, authentication, and request validation
- **Stateless services**: Services don't maintain session state, enabling horizontal scaling
- **HTTP-only JWT cookies**: Secure authentication without exposing tokens to client-side JavaScript

### High-Level Service Layers

1. **Presentation Layer**: *Not implemented* — planned React SPA behind Nginx (`srcs/frontend/` is an empty placeholder, the compose service is commented out, and Nginx currently answers `/` with a JSON stub)
2. **Gateway Layer**: FastAPI API Gateway (request routing, JWT validation, rate limiting)
3. **Business Logic Layer**: Django microservices (auth-service, user-service) plus the FastAPI recommendation-service
4. **AI/ML Layer**: AI Service (vision orchestration + RAG) calling LLMs through the LiteLLM proxy (local Ollama or hosted Mistral), plus the classification-service (HuggingFace species/breed/NSFW models, `local` profile only)
5. **Data Layer**: PostgreSQL (persistent storage) and Redis (rate-limit counters)

### Network Topology

- **Proxy Network**: Nginx only (public-facing; host ports 8000→80 and 8443→443). Nginx is dual-homed and also joins the backend network to reach the API Gateway
- **Backend Network**: API Gateway ↔ Microservices ↔ LiteLLM ↔ PostgreSQL/Redis (internal only). The API Gateway publishes 8001 to the host for development testing only
- Services communicate only through defined REST APIs, never direct database access across service boundaries

---

## Microservices Architecture

### 1. Frontend (planned — not implemented)

- **Status**: Not implemented. `srcs/frontend/` contains only empty placeholder files and the compose service is commented out (`docker-compose.yml`)
- **Planned purpose**: User interface for pet image upload, breed identification, and product recommendations
- **Planned technology**: React + Vite + Tailwind CSS
- **Communication**: REST API calls to Nginx (`/api/*`), which proxies to the API Gateway
- **Deployment**: Nginx currently answers `/` with a JSON stub; the frontend `location` block in `srcs/nginx/conf.d/default.conf.template` is commented out and targets the Vite dev server at `http://frontend:5173`

### 2. API Gateway (FastAPI)

- **Purpose**: Single entry point, request routing, JWT validation, rate limiting
- **Technology**: FastAPI (Python async), Pydantic for validation
- **Key Responsibilities**:
  - Validate HTTP-only JWT cookies on incoming requests
  - Extract user context (`user_id`, `role`, `email`) from the JWT
  - Forward requests to the matching backend service, injecting `X-User-ID`, `X-User-Role`, `X-Request-ID`
  - Route by a fixed prefix allow-list (`SERVICE_ROUTES` in `routes/proxy.py`): `/api/v1/auth`, `/api/v1/users`, `/api/v1/pets`, `/api/v1/vision`, `/api/v1/recommendations`, `/api/v1/admin/products`; anything else returns 404
  - Handle CORS, rate limiting (60 req/min, Redis-backed), request logging
- **Why FastAPI**: Extremely fast (async), minimal overhead, perfect for high-throughput routing

### 3. Auth Service (Django)

- **Purpose**: User authentication, registration, JWT token management
- **Technology**: Django 5.0.1, Django REST Framework 3.14, PyJWT 2.8, argon2-cffi (Python 3.11)
- **Key Responsibilities**:
  - User registration and login
  - Issue HTTP-only JWT cookies (secure, httpOnly, sameSite flags)
  - Token refresh, logout (refresh-token revocation), and token verification
  - Password change (revokes all sessions and re-issues tokens) and account deletion
  - Password hashing (Argon2, with PBKDF2 as fallback hasher)
- **Database**: PostgreSQL — `auth_schema` (`users`, `refresh_tokens`)

### 4. User Service (Django)

- **Purpose**: User profile management, pet profiles
- **Technology**: Django 5.1.5, Django REST Framework 3.15 (Python 3.11)
- **Key Responsibilities**:
  - CRUD operations for user profiles (`GET/PUT/PATCH /api/v1/users/me`)
  - Pet profiles (name, species, breed, breed_confidence, age, weight, health conditions, image_url)
  - Pet analysis history (`/api/v1/analyses`, `GET`/`POST` only) — written by the *client* posting a
    vision result, not by the AI Service; the create serializer takes `user_id` from the request body.
    The API Gateway has no `SERVICE_ROUTES` entry for this prefix, so it is unreachable from outside
    `backend-network`
  - User preferences and settings (JSON field on the profile)
  - Ownership-based permissions (IsOwnerOrAdmin)
- **Database**: PostgreSQL — `user_schema` (`user_profiles`, `pets`, `pet_analyses`)

---

## AI/ML Services Architecture

### 5. Inference Gateway (LiteLLM) + Ollama

- **Purpose**: Single OpenAI-compatible endpoint for every LLM call in the system
- **Technology**: `ghcr.io/berriai/litellm:main-stable` proxy on port 4000, fronting either a local Ollama server (`ollama/ollama:0.15.4`, NVIDIA runtime, model `qwen3-vl:8b`) or hosted Mistral
- **Model aliases** (`srcs/litellm/config.yaml`):

| Alias | Backend | Profile |
|-------|---------|---------|
| `vision-model` / `text-model` | `ollama_chat/qwen3-vl:8b` | `local` |
| `vision-model-cloud` | `mistral/mistral-medium-latest` (vision-capable) | `cloud` |
| `text-model-cloud` | `mistral/mistral-large-latest` | `cloud` |

- **Auth**: `LITELLM_MASTER_KEY` on the proxy must equal `LLM_API_KEY` in `srcs/ai/.env`
- **Compose profiles**: `litellm` runs in both profiles; `ollama` is `profiles: ["local"]` only
- **Ports**: `litellm` has no published port (reachable only on `backend-network`); `ollama` publishes `11434:11434` to the host
- **Communication**: the AI Service POSTs `{LLM_BASE_URL}/chat/completions` (default `http://litellm:4000/v1`). No service calls Ollama directly, and the API Gateway has no route to either container.
- **Why a proxy**: swapping local GPU inference for a hosted provider is a config change (model alias in `srcs/ai/.env`), not a code change

### 6. AI Service (FastAPI vision orchestrator + RAG)

**Purpose**: Orchestrates the multi-stage vision pipeline and owns the RAG knowledge base. Internal port 3003, `backend-network` only, no published host port.

**Technology Stack** (`srcs/ai/requirements.txt`, `srcs/ai/Dockerfile`):
- **python:3.12.10-slim** base image
- **FastAPI 0.110.0 / uvicorn 0.27.0**: REST API framework (async, 2 workers)
- **httpx 0.27.0**: OpenAI chat-completions calls to the LiteLLM proxy
- **ChromaDB 1.4.1**: persistent vector store at `/app/data/chroma` (volume `ai-chroma-data`)
- **sentence-transformers 5.2.0**: embeddings via `all-MiniLM-L6-v2` (384-dim)
- **tiktoken 0.12.0**: token-aware chunking (`CHUNK_SIZE`=500, `CHUNK_OVERLAP`=50)
- **Pillow 10.2.0**: image validation and preprocessing

**Not used**: LlamaIndex (no `llama-index-*` package exists anywhere in the repo), scikit-learn and pandas (product scoring lives in the separate Recommendation Service).

#### A) Vision Analysis (Breed Identification)

- **Endpoint**: `POST /api/v1/vision/analyze`
- **Request**: `{"image": "<base64 JPEG/PNG, with or without a data:image/...;base64, prefix>"}` — the live request model is declared inline in `src/routes/vision.py`; the stricter data-URI-only `VisionAnalysisRequest` in `src/models/requests.py` is unused by the route
- **Flow** (`VisionOrchestrator.analyze_image`, full pipeline, `CLASSIFICATION_ENABLED=true`):
  1. Classification Service `POST /classify/content` — NSFW check → rejects with `CONTENT_POLICY_VIOLATION`
  2. Classification Service `POST /classify/species` — dog/cat only, gated by `SPECIES_MIN_CONFIDENCE` (0.10)
  3. Classification Service `POST /classify/breed` — top-5 breeds + crossbreed flag, gated by `BREED_MIN_CONFIDENCE` (0.05)
  4. RAG enrichment from ChromaDB — graceful degradation: a failure is logged and `enriched_info` is `null`, the request still succeeds
  5. Contextual LLM analysis: image + classification result + RAG context → LiteLLM `chat/completions` using `LLM_VISION_MODEL`
- **VLM-only path** (`CLASSIFICATION_ENABLED=false`, the `cloud` profile): stages 1-3 are skipped and the vision model performs species/breed/crossbreed detection itself. **No NSFW filter is applied in this mode** — moderation is delegated to the LLM provider.
- **Response data**: `species`, `breed_analysis`, `description`, `traits`, `health_observations`, `enriched_info`

#### B) RAG System (Pet Health Knowledge Base)

- **Endpoints** (`src/routes/rag.py`) — **internal only**: `/api/v1/rag` is deliberately absent from the API Gateway's `SERVICE_ROUTES`, so these 404 from outside the backend network:
  - `POST /api/v1/rag/query` - Ask questions about pet health, breed info
  - `POST /api/v1/rag/ingest` - Add a single markdown document (`content` + `metadata` + `source_name`)
  - `GET /api/v1/rag/status` - Collection stats (document/chunk counts)
  - `POST /api/v1/admin/rag/initialize` - Bulk-ingest the whole knowledge base; localhost-only (`require_localhost`), invoked by `make rag`
- **Flow**:
  1. **Ingestion**: markdown string → tiktoken chunking (500 tokens / 50 overlap) → `SentenceTransformer.embed` → ChromaDB collection `pet_knowledge`
  2. **Query**: question → embed → ChromaDB similarity search (`RAG_TOP_K`=5) → format context → prompt → LiteLLM `LLM_TEXT_MODEL` generates the answer
- **Components**:
  - `chromadb.PersistentClient` (`src/services/rag_service.py`): collection management, embedding storage and retrieval
  - `SentenceTransformer` (`src/services/embedder.py`): `all-MiniLM-L6-v2`, 384-dim vectors
  - tiktoken chunker (`src/services/document_processor.py`): section-aware markdown splitting
- **Data Sources**: 34 markdown files under `srcs/ai/data/knowledge_base/spiecies/{cats,dogs}/{purebreeds,crossbreeds,health}/` (`spiecies` is the actual on-disk spelling). No PDF or binary-document ingestion exists.

### 7. Classification Service (FastAPI + HuggingFace Transformers)

- **Purpose**: Structured image predictions consumed by the AI Service vision pipeline
- **Internal port**: 3004, `backend-network` only, `profiles: ["local"]` (absent in the `cloud` profile)
- **Endpoints** (no `/api/v1` prefix, internal calls only): `POST /classify/content` (NSFW), `POST /classify/species`, `POST /classify/breed`
- **Models** (deployed values from `srcs/classification-service/.env`): `Falconsai/nsfw_image_detection`, `dima806/animal_151_types_image_detection`, `prithivMLmods/Dog-Breed-120`, `dima806/cat_breed_image_detection`. Note `src/config.py:17` still *defaults* `DOG_BREED_MODEL` to `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit`; the `.env` value wins in Docker
- **Device**: `DEVICE=auto` (CUDA when available, CPU fallback); torch 2.11.0+cu128 / torchvision 0.26.0+cu128 pinned in the Dockerfile
- **Crossbreed detection** (`src/services/crossbreed_detector.py:65-76`, top two probabilities only): flagged if the second breed exceeds `CROSSBREED_PROBABILITY_THRESHOLD` (0.35), **or** if the top breed is below `PUREBRED_CONFIDENCE_THRESHOLD` (0.75) *and* the gap to the second is under `PUREBRED_GAP_THRESHOLD` (0.30) *and* the second exceeds `CROSSBREED_MIN_SECOND_BREED` (0.05). On a crossbreed verdict `confidence` is replaced by the mean of the top two and `primary_breed` by a common name or `<a>_<b>_mix`
- **Dead config here**: this service also declares `SPECIES_MIN_CONFIDENCE` / `BREED_MIN_CONFIDENCE`, but nothing reads them — the enforced thresholds are the identically named settings in `srcs/ai/src/config.py`. `NSFW_REJECTION_THRESHOLD` is echoed in the response but `is_safe` is decided by a literal `0.5` (`nsfw_detector.py:61`)

### 8. Recommendation Service (FastAPI + scikit-learn)

- **Purpose**: Content-based product recommendations. A **separate service**, not part of the AI Service.
- **Technology**: FastAPI, scikit-learn + numpy, SQLAlchemy (async) + asyncpg on PostgreSQL, Python 3.12
- **Internal port**: 3005, `backend-network` only, runs in both compose profiles
- **Database**: PostgreSQL — `recommendation_schema` (`products`, plus the inert `recommendations` and `user_feedback` tables)
- **Endpoints**:
  - `GET /api/v1/recommendations/food?pet_id=<uuid>&limit=<n>&min_score=<f>`
  - `POST|GET|PUT|DELETE /api/v1/admin/products[/{product_id}]` (catalog administration)
- **Flow** (content-based, no LLM):
  1. Fetch the pet profile from the User Service using the `X-User-ID` header injected by the gateway (404 `PET_NOT_FOUND` if the pet is not owned by the caller)
  2. Build 15-dimensional feature vectors for the pet and for every catalogue product
  3. Weighted cosine similarity (`sklearn.metrics.pairwise.cosine_similarity` against `WEIGHT_VECTOR`, built at import time in `src/config.py:22-38` — health conditions 0.40, age 0.20, nutrition 0.20, size 0.10 split across two dimensions), drop scores below `MIN_SIMILARITY_THRESHOLD` (0.3), rank descending, truncate to `limit`. `WEIGHT_INGREDIENT_PREFERENCES` (0.10) is **dead config**: the ingredient dimension is a hard-coded `0.0` literal at `src/config.py:37`, and index 2 is a hard-coded `0.05`
  4. Attach `match_reasons` — **deterministic rule-derived strings** ("Targets joint health", "Good for sensitive stomach", "Nutritionally compatible"). No LLM or RAG is involved.
- **Response**: `{pet, recommendations: [{product_id, name, brand, price, product_url, image_url, similarity_score, rank_position, match_reasons, nutritional_highlights}], metadata, algorithm_version: "content-based-v1.0"}`

**Architecture Notes**:
- **Not a single container**: the AI/ML layer is five containers — `litellm`, `ollama` (`local` only), `ai-service`, `classification-service` (`local` only), `recommendation-service`
- **One LLM interface**: every LLM call is an OpenAI chat-completions request to LiteLLM, so switching local↔cloud is a model-alias change in `srcs/ai/.env` with no code change
- **LiteLLM abstraction**: LiteLLM (not LlamaIndex) handles provider routing and parameter compatibility (`drop_params: true`); the AI Service uses a plain `httpx.AsyncClient` with `LLM_TIMEOUT` (default 300s, since local crossbreed inference can take 120-180s)
- **Grounded, not generated-explanations**: RAG grounds the vision narrative in the markdown knowledge base; recommendation `match_reasons` are deterministic rule strings, not generated text
- **Graceful degradation**: RAG failures are non-fatal to `/api/v1/vision/analyze`; classification failures are fatal unless `CLASSIFICATION_ENABLED=false`, which switches to the VLM-only pipeline (no NSFW filter)

---

## Service Communication Architecture

### Communication Pattern: REST APIs

All microservices communicate via **synchronous REST APIs** over HTTP. This provides:
- **Simplicity**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **Debugging**: Easy to trace, log, and monitor
- **Tooling**: Extensive ecosystem (Postman, OpenAPI, curl)
- **Statelessness**: Each request contains all necessary information

### Network Topology

**Two isolated Docker networks:**

1. **`proxy` Network** (external-facing):
   - NGINX only — it is the sole service attached (`docker-compose.yml:14-16`)
   - The `frontend` service that would live here is commented out (`docker-compose.yml:156-176`); `srcs/frontend/` contains only empty placeholder files

2. **`backend-network`** (internal):
   - NGINX → API Gateway (`proxy_pass http://api-gateway:8001`)
   - API Gateway → Auth Service (3001), User Service (3002), AI Service (3003), Recommendation Service (3005)
   - AI Service → LiteLLM (4000); in the `local` profile also → Classification Service (3004)
   - LiteLLM → Ollama (11434, `local` profile only) or hosted Mistral (`cloud` profile)
   - Recommendation Service → User Service (3002) directly, not through the gateway
   - Auth Service → User Service (3002) directly, on account deletion only (`DELETE /api/v1/users/delete`)
   - Auth / User / Recommendation Services → PostgreSQL (`db:5432`, database `smartbreeds`)
   - API Gateway → Redis (rate limiting); no other service uses Redis
   - AI Service and Classification Service are stateless — no PostgreSQL, no Redis

**Key principle**: **NGINX** is the only service attached to both networks (`docker-compose.yml:14-16`); the API Gateway lives on `backend-network` only (`docker-compose.yml:304-305`) and is reached by NGINX across that network. Auth, User, AI, Classification, Recommendation, LiteLLM, PostgreSQL and Redis publish no host ports. Two exceptions exist for development convenience: the API Gateway publishes `8001:8001` (`docker-compose.yml:294-295`) and, in the `local` profile, Ollama publishes `11434:11434` (`docker-compose.yml:68-69`). NGINX itself is published on `8000:80` and `8443:443`, not 80/443.

### Request Flow Example: Pet Image Analysis

```
1. Client (curl, Jupyter notebook, or future frontend — none exists today)
2. POST /api/v1/vision/analyze  body: {"image": "<base64 JPEG/PNG>"}
   → NGINX (https://localhost:8443) or straight to the gateway (http://localhost:8001)
3. Nginx → API Gateway: terminates TLS, applies its rate limit
   (zone general_limit, 200 r/m per IP, burst 20),
   proxy_pass http://api-gateway:8001
   CAVEAT: nginx sets proxy_read_timeout 30s on /api
   (srcs/nginx/conf.d/default.conf.template:89), so a vision request that
   actually needs the gateway's 300s budget only survives when the client
   bypasses nginx and hits http://localhost:8001 directly.
4. API Gateway:
   - Extracts JWT from the `access_token` HTTP-only cookie
   - Validates RS256 signature + expiration, extracts user_id / role
   - Matches the path prefix against SERVICE_ROUTES → AI Service
   - Forwards to http://ai-service:3003 with headers:
     X-User-ID: 3f2a1c9e-7b41-4d0a-9c2e-15b8d4a6e701   (UUID, not an integer)
     X-User-Role: user
     X-Request-ID / X-Correlation-ID: <uuid>
   - Uses a 300s timeout for /api/v1/vision (default is 30s)
5. AI Service (VisionOrchestrator):
   - `local` profile: Classification Service → NSFW check, species, breed
     (`cloud` profile: skipped — the vision LLM does species/breed, no NSFW filter)
   - RAG lookup against ChromaDB for breed knowledge
   - POST /chat/completions to LiteLLM (http://litellm:4000/v1), which routes to
     Ollama qwen3-vl:8b (`local`) or Mistral (`cloud`)
6. AI Service → Response:
   {success, data: {species, breed_analysis, description, traits,
                    health_observations, enriched_info}, error, timestamp}
7. API Gateway → Client (backend response forwarded unchanged)
```

### Inter-Service Communication Standards

**Headers passed by API Gateway to backend services** (set only for authenticated requests — the public endpoints `/health`, `/docs`, `/openapi.json`, `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` bypass the auth middleware and receive none of them):
- `X-User-ID`: Authenticated user ID (string)
- `X-User-Role`: User role (user, admin)
- `X-Request-ID`: Unique request ID for tracing (UUID, generated per request)
- `X-Correlation-ID`: Caller-supplied `X-Correlation-ID`, else the same UUID as `X-Request-ID`

The gateway also strips the `Cookie` header for every path that does not start with `/api/v1/auth` (`srcs/api-gateway/routes/proxy.py:98-99`).

**Response format (all services):**
```json
{
  "success": true,
  "data": { /* payload */ },
  "error": null,
  "timestamp": "2026-01-13T10:30:00Z"
}
```

**Error format:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BREED_DETECTION_FAILED",
    "message": "Unable to identify breed with sufficient confidence",
    "details": {}
  },
  "timestamp": "2026-01-13T10:30:00Z"
}
```

**Caveats to the envelope:**
- `timestamp` is not uniformly formatted, not even within one service:
  - auth/user-service `utils.py` emit `utcnow().isoformat() + 'Z'`, but their `Custom404Middleware`
    emits a bare `utcnow().isoformat()` (`auth .../middleware.py:36`, `user .../middleware.py:49`).
  - AI Service `src/utils/responses.py` (RAG routes) emits `datetime.now(UTC).isoformat()`
    (`+00:00`), while `src/routes/vision.py:53` emits a naive `utcnow().isoformat()`.
  - Recommendation Service emits `datetime.now(UTC).isoformat()` (`+00:00`) everywhere.
  - The API Gateway emits a naive `utcnow().isoformat()`; worse, in `utils/responses.py:16` it is a
    Pydantic **field default evaluated once at class-definition time**, so every envelope built by
    `main.py`'s exception handlers reports the worker's start time rather than the request time.
    The inline dicts in the gateway middlewares and `routes/proxy.py` call `utcnow()` per request.
- FastAPI services (ai-service, recommendation-service) raise `HTTPException` and register no exception handlers, so their error envelopes arrive **nested under `detail`**: `{"detail": {"success": false, "error": {...}}}`. Only the API Gateway has handlers that return the flat envelope shown above.
- The `details` key is not universal: the AI Service's vision route builds its error object with only
  `code` and `message` (`src/routes/vision.py:72-82`), so `BREED_DETECTION_FAILED` responses carry no
  `details` field at all.

---

## Authentication Flow

### Why HTTP-Only JWT Cookies?

- **Security**: Token not accessible to JavaScript (XSS protection)
- **Automatic**: Browser sends cookie with every request
- **CSRF Protection**: Combined with SameSite attribute
- **Stateless access token**: the access JWT carries all user context, so the API Gateway validates it with no database or session lookup
- **Stateful refresh token**: each refresh token has a row in `auth_schema.refresh_tokens` (SHA-256 hash + `is_revoked`) that `/api/v1/auth/refresh` verifies, so refresh tokens are revocable server-side

### JWT Generation & Validation (RS256)
- **Signing**: Auth Service signs JWTs with private key (RS256)
- **Validation**: API Gateway verifies JWTs with public key

### JWT Token Structure

**Access token payload** (`jwt_utils.generate_access_token`):
```json
{
  "user_id": "3f2a1c9e-7b41-4d0a-9c2e-15b8d4a6e701",
  "email": "user@example.com",
  "role": "user",
  "token_type": "access",
  "iat": 1705140000,
  "exp": 1705140900
}
```

**Refresh token payload** (`jwt_utils.generate_refresh_token`) — carries no email or role, and a `token_id` pointing at the `refresh_tokens` row:
```json
{
  "user_id": "3f2a1c9e-7b41-4d0a-9c2e-15b8d4a6e701",
  "token_id": "9d81c4a2-0e35-42fb-8a17-6c0f2b93de54",
  "token_type": "refresh",
  "iat": 1705140000,
  "exp": 1705744800
}
```

**Cookie Attributes** (set in `apps/authentication/utils.py:issue_auth_tokens`):

| Attribute | `access_token` | `refresh_token` |
|-----------|----------------|-----------------|
| `httpOnly` | true | true |
| `secure` | `COOKIE_SECURE` — **false** in the shipped `.env`, so no `Secure` attribute is emitted over plain HTTP dev | same |
| `sameSite` | `COOKIE_SAMESITE` = "Strict" | same |
| `maxAge` | `JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60` = 900 s (15 min) | `JWT_REFRESH_TOKEN_LIFETIME_DAYS * 86400` = 604800 s (7 d) |
| `path` | "/" | "/api/v1/auth/refresh" |
| `domain` | `COOKIE_DOMAIN`, omitted entirely when it is the literal `localhost` | same |

### Authentication Flows

> **Note:** there is no frontend yet — `srcs/frontend/` is empty and both its compose service and
> the nginx `location /` that would proxy to it are commented out. "Client" below therefore means
> any HTTP client (the Jupyter notebooks, curl, or a future browser app). A browser client enters
> through Nginx on `localhost:8000` / `localhost:8443`, which proxies `/api` to `api-gateway:8001`;
> the gateway's own port 8001 is additionally exposed for direct development testing.

#### 1. Registration Flow

```
1. Client → API Gateway: POST /api/v1/auth/register
   Body: {email, password, password_confirm, first_name?, last_name?}
2. API Gateway: /api/v1/auth/register is in the public endpoint set — no JWT required
3. API Gateway → Auth Service: Forward request (Cookie header is preserved for /api/v1/auth/*)
4. Auth Service (RegisterView):
   - Validate email uniqueness (case-insensitive), password strength, password == password_confirm
     → 409 EMAIL_ALREADY_EXISTS or 422 VALIDATION_ERROR
   - Hash password (Argon2, PBKDF2 fallback)
   - Create user in PostgreSQL (auth_schema.users)
   - Generate JWT access token (15 min) + refresh token (7 d), insert a refresh_tokens row
   - Set HTTP-only cookies
5. Response 201 → Client:
   {success: true,
    data: {user: {id, email, first_name, last_name, role, is_verified}},
    error: null, timestamp: "..."}
   Set-Cookie: access_token=xxx; HttpOnly; SameSite=Strict; Max-Age=900; Path=/
   Set-Cookie: refresh_token=yyy; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/api/v1/auth/refresh
   (Secure is emitted only when COOKIE_SECURE=true; the shipped .env sets it to False)
```

#### 2. Login Flow

```
1. Client → API Gateway: POST /api/v1/auth/login   (public path, no JWT required)
   Body: {email, password}
2. API Gateway → Auth Service: Forward request
3. Auth Service (LoginView):
   - Query user by email (email__iexact, case-insensitive)
     → 401 INVALID_CREDENTIALS if no such user
   - Reject disabled accounts → 403 ACCOUNT_DISABLED
   - Verify password hash (Argon2) → 401 INVALID_CREDENTIALS
   - Single-session policy: revoke every non-revoked refresh_tokens row for this user
     (logging in elsewhere invalidates the previous session's refresh token)
   - Generate JWT tokens (access 15 min + refresh 7 d), insert a new refresh_tokens row
   - Set HTTP-only cookies
4. Response 200 → Client:
   {success: true,
    data: {user: {id, email, first_name, last_name, role, is_verified}},
    error: null, timestamp: "..."}
   Set-Cookie: access_token=xxx; HttpOnly; SameSite=Strict; Max-Age=900; Path=/
   Set-Cookie: refresh_token=yyy; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/api/v1/auth/refresh
```

#### 3. Authenticated Request Flow

```
1. Client → API Gateway: GET /api/v1/pets
   Cookie: access_token=xxx (automatically sent by browser)
2. API Gateway (JWTAuthMiddleware → RateLimitMiddleware → proxy):
   - Path is not in the public endpoint set → authentication required
   - Extract access_token from cookie
   - Verify JWT signature with the RS256 public key only (python-jose; no HS256/shared-secret path)
   - Check expiration
   - Extract user_id, role and email from payload
   - Rate limit (Redis, RATE_LIMIT_PER_MINUTE=60 per user)
   - Match the longest SERVICE_ROUTES prefix (/api/v1/pets → user-service:3002)
   - Strip the inbound Cookie header (kept only for /api/v1/auth/*) and add:
     X-User-ID: 3f2a1c9e-7b41-4d0a-9c2e-15b8d4a6e701
     X-User-Role: user
     X-Request-ID: <generated uuid4>
     X-Correlation-ID: <inbound X-Correlation-ID, else the request id>
3. User Service (UserContextMiddleware):
   - Trusts API Gateway validation; copies X-User-ID / X-User-Role onto the request object
   - IsOwnerOrAdmin permission + queryset filtered by user_id (admins see all)
   - Query user's pets from user_schema.pets
4. Response → Client: {success: true, data: [pets], error: null, timestamp: "..."}
```

#### 4. Token Refresh Flow

```
1. Client receives 401 UNAUTHORIZED (access token expired — 15 min lifetime)
2. Client → API Gateway: POST /api/v1/auth/refresh   (public path, no access token needed)
   Cookie: refresh_token=yyy (sent automatically — the cookie is path-scoped to exactly this URL)
3. API Gateway → Auth Service: Forward request (cookies are preserved for /api/v1/auth/*)
4. Auth Service (RefreshView):
   - Decode the refresh JWT with the public key; require token_type == "refresh"
   - Load the refresh_tokens row by the token's token_id
     → missing: 401 INVALID_TOKEN | revoked: 401 TOKEN_REVOKED
     → sha256(token) != stored token_hash: 401 INVALID_TOKEN
   - Check the user still exists and is active (403 ACCOUNT_DISABLED)
   - Rotation: set is_revoked=True on the current row, then issue a new access token (15 min)
     and a new refresh token (7 d) backed by a new row
   - Set new cookies
5. Response 200 → Client:
   {success: true,
    data: {user: {id, email, first_name, last_name, role, is_verified}},
    error: null, timestamp: "..."}
   Set-Cookie: access_token=new_xxx; HttpOnly; SameSite=Strict; Max-Age=900; Path=/
   Set-Cookie: refresh_token=new_yyy; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/api/v1/auth/refresh
6. Client retries the original request with the new token
```

#### 5. Logout Flow

```
1. Client → API Gateway: POST /api/v1/auth/logout
   Cookie: access_token=xxx — /api/v1/auth/logout is NOT in the gateway's public endpoint set,
   so a missing or expired access token is rejected with 401 UNAUTHORIZED at the gateway
   and never reaches the auth service
2. API Gateway → Auth Service: Forward request (cookies preserved for /api/v1/auth/*)
3. Auth Service (LogoutView):
   - If a refresh_token cookie is present and decodes, set is_revoked=True on that
     refresh_tokens row in Postgres. There is no Redis token blacklist in this codebase —
     Redis is used only for gateway rate limiting
   - Clear both cookies; always returns 200, even for a missing/invalid/expired token
4. Response 200 → Client:
   {success: true, data: {message: "Successfully logged out"}, error: null, timestamp: "..."}
   Set-Cookie: access_token=; Max-Age=0; Path=/
   Set-Cookie: refresh_token=; Max-Age=0; Path=/api/v1/auth/refresh

CAVEAT: the refresh_token cookie is path-scoped to /api/v1/auth/refresh, so a real browser
never sends it to /api/v1/auth/logout. The revocation branch above is effectively dead in
production — logout clears the cookies but leaves the refresh token row usable.
```

#### 6. Remaining Auth Endpoints

```
GET    /api/v1/auth/verify
       access_token cookie → 200 {success, data: {user: {...}, valid: true}}
       401 MISSING_TOKEN / TOKEN_EXPIRED / INVALID_TOKEN (also when token_type != "access"
       or the user row is gone) | 403 ACCOUNT_DISABLED

PUT    /api/v1/auth/change-password
       access_token cookie + {current_password, new_password, new_password_confirm}
       401 UNAUTHORIZED (no cookie) / TOKEN_EXPIRED / INVALID_TOKEN | 403 ACCOUNT_DISABLED
       | 422 VALIDATION_ERROR
       → revokes ALL of the user's refresh tokens, then issues a fresh access+refresh pair

DELETE /api/v1/auth/delete
       access_token cookie → cascade delete:
       1. auth-service calls DELETE http://user-service:3002/api/v1/users/delete DIRECTLY
          (not through the gateway) with its own X-User-ID / X-User-Role / X-Request-ID headers
       2. deletes auth_schema.users row; refresh_tokens cascade via FK
       3. clears cookies
       Not atomic: if step 2 fails, the user-service data is already gone.
```

### Security Considerations

**API Gateway Validation:**
- JWT signature verification with the public key only (`auth/jwt_utils.py:decode_jwt`, python-jose). The algorithm comes from `JWT_ALGORITHM` (`config.py`, `RS256` by default and in the shipped `.env`) and the only key material mounted into the gateway is `jwt-public.pem` — it never holds the private key
- Expiration check: expired tokens raise `JWTValidationError` → 401 UNAUTHORIZED
- No token blacklist: Redis is used solely for rate limiting. Revocation is enforced only at refresh time, via `refresh_tokens.is_revoked` in the auth service
- The gateway does **not** check the `token_type` claim, so a refresh token placed in the `access_token` cookie currently passes gateway validation (`role` then defaults to `"user"`, since refresh payloads carry no role)

**Backend Services:**
- **Trust but verify**: Services trust `X-User-ID` / `X-User-Role` headers from the API Gateway (`UserContextMiddleware` in user-service copies them straight onto the request)
- Network isolation limits the blast radius: only containers attached to `backend-network` can reach a backend service at all. It does **not** make the gateway the sole sender — `auth-service` calls `DELETE http://user-service:3002/api/v1/users/delete` directly during account deletion, setting these headers itself
- Not implemented: signed/authenticated gateway headers, or mTLS between services

**Key Storage:**
- **RSA key pair, not a shared secret**: 4096-bit keys generated once by `srcs/auth-service/keys/generate-keys.sh`. `jwt-private.pem` (chmod 600, gitignored) never leaves auth-service; `jwt-public.pem` (chmod 644) is bind-mounted read-only into the API Gateway at `/app/keys/jwt-public.pem`
- Only the *paths* are environment-driven (`JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH`); both keys are loaded from disk once at startup by `load_jwt_keys()`
- **Key Rotation**: not implemented. There is no dual-key grace period — regenerating the pair invalidates every outstanding token immediately
- With `DEBUG=True`, a missing key file is swallowed: `JWT_KEYS` falls back to empty strings and the service boots and passes its healthcheck while every token operation fails (`config/settings.py:158-164`)

---

## Technology Stack & Rationale

### Frontend Layer

> **Status: not implemented.** `srcs/frontend/` currently holds four empty placeholder files, the compose service is commented out (`docker-compose.yml:156-176`), and nginx's `location /` returns a static API-info stub instead of proxying an app (`srcs/nginx/conf.d/default.conf.template:132`). The table below is the *intended* stack, not the deployed one.

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **React** | planned (no `package.json` exists — no version is pinned anywhere) | UI framework | Excellent ecosystem, component reusability, virtual DOM performance |
| **Vite** | planned | Build tool & dev server | Extremely fast HMR, modern ES modules, better DX than Webpack |
| **Tailwind CSS** | planned | Utility-first CSS | Rapid UI development, consistent design system, smaller bundle than component libraries |
| **Fetch API** | planned | HTTP client | Clean API for REST calls, automatic cookie handling for the HTTP-only auth cookies |

### API Gateway Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **FastAPI** | 0.115.0 | Gateway framework | Async/await for high concurrency, 3-5x faster than Django for routing, automatic OpenAPI docs, minimal overhead |
| **Pydantic** | 2.10.0 (+ pydantic-settings 2.6.0) | Request validation | Type-safe validation, automatic error messages, integrates with FastAPI |
| **python-jose[cryptography]** | 3.3.0 | JWT verification | RS256 signature verification against the auth-service public key (`auth/jwt_utils.py`). Note: `PyJWT` 2.10.0 is also pinned in `requirements.txt` but is unused by gateway code — token *signing* with PyJWT happens in auth-service |
| **uvicorn[standard]** | 0.32.0 | ASGI server | High-performance async server for FastAPI; `Dockerfile:21` runs it with `--workers 4` |
| **httpx / redis** | 0.28.0 / 5.2.0 | Backend calls, rate-limit counters | `httpx.AsyncClient` for proxying; the **synchronous** `redis` client is used inside async middleware (`middleware/rate_limit.py:10`) |

### Backend Services Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Django** | 5.0.1 (auth-service) / 5.1.5 (user-service) | Backend framework | Batteries-included, excellent ORM, admin panel, mature ecosystem, security features built-in. Pinned to 5.x because both services run on `python:3.11-slim` and Django 6 requires Python >= 3.12 |
| **Django REST Framework** | 3.14 (auth) / 3.15 (user) | REST API toolkit | Serializers, viewsets, authentication, browsable API for development |
| **PostgreSQL** | 15-alpine (pinned) | Primary database | ACID compliance, JSON support, full-text search, proven reliability. One shared instance (compose service `db`), one database `smartbreeds`, logically separated by schema |
| **SQLAlchemy[asyncio] + asyncpg** | 2.0.27 / 0.29.0 | Async ORM for FastAPI services | recommendation-service is FastAPI, not Django — it reaches the same PostgreSQL through an async engine (`src/utils/database.py`) rather than the Django ORM |
| **Redis** | 8.4.0-alpine3.22 | Rate-limit counters | In-memory counters for API Gateway rate limiting (`api-gateway/middleware/rate_limit.py`). This is currently the *only* Redis consumer — no token blacklist, session store or response cache exists, and neither Django service configures a `CACHES` backend |

### AI/ML Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **LiteLLM proxy** | `ghcr.io/berriai/litellm:main-stable` | Inference gateway | Single OpenAI-compatible endpoint for every LLM call; swapping local Ollama for a hosted provider is a config change in `srcs/litellm/config.yaml` plus a model alias in `srcs/ai/.env`, with no code change |
| **Ollama** | 0.15.4 (`local` profile only) | Self-hosted LLM runtime | GPU-accelerated, no API costs, multimodal support. Sits *behind* LiteLLM — the AI Service never calls port 11434 directly. Absent entirely in the `cloud` profile (`docker-compose.yml:49`) |
| **qwen3-vl:8b** | - | Vision + text model (`local`) | Multimodal (vision + language), 8B params balanced performance/resource, breed identification capable. Served by Ollama, exposed to the AI Service as the LiteLLM aliases `vision-model` / `text-model` |
| **mistral-medium-latest / mistral-large-latest** | - | Vision + text models (`cloud`) | Hosted fallback used when `LLM_VISION_MODEL`/`LLM_TEXT_MODEL` are set to `vision-model-cloud`/`text-model-cloud`; requires `MISTRAL_API_KEY`, needs no GPU (`srcs/litellm/config.yaml`) |
| **httpx** | 0.27.0 | LLM + service HTTP client | AI Service calls `POST {LLM_BASE_URL}/chat/completions` on the proxy directly (`src/services/ollama_client.py`); no orchestration framework (LlamaIndex/LangChain) is used |
| **tiktoken + PyYAML** | 0.12.0 / 6.0.2 | Document ingestion & chunking | Custom markdown processor: YAML frontmatter parsing, header-based splitting, token-budgeted chunking with overlap (`src/services/document_processor.py`). Markdown only — no PDF reader |
| **ChromaDB** | 1.4.1 | Vector database | Lightweight, embedded, no separate server needed, fast semantic search |
| **FastAPI** | 0.110.0 | AI service API | Async for ML inference, lightweight, consistent with gateway |
| **scikit-learn** | 1.4.1.post1 | ML algorithms | Feature engineering and cosine-similarity scoring in the **recommendation-service** (not in the AI Service) |
| **sentence-transformers** | 5.2.0 | Embedding model | `all-MiniLM-L6-v2`, 384-dimensional embeddings for RAG (`ai/src/config.py:42-43`); runs on CPU inside ai-service |
| **HuggingFace Transformers** | 4.46.3 | Image classifiers | Backs classification-service's NSFW, species and breed models (`classification-service/src/models/*.py`) |
| **PyTorch / torchvision** | 2.11.0+cu128 / 0.26.0+cu128 | Classifier runtime | Pinned in `classification-service/Dockerfile` (not requirements.txt) against the `cu128` index for RTX 5060 Ti (Blackwell) support; keep the pair version-matched |

### Infrastructure Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Nginx** | 1.25-alpine | Reverse proxy | TLS termination (self-signed cert in dev), request routing to the API Gateway, custom error pages, proven reliability. Application static-file serving is stubbed out until the frontend exists |
| **Docker** | Latest | Containerization | Consistent environments, easy deployment, service isolation |
| **Docker Compose** | Latest | Orchestration | Multi-container orchestration, network management, volume management. Two **profiles** select the inference topology: `local` adds `ollama` + `classification-service` (GPU, full pipeline), `cloud` runs neither (hosted Mistral, VLM-only, **no NSFW filter**). Set via `COMPOSE_PROFILES` — note `Makefile:9` currently defaults to `cloud` and exports it, overriding the root `.env` |

### Development & Deployment

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Git** | Version control | Industry standard, branching, collaboration |
| **pytest** | Testing (Python) | Simple, powerful, fixtures, async support |
| **Vitest** | Testing (Frontend) — *planned* | Fast, Vite-native, Jest-compatible API. Not installed: there is no frontend package yet |
| **pytest-cov** | Coverage (Python) | Pre-installed in ai, classification, recommendation and auth (dev) services; install on the fly elsewhere. *No Python formatter/linter (Black, Ruff, flake8) is configured in this repo.* |

### Key Architecture Decisions

**Why Microservices?**
- Independent scaling (Ollama and classification-service need GPU; the AI Service that orchestrates them is CPU-only and scales separately)
- Technology flexibility (FastAPI for gateway, Django for business logic)
- Team autonomy (different teams can own different services)
- Fault isolation (AI service crash doesn't affect auth)

**Why REST over GraphQL?**
- Simpler for small-medium teams
- Better caching (HTTP standard)
- Easier debugging and monitoring
- Sufficient for our use case (no complex nested queries)

**Why HTTP-Only Cookies over localStorage?**
- XSS protection (tokens not accessible to JavaScript)
- Automatic transmission (no manual header management)
- Better security posture for sensitive data

**Why LiteLLM instead of an orchestration framework (LlamaIndex/LangChain)?**
- One OpenAI-compatible endpoint for every LLM call — the AI Service only ever POSTs `/chat/completions` to `LLM_BASE_URL`
- Backend swap (local Ollama <-> hosted Mistral) is a config change in `srcs/litellm/config.yaml` + a model alias in `srcs/ai/.env`, with zero code change
- The RAG path is a few hundred lines (chromadb `PersistentClient` + `SentenceTransformer` + a markdown chunker), so a framework would add dependency weight without removing work
- Provider auth, retries and routing stay out of application code

---

## Data Flow & Integration Patterns

### End-to-End Flow: Pet Breed Identification with Product Recommendations

This example demonstrates how all services interact for a complete user journey:

```
1. USER ACTION: Upload pet image
   └─> HTTP client (curl / Jupyter notebook — no frontend exists: srcs/frontend holds
       four 0-byte files and the compose service is commented out)

2. API CALL: POST /api/v1/vision/analyze   body: {"image": "<base64 or data URI>"}
   └─> Nginx (HTTPS on host port 8443 → container 443; HTTP on 8000 → 80)
       └─> API Gateway (FastAPI, port 8001)
           ├─> Extract JWT from HTTP-only "access_token" cookie
           ├─> Validate RS256 signature & expiration (public key only)
           ├─> Extract user_id (UUID, e.g. 4b2f8c1e-…)
           └─> Forward with headers: X-User-ID, X-User-Role, X-Request-ID
               (proxy timeout 30s by default, 300s for the /api/v1/vision prefix)

3. VISION ANALYSIS:
   └─> AI Service: POST /api/v1/vision/analyze  (VisionOrchestrator)
       ├─> Stage 1: Classification Service POST /classify/content  (NSFW gate)
       ├─> Stage 2: Classification Service POST /classify/species  (reject if not dog/cat,
       │   or confidence < SPECIES_MIN_CONFIDENCE)
       └─> Stage 3: Classification Service POST /classify/breed  (top_k=5, crossbreed
           detection; reject if confidence < BREED_MIN_CONFIDENCE)
   NOTE: with CLASSIFICATION_ENABLED=false (cloud profile) stages 1-3 are skipped and the
         vision LLM performs species + breed detection itself — no NSFW filter is applied.

4. RAG ENRICHMENT (in-process, graceful failure):
   └─> RAGService.get_breed_context() / get_crossbreed_context()  (direct Python call,
       not an HTTP call to /api/v1/rag/query)
       ├─> Embed query with sentence-transformers all-MiniLM-L6-v2 (384-dim)
       ├─> ChromaDB "pet_knowledge" similarity search — n_results=5 for a single breed
       │   (rag_service.py:261), n_results=3 per parent breed for a crossbreed (:310)
       └─> Returns retrieved snippets only: description / care_summary / health_info / sources
           (no LLM generation in this step; on any error enriched_info becomes null and the
            pipeline continues)

5. LLM ANALYSIS:
   └─> OllamaVisionClient.analyze_with_context() → POST {LLM_BASE_URL}/chat/completions
       (LiteLLM proxy, default http://litellm:4000/v1, model alias "vision-model")
       ├─> Prompt = image + classification result + RAG context
       └─> LiteLLM routes to Ollama qwen3-vl:8b (local profile) or Mistral (cloud profile)
           └─> Returns: {description, traits, health_observations}

6. RESPONSE:
   └─> AI Service → API Gateway (pass-through, no aggregation) → client:
       {
         "success": true,
         "data": {
           "species": "dog",
           "breed_analysis": {
             "primary_breed": "golden_retriever",
             "confidence": 0.95,
             "is_likely_crossbreed": false,
             "breed_probabilities": [{"breed": "...", "probability": 0.95}],
             "crossbreed_analysis": null
           },
           "description": "...",
           "traits": {...},
           "health_observations": ["..."],
           "enriched_info": {"breed": "Golden Retriever", "description": "...",
                             "care_summary": "...", "health_info": "...", "sources": [...]}
         },
         "error": null,
         "timestamp": "2026-01-14T12:00:00.000000"
       }

7. SAVE TO DATABASE (separate client request — the gateway never chains calls):
   └─> POST /api/v1/pets
       └─> User Service (Django)
           ├─> Headers: X-User-ID (UUID), X-User-Role, X-Request-ID
           └─> Save pet profile to PostgreSQL (user_schema)
   NOTE: user-service also exposes /api/v1/analyses, but SERVICE_ROUTES in the gateway has
         no entry for that prefix, so analyses are unreachable from outside the network.

8. PRODUCT RECOMMENDATIONS (separate client request):
   └─> GET /api/v1/recommendations/food?pet_id=<uuid>&limit=10
       └─> Recommendation Service (FastAPI, port 3005)
           ├─> Fetches the pet directly from http://user-service:3002/api/v1/pets/{pet_id}
           ├─> 15-dimensional feature vectors, weighted cosine similarity (scikit-learn)
           └─> Returns ranked products: similarity_score, rank_position, match_reasons
               (rule-based strings such as "Targets joint health" — no LLM-generated text)
```

### Integration Patterns

#### Pattern 1: Prefix-Based Pass-Through Routing

**Use Case**: Every client request enters through one authenticated door

**Implementation**: `SERVICE_ROUTES` in `srcs/api-gateway/routes/proxy.py` maps a path prefix to exactly one backend. The gateway forwards the request 1:1 (method, body, query params, headers) and returns the backend response unchanged — it does **not** fan out or aggregate.
```
Client → API Gateway (prefix match, one backend per request):
  ├─> /api/v1/auth              → auth-service:3001
  ├─> /api/v1/users             → user-service:3002
  ├─> /api/v1/pets              → user-service:3002
  ├─> /api/v1/vision            → ai-service:3003
  ├─> /api/v1/recommendations   → recommendation-service:3005
  └─> /api/v1/admin/products    → recommendation-service:3005
Any other path → 404 NOT_FOUND (e.g. /api/v1/analyses, /api/v1/rag)
```

**Consequence**: a dashboard view needs one client request per resource; there is no gateway-side aggregation endpoint today.

#### Pattern 2: Direct Service-to-Service Calls

**Use Case**: A service needs data owned by another service

**Actual implementation**: the call goes **directly** to the owning service over the backend network, bypassing the API Gateway. Two such calls exist today: recommendation-service → user-service (pet profile) and auth-service → user-service (cascade delete on account deletion).
```
Recommendation Service needs the pet profile
  └─> GET http://user-service:3002/api/v1/pets/{pet_id}   (httpx, 10s timeout)
      ├─> Sends X-User-ID so user-service enforces ownership
      └─> Returns: pet profile (species, breed, age, weight, health_conditions)
Recommendation Service extracts features → weighted cosine ranking
```

**Trade-off**: no extra hop, but no gateway-side auth on this path — the callee trusts the `X-User-ID` header plus backend-network isolation. There is no internal shared secret or service-to-service JWT. The AI Service makes no user-service calls at all; it talks only to classification-service and the LiteLLM proxy.

#### Pattern 3: Async Processing (Future Enhancement — NOT IMPLEMENTED)

**Use Case**: Long-running ML training or batch recommendations

> Nothing below exists in the codebase: there is no `POST /api/v1/recommendations/batch`, no `/jobs`
> route, no Celery, no `BackgroundTasks`. This is a sketch of a possible future design only.

**Sketch**:
```
1. User triggers recommendation refresh
2. API Gateway → Recommendation Service: POST /api/v1/recommendations/batch
3. Recommendation Service:
   ├─> Returns immediately: {job_id: "abc123", status: "processing"}
   ├─> Async worker processes recommendations
   └─> Updates PostgreSQL when complete
4. Client polls: GET /jobs/abc123
   └─> Returns: {status: "completed", results: [...]}
```

**Implementation**: Use Celery + Redis or FastAPI BackgroundTasks

### Error Handling & Resilience

**Timeout Strategy:**
- API Gateway → Services: 30s default; 300s override for the `/api/v1/vision` prefix (`SERVICE_TIMEOUTS` in `srcs/api-gateway/routes/proxy.py`)
- AI Service → LiteLLM proxy: `LLM_TIMEOUT` = 300s (local crossbreed prompts take 120-180s)
- AI Service → Classification Service: `CLASSIFICATION_TIMEOUT` = 30s
- Recommendation Service → User Service: 10s (`UserServiceClient`)
- RAG queries: no timeout — ChromaDB runs in-process inside ai-service

**Retry Logic:**
- Not implemented. No service retries a failed call — there is no retry or backoff code in the repository, and no cached-response fallback.
- AI Service connect/timeout failures against classification-service or the LiteLLM proxy raise `ConnectionError` → HTTP 503 `VISION_SERVICE_UNAVAILABLE`; the client decides whether to retry. A non-2xx **HTTP status** from either dependency is a different path — see Graceful Degradation below.

**Circuit Breaker (Future):**
- If the LiteLLM proxy fails 5 times in 60s, open circuit for 5 minutes
- Return cached breed data or "Service temporarily unavailable"
- Not implemented today: an LLM failure surfaces immediately as 503 `VISION_SERVICE_UNAVAILABLE`

**Graceful Degradation (implemented):**
- RAG failure → pipeline continues, `enriched_info` returned as `null` (`vision_orchestrator.py` wraps stage 4 in try/except)
- Classification Service or LLM **unreachable / timed out** → HTTP 503 `VISION_SERVICE_UNAVAILABLE`, no fallback path (both clients catch only `httpx.ConnectError` and `httpx.TimeoutException` and re-raise `ConnectionError`)
- Classification Service or LiteLLM answering with a **non-2xx status** is *not* mapped to 503 on the main pipeline: `OllamaVisionClient.analyze_with_context` (`ollama_client.py:404-409`) lets `raise_for_status()`'s `httpx.HTTPStatusError` escape, so e.g. a wrong `LLM_API_KEY` surfaces as HTTP 500 `INTERNAL_ERROR`. The `analyze_breed` / `generate` paths do catch `httpx.HTTPError` and yield 503 — the two sides are inconsistent
- No products for the pet's species → HTTP 200 with an empty `recommendations` list and `metadata.message = "No products available for this species"`
- Not implemented: manual breed selection, cached breed data, "popular products" fallback

---

## Database Architecture

### Database Strategy: Shared PostgreSQL with Service Ownership

**Approach**: Single PostgreSQL instance with **logical separation** by schema/namespace. Each service owns its tables and never directly accesses another service's tables.

**Why Shared Database?**
- Simpler for initial deployment and development
- ACID transactions within service boundaries
- Easier backup and maintenance
- Lower infrastructure overhead
- Services communicate via APIs, not direct DB access

**Environments**: there is exactly one database, `smartbreeds`, served by the compose service `db` (`postgres:15-alpine`, credentials in `srcs/db/.env`). No separate test or staging database is provisioned in this repository — pytest-django creates and drops a throw-away `test_smartbreeds` at runtime for the two Django services. No production deployment topology exists in the repo, so nothing here describes one.

### Database Schemas

#### Auth Service Schema (`auth_schema`)

**Table: users**
```sql
- id (UUID, primary key)
- email (VARCHAR(255), unique, indexed)
- password (VARCHAR(128))         -- Django/argon2 hash; the column is `password`, not `password_hash`
- first_name (VARCHAR(150), blank)
- last_name (VARCHAR(150), blank)
- role (VARCHAR(20), Django choices: 'user' | 'admin', default 'user')  -- not a PG ENUM type
- is_active (BOOLEAN, default true)
- is_verified (BOOLEAN, default true)
- is_staff (BOOLEAN, default false)
- is_superuser (BOOLEAN, default false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP, nullable)  -- from AbstractBaseUser
```

`PermissionsMixin` also creates the join tables `users_groups` and `users_user_permissions` in `auth_schema` (unused by application code).

**Table: refresh_tokens** (created by migration `0002_refreshtoken`; written on every token issuance)
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key → users.id, ON DELETE CASCADE)
- token_hash (VARCHAR(64), unique, indexed)  -- SHA-256 of the issued JWT
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)                     -- written at creation, never read (JWT `exp` is authoritative)
- last_used_at (TIMESTAMP, nullable)         -- declared, never written
- is_revoked (BOOLEAN, default false)
```

**Indexes** (Django-generated names, see `migrations/0001_initial.py:35` and `0002_refreshtoken.py:29`):
- `users_email_4b85f2_idx` on users(email) - Fast login lookups (plus the UNIQUE constraint on email)
- `users_created_6541e9_idx` on users(created_at)
- `refresh_tok_token_h_2fa7c6_idx` on refresh_tokens(token_hash) - Token validation (plus the UNIQUE constraint)
- `refresh_tok_user_id_893d6c_idx` on refresh_tokens(user_id, is_revoked) - Bulk revocation per user
- `refresh_tok_expires_a128d9_idx` on refresh_tokens(expires_at) - Cleanup expired tokens

#### User Service Schema (`user_schema`)

**Table: user_profiles**
```sql
- id (UUID, primary key)
- user_id (UUID, unique, indexed) -- SOFT reference to auth_schema.users.id, no DB foreign key
- phone (VARCHAR(20), blank)
- address (JSONB, nullable)
- preferences (JSONB, default {}) -- UI settings, notification prefs
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
(`first_name` / `last_name` live on `auth_schema.users`, not here.)

**Table: pets**
```sql
- id (UUID, primary key)
- user_id (UUID, indexed) -- SOFT reference to auth_schema.users.id, no DB foreign key
- name (VARCHAR(100))
- breed (VARCHAR(100), blank)
- breed_confidence (FLOAT, nullable) -- From vision analysis
- species (VARCHAR(10), Django choices: 'dog' | 'cat' | 'other', default 'dog')
- age (INTEGER, nullable) -- in months
- weight (FLOAT, nullable) -- in kg
- health_conditions (JSONB, default []) -- Array of conditions
- image_url (VARCHAR(500), nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Table: pet_analyses** (History of vision analyses)
```sql
- id (UUID, primary key)
- pet_id (UUID, indexed)  -- SOFT reference to pets.id, no DB foreign key
- user_id (UUID, indexed) -- SOFT reference to auth_schema.users.id
- image_url (VARCHAR(500))
- breed_detected (VARCHAR(100))
- confidence (FLOAT)
- traits (JSONB, default {}) -- Size, energy, temperament
- raw_response (JSONB, nullable) -- Full AI response
- created_at (TIMESTAMP)
```

**Indexes** (Django-generated names, see `migrations/0001_initial.py:80-100` and the renames in `0002_rename_pet_user_created_idx_...py`):
- `user_profil_user_id_fbe33d_idx` on user_profiles(user_id) - Profile lookup (plus the UNIQUE constraint)
- `user_profil_created_26443b_idx` on user_profiles(created_at)
- `pets_user_id_6daacf_idx` on pets(user_id, created_at) - User's pet list
- `pets_species_a3549a_idx` on pets(species)
- `pet_analyse_pet_id_b12b89_idx` on pet_analyses(pet_id, created_at) - Pet history
- `pet_analyse_user_id_fd2abf_idx` on pet_analyses(user_id, created_at) - Recent analyses (`Meta.ordering = ['-created_at']` supplies the DESC ordering at query time)

#### Recommendation Service Schema (`recommendation_schema`)

**Table: products** (`migrations/002_create_tables.sql:5-64`)
```sql
- id (SERIAL, primary key)          -- INT, not UUID
- name (VARCHAR(255)), brand (VARCHAR(100)), description (TEXT)
- price (DECIMAL(10,2)), product_url (VARCHAR(500)), image_url (VARCHAR(500))
- target_species (VARCHAR(20), CHECK IN ('dog','cat'))
- min_age_months / max_age_months (INT, nullable)
- min_weight_kg / max_weight_kg (DECIMAL(5,2), nullable)
- suitable_breeds (TEXT[])
- protein_percentage / fat_percentage / fiber_percentage (DECIMAL(5,2), 0-100)
- calories_per_100g (INT)
- grain_free, organic, hypoallergenic, limited_ingredient, raw_food (BOOLEAN)
- for_sensitive_stomach, for_weight_management, for_joint_health,
  for_skin_allergies, for_dental_health, for_kidney_health (BOOLEAN)
- created_at, updated_at (TIMESTAMP), is_active (BOOLEAN, soft delete)
```

**Table: recommendations** (declared and migrated, **never written** by any code path)
```sql
- id (SERIAL, primary key)
- user_id (INT, NOT NULL)   -- typed INT although the platform uses UUIDs
- pet_id (INT, NOT NULL)    -- typed INT although the platform uses UUIDs
- product_id (INT, foreign key → recommendation_schema.products.id)
- similarity_score (DECIMAL(5,4), CHECK 0..1)
- rank_position (INT, CHECK > 0)
- created_at (TIMESTAMP)
```

**Table: user_feedback** (backlog: future supervised learning — declared and migrated, **never written**)
```sql
- id (SERIAL, primary key)
- user_id (INT, NOT NULL)
- pet_id (INT, NOT NULL)
- product_id (INT, foreign key → recommendation_schema.products.id)
- interaction_type (VARCHAR(20), CHECK IN ('click','view','purchase','rating'))
- interaction_value (DECIMAL(3,2))
- similarity_score (DECIMAL(5,4))
- created_at (TIMESTAMP)
```

There is **no** `rag_documents` table. Knowledge-base metadata is not stored in PostgreSQL at all — it lives as ChromaDB chunk metadata (see "ChromaDB Collections" below).

**Indexes** (`migrations/002_create_tables.sql:67-70, 83-84, 103-104`):
- `idx_products_species` on products(target_species) - Species filter
- `idx_products_active` on products(is_active) - Soft-delete filter
- `idx_products_brand` on products(brand)
- `idx_products_suitable_breeds` GIN on products(suitable_breeds)
- `idx_recommendations_user_pet` on recommendations(user_id, pet_id)
- `idx_recommendations_created` on recommendations(created_at)
- `idx_user_feedback_product` on user_feedback(product_id)
- `idx_user_feedback_created` on user_feedback(created_at)

#### AI Service Schema (`ai_schema`)

`ai_schema` is created by `srcs/db/init-scripts/01-init-schemas.sql:13` but is **empty** — it is reserved for future stateful AI features. The AI Service has no PostgreSQL client at all; its only persistence is the ChromaDB volume.

### Redis Cache Schema

**Key Patterns:**

```
# Rate limiting (api-gateway is the ONLY Redis consumer)
rate_limit:user:{user_id}   → count (SETEX, TTL: 60s)  # authenticated requests
rate_limit:ip:{ip_address}  → count (SETEX, TTL: 60s)  # unauthenticated requests
```

Nothing else is implemented today. There is **no** token blacklist, session cache, breed/recommendation response cache or LLM response cache — `redis` is a dependency of the API Gateway only (`srcs/api-gateway/requirements.txt`), and `REDIS_URL` appears in no other service's config. Key builder: `srcs/api-gateway/middleware/rate_limit.py:33,37`.

### ChromaDB Collections (Vector Store)

**Collection: pet_knowledge** (name from `CHROMA_COLLECTION_NAME`, `srcs/ai/src/config.py:39`)
```
- Vectors: 384-dimensional (sentence-transformers all-MiniLM-L6-v2)
- IDs: "chunk_{index}_{hash(content) % 10000}"   (rag_service.py:180 — Python string
  hashing is salted per process, so re-ingesting the same file after a restart duplicates it)
- Metadata: {
    source_file: string,        # path relative to data/knowledge_base
    source_type: "knowledge_base",
    chunk_index: int,
    ...plus every YAML frontmatter key of the source .md
       (doc_type, species, parent_breeds, topics, ...)
  }
- Documents: Text chunks (CHUNK_SIZE=500 tiktoken tokens, CHUNK_OVERLAP=50)
- Storage: chromadb.PersistentClient at CHROMA_PERSIST_DIR (./data/chroma → volume ai-chroma-data)
```

There is only one collection. Breed and crossbreed documents are ordinary markdown files under `srcs/ai/data/knowledge_base/` ingested into `pet_knowledge`; their frontmatter (`doc_type`, `species`, `parent_breeds`, ...) is what distinguishes them at query time.

### Data Relationships

```
auth_schema                     user_schema
  users ──┐                       user_profiles  (user_id  → users.id, soft)
          │  soft UUID refs,      pets           (user_id  → users.id, soft)
          └─ no cross-schema FK ─ pet_analyses   (pet_id → pets.id, user_id → users.id, soft)

recommendation_schema
  products ──FK──< recommendations   (migrated, never written)
  products ──FK──< user_feedback     (migrated, never written)

ai_schema        created empty — no tables (01-init-schemas.sql:13)

ChromaDB (volume ai-chroma-data)  ← markdown knowledge base, no PostgreSQL rows
```

The only real foreign keys in the whole database are `refresh_tokens.user_id → users.id` (inside `auth_schema`) and `recommendations.product_id` / `user_feedback.product_id → products.id` (inside `recommendation_schema`).

### Data Access Rules

1. **Service Isolation**:
   - Auth Service: READ/WRITE `auth_schema.*` (search_path `auth_schema,public`, `config/settings.py:73`)
   - User Service: READ/WRITE `user_schema.*` (search_path `user_schema,public`, `config/settings.py:77`); it never touches `auth_schema` — `user_id` is an unvalidated soft reference
   - Recommendation Service: READ/WRITE `recommendation_schema.*`; reads pet profiles over HTTP from user-service
   - AI Service: **no PostgreSQL connection at all** — stateless apart from the ChromaDB volume

2. **Cross-Service Data Access**:
   - MUST go through REST APIs
   - NO direct database queries across schemas
   - There are **no** cross-schema foreign keys — `user_id` / `pet_id` are plain `UUIDField` soft references; integrity is maintained by the cascade-delete endpoint, not by the database
   - Not every internal REST call goes through the API Gateway: auth-service → `http://user-service:3002/api/v1/users/delete` (cascade delete) and recommendation-service → `http://user-service:3002/api/v1/pets/{id}` are direct service-to-service calls that set `X-User-ID` themselves

3. **Data Ownership**:
   - Users own their profiles and pets
   - Recommendation Service owns the product catalog (`recommendation_schema.products`) and the two inert history tables
   - RAG documents are markdown files under `srcs/ai/data/knowledge_base/` (mounted read-only), ingested into ChromaDB by `make rag`; nothing about them is stored in PostgreSQL

---

## Deployment Architecture

### Makefile Interface

**Primary interaction method** - All Docker operations through `make` commands.

> **Profile note:** the Makefile sets and exports `COMPOSE_PROFILES ?= cloud` (Makefile:9-10),
> which takes precedence over the value in the root `.env`. Every `make` target runs the
> **cloud** stack (LiteLLM → Mistral; no `ollama`, no `classification-service`) unless you
> override it per-invocation: `make up COMPOSE_PROFILES=local`.

```makefile
# Core commands
make all            # build + up + show + logs (NOT the default goal — `.DEFAULT_GOAL := help`)
make build          # Build all Docker images (bakes in requirements)
make build-zero     # Build all images with --no-cache
make build-{svc}    # Build a single service
make up             # Start all services (detached)
make up-{svc}       # Start a single service
make down           # Stop and remove containers
make downv          # Stop and remove containers + volumes
make restart        # Restart all services
make stop / start   # Stop / start without removing containers
make logs           # Follow logs (all services)
make logs-{svc}     # Follow logs for one service
make show           # Show containers, networks, volumes
make purge          # Full cleanup (containers + volumes + images + networks)
make re             # `re: down all`   → down, then build + up + show + logs
make ref            # `ref: purge all` → purge, then build + up + show + logs
make exec-{svc}     # Shell into ft_transcendence_{svc}

# Bootstrap / data commands
make init           # build + up + migration + seed + superuser + rag
make migration      # Run database migrations (scripts/run-migrations.sh)
make seed           # Seed initial data (scripts/seed-db.sh)
make superuser      # Create Django superuser (scripts/create-superuser.sh)
make rag            # Ingest knowledge base into ChromaDB (scripts/init-rag-kb.sh)

# Testing
make test [init] [gateway] [auth] [user] [ai] [classification] [recommendation]
make test-integration                # scripts/run-integration-tests.sh

# Inference profile (local = GPU stack, cloud = hosted API, no GPU)
make up COMPOSE_PROFILES=local       # ollama + classification-service
make up COMPOSE_PROFILES=cloud       # LiteLLM → Mistral, no GPU containers
```

### Container Structure

```
ft_transcendence/
├── nginx (Reverse proxy, TLS termination — host 8000:80, 8443:443)
├── api-gateway (FastAPI, port 8001, published for dev testing)
├── auth-service (Django 5.0.1, port 3001, internal)
├── user-service (Django 5.1.5, port 3002, internal)
├── ai-service (FastAPI, port 3003, internal)
├── classification-service (FastAPI + HF Transformers, port 3004, GPU, `local` profile only)
├── recommendation-service (FastAPI + scikit-learn, port 3005, internal)
├── litellm (LiteLLM proxy, port 4000, internal — single OpenAI-compatible LLM endpoint)
├── ollama (Ollama server, port 11434, GPU-enabled, `local` profile only)
├── db (PostgreSQL 15-alpine, port 5432, internal)
└── redis (redis:8.4.0-alpine3.22, port 6379, internal)

(frontend: no container — the compose service is commented out and srcs/frontend is empty)
```

### Custom Dockerfiles

Only the services this repo actually writes code for are built from a Dockerfile: `api-gateway`,
`auth-service`, `user-service`, `ai-service`, `classification-service`, `recommendation-service` and
`nginx` (plus an empty 0-byte `srcs/frontend/Dockerfile`). `litellm`, `ollama`, `db` and `redis` run
upstream images straight from the registry with no build stage at all.
Each built service **inherits from a base image** and **bakes in requirements**.
Base images are not uniform: `api-gateway`, `auth-service`, `user-service` use `python:3.11-slim`;
`ai-service` and `classification-service` use `python:3.12.10-slim`; `recommendation-service` uses
`python:3.12-slim`; `nginx` uses `nginx:1.25-alpine`. The classification service additionally pins
`torch==2.11.0+cu128` / `torchvision==0.26.0+cu128` inside its Dockerfile (not in requirements.txt).

#### Example: API Gateway Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 gateway && chown -R gateway:gateway /app
USER gateway

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
```

#### Example: AI Service Dockerfile

```dockerfile
FROM python:3.12.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/
COPY pytest.ini .

# Create data directories for ChromaDB and knowledge base
RUN mkdir -p /app/data/chroma /app/data/knowledge_base

# Create non-root user and set permissions
RUN useradd -m -u 1000 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

EXPOSE 3003

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "2"]
```

> Note: no Dockerfile in this repo declares a `HEALTHCHECK`; all healthchecks are defined
> per-service in `docker-compose.yml`.

### Docker Networks

```yaml
networks:
  proxy:
    driver: bridge
  backend-network:
    driver: bridge
```

**Network Isolation**:
- `proxy`: Nginx only (public-facing; the frontend container is not implemented)
- `backend-network`: API Gateway, all backend services, LiteLLM/Ollama, Postgres, Redis
- **Nginx bridges both networks** — it is the only service on `proxy`, and it proxies
  `/api` to `api-gateway:8001` (srcs/nginx/conf.d/default.conf.template:81)
- The API Gateway sits on `backend-network` only; its `8001:8001` host publish exists
  purely for local curl/Postman testing (docker-compose.yml:294-295)
- Neither network is declared `internal: true` — `backend-network` needs egress for the
  cloud profile (Mistral API) and for Ollama model pulls

### Docker Volumes

```yaml
volumes:
  db-data:                # PostgreSQL persistent data
  redis-data:             # Redis AOF persistence
  ollama:                 # Ollama state AND downloaded models (/root/.ollama)
  models:                 # mounted at /models in the ollama container, but nothing writes
                          # there — no OLLAMA_MODELS is set, so models land in /root/.ollama.
                          # The mount is a leftover of the commented-out open-webui service
  ai-chroma-data:         # ChromaDB vector store (/app/data/chroma)
  huggingface-cache:      # HF Transformers model cache (classification-service)
  frontend-data:          # declared but unused (frontend service is commented out)
  open-webui:             # declared but unused (open-webui service is commented out)
```

The RAG knowledge base is **not** a volume — it is a read-only bind mount of
`./srcs/ai/data/knowledge_base`. Uploaded pet images are never persisted: they travel as
base64 in the request body and are discarded after analysis.

### Environment Variables

**Configuration is per-service**, not one root `.env`. The root `.env` (see `.env.example`)
carries only compose-level values; each service reads its own `srcs/<service>/.env`.

```bash
# ---- root .env (docker-compose interpolation) ----
COMPOSE_PROFILES=local                 # local = GPU (ollama + classification), cloud = Mistral
LITELLM_MASTER_KEY=sk-smartbreeds-local
OLLAMA_BASE_URL=http://ollama:11434    # consumed by the litellm container only
MISTRAL_API_KEY=                       # required in the cloud profile

# ---- srcs/db/.env ----
POSTGRES_DB=smartbreeds
POSTGRES_USER=smartbreeds_user
POSTGRES_PASSWORD=smartbreeds_password

# ---- srcs/auth-service/.env (user-service is the same minus JWT) ----
DB_NAME=smartbreeds
DB_USER=smartbreeds_user
DB_PASSWORD=secure_password_here
DB_HOST=db
DB_PORT=5432
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
JWT_PRIVATE_KEY_PATH=/app/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem

# ---- srcs/api-gateway/.env ----
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem
JWT_ALGORITHM=RS256
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
AI_SERVICE_URL=http://ai-service:3003
RECOMMENDATION_SERVICE_URL=http://recommendation-service:3005
REDIS_URL=redis://redis:6379/0
RATE_LIMIT_PER_MINUTE=60

# ---- srcs/ai/.env ----
LLM_BASE_URL=http://litellm:4000/v1    # LiteLLM proxy, OpenAI-compatible
LLM_API_KEY=sk-smartbreeds-local       # must match LITELLM_MASTER_KEY
LLM_VISION_MODEL=vision-model          # vision-model-cloud in the cloud profile
LLM_TEXT_MODEL=text-model              # text-model-cloud in the cloud profile
LLM_TIMEOUT=300
LLM_TEMPERATURE=0.1
CLASSIFICATION_ENABLED=true            # false => VLM-only pipeline, no NSFW filter
SPECIES_MIN_CONFIDENCE=0.10
BREED_MIN_CONFIDENCE=0.05
# NOTE: EMBEDDING_MODEL, CHROMA_PERSIST_DIR, CHROMA_COLLECTION_NAME, CHUNK_SIZE,
# CHUNK_OVERLAP and RAG_TOP_K are NOT in .env/.env.example — they are Settings
# defaults in srcs/ai/src/config.py and are only overridable by adding them.

# ---- srcs/recommendation-service/.env ----
DATABASE_URL=postgresql+asyncpg://smartbreeds_user:smartbreeds_password@db:5432/smartbreeds
USER_SERVICE_URL=http://user-service:3002

# ---- common ----
DEBUG=false
LOG_LEVEL=info
```

---

## Architecture Summary

### System Overview

SmartBreeds is a **microservices-based pet companion platform** that combines AI vision, RAG knowledge systems, and ML recommendations to help users identify pet breeds, access health information, and receive personalized product recommendations.

### Core Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture Pattern** | Microservices | Independent scaling, technology flexibility, fault isolation |
| **API Gateway** | FastAPI | High performance (async), minimal overhead, perfect for routing |
| **Backend Services** | Django 5.0.1 (auth) / 5.1.5 (user) | Batteries-included, excellent ORM, mature ecosystem |
| **Frontend** | Not implemented | Compose service commented out; `srcs/frontend` is empty |
| **AI Orchestration** | Hand-rolled `VisionOrchestrator` + LiteLLM proxy | No framework lock-in; one OpenAI-compatible endpoint for every backend |
| **Vision Model** | LiteLLM alias → Ollama `qwen3-vl:8b` (local) or Mistral (cloud) | Backend swap is config-only, no code change |
| **Vector Store** | ChromaDB | Lightweight, embedded, fast semantic search |
| **ML Framework** | scikit-learn (recommendation-service) | Cosine similarity over 15-dim feature vectors; lightweight |
| **Breed Classification** | HuggingFace Transformers (classification-service) | Pretrained species/breed/NSFW models, GPU-accelerated |
| **Inference Gateway** | LiteLLM | One OpenAI-compatible endpoint; local/hosted swap by config |
| **Deployment Profiles** | Compose profiles `local` / `cloud` | GPU stack vs. hosted-API stack from one compose file |
| **Database** | PostgreSQL 15-alpine | ACID compliance, JSON support, proven reliability |
| **Cache** | Redis | In-memory counters for API Gateway rate limiting (only current use) |
| **Authentication** | HTTP-only JWT cookies | XSS protection, automatic transmission, stateless |
| **Communication** | REST APIs | Simple, debuggable, standard HTTP |
| **Deployment** | Docker + Makefile | Consistent environments, easy orchestration |

### Service Inventory

| Service | Technology | Port | Exposed on host | Purpose |
|---------|-----------|------|-----------------|---------|
| **Nginx** | nginx:1.25-alpine | 80, 443 | 8000, 8443 | Reverse proxy, TLS termination |
| **API Gateway** | FastAPI | 8001 | 8001 (dev only) | Request routing, JWT validation, rate limiting |
| **Auth Service** | Django 5.0.1 | 3001 | no | User authentication, registration, JWT issuance |
| **User Service** | Django 5.1.5 | 3002 | no | Profile, pet & analysis-history management |
| **AI Service** | FastAPI | 3003 | no | Vision orchestration + RAG |
| **Classification Service** | FastAPI + HF Transformers | 3004 | no | NSFW / species / breed models (`local` profile only) |
| **Recommendation Service** | FastAPI + scikit-learn | 3005 | no | Content-based product recommendations |
| **LiteLLM** | ghcr.io/berriai/litellm:main-stable | 4000 | no | OpenAI-compatible inference gateway |
| **Ollama** | ollama/ollama:0.15.4 | 11434 | 11434 | Local GPU LLM host (`local` profile only) |
| **PostgreSQL** (`db`) | postgres:15-alpine | 5432 | no | Primary database (`smartbreeds`) |
| **Redis** | redis:8.4.0-alpine3.22 | 6379 | no | Rate-limit counters (only current use) |

> Frontend: not implemented. The compose service is commented out and `srcs/frontend`
> contains only empty placeholder files.

### Data Flow Summary

**Typical Image-Analysis Journey (`local` profile):**
1. Client (HTTP client / notebook — there is no frontend) POSTs a base64 image
2. Nginx (8000/8443) → API Gateway (validates JWT from the HTTP-only cookie)
3. API Gateway → AI Service `/api/v1/vision/analyze` with `X-User-ID` / `X-User-Role`
4. AI Service → Classification Service: NSFW filter, then species, then breed
   (skipped when `CLASSIFICATION_ENABLED=false` — the vision LLM does species/breed instead,
   and **no NSFW filter runs**)
5. AI Service → RAG (ChromaDB): retrieve breed/health context
6. AI Service → **LiteLLM proxy** (`http://litellm:4000/v1/chat/completions`) → Ollama
   `qwen3-vl:8b` (local) or Mistral (cloud) for the narrative analysis
7. AI Service → API Gateway → client (enriched breed response)

**Product recommendations are a separate, client-initiated call:**
`GET /api/v1/recommendations/...` → API Gateway → Recommendation Service, which fetches the
pet profile from User Service and scores products with weighted cosine similarity. The AI
Service is not involved.

### Security Architecture

- **Network Isolation**: Two bridge networks (`proxy` + `backend-network`); Nginx is the only
  service on both. Isolation is enforced by not publishing host ports for backend services —
  `backend-network` is *not* declared `internal`, since it needs egress for hosted LLM calls
- **Authentication**: HTTP-only JWT cookies (XSS protection)
- **Authorization**: API Gateway validates, forwards user context
- **Token Management**: Access (15 min) + Refresh (7 d) tokens, RS256-signed with a 4096-bit RSA key pair
- **Password Security**: Argon2 (primary), PBKDF2 fallback for legacy hashes
- **HTTPS**: TLS 1.2+ with strong ciphers
- **Rate Limiting**: Redis-backed per-user/IP limits

### Scalability Considerations

**Current Architecture:**
- Suitable for 1K-10K users
- Single PostgreSQL instance (`db`)
- Single LiteLLM proxy instance — the one inference chokepoint in *both* profiles
- `local` profile: single Ollama GPU server + single classification-service (GPU-bound)
- `cloud` profile: no GPU containers; inference throughput is bounded by the hosted provider's rate limits
- Stateless services (horizontal scaling ready)

**Future Enhancements:**
- Database sharding/replication for high load
- LiteLLM fan-out across multiple Ollama GPU servers (the proxy already owns model routing)
- Redis cluster for distributed caching
- Async processing with Celery for batch jobs
- API Gateway rate limiting per tier
- CDN for static assets

### Development Principles

1. **YAGNI**: Build what's needed now, not hypothetical features
2. **Service Independence**: Each microservice owns its data and logic
3. **API-First**: Services communicate only through defined APIs
4. **Security by Design**: HTTP-only cookies, network isolation, JWT validation
5. **Performance**: FastAPI for gateways, Redis-backed rate limiting, GPU acceleration
6. **Maintainability**: Clear separation of concerns, consistent patterns
7. **Documentation**: OpenAPI specs, architecture docs, code comments

---

**Document Version**: 2.0
**Last Updated**: 2026-08-10
**Maintained By**: SmartBreeds Development Team
