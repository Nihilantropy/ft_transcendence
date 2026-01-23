# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SmartBreeds** is a luxury pet companion platform using AI-powered computer vision for breed identification and health monitoring. The system employs a microservices architecture with Docker-based deployment.

**Core Technologies:**
- Frontend: React 19.2 + Vite + Tailwind CSS
- API Gateway: FastAPI (routing, JWT validation, rate limiting)
- Backend Services: Django 6.0.1 (auth-service, user-service - currently stubs)
- AI Services: FastAPI + LlamaIndex + Ollama (qwen3-vl:8b model)
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
make restart       # Restart all services
make logs          # Follow all logs
make logs-SERVICE  # View specific service logs (e.g., make logs-api-gateway)
make clean         # Remove containers and networks
make fclean        # Full cleanup (containers + volumes + images)
make re            # Full rebuild (fclean + all)
make dev           # Start in foreground (development mode)
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
- Preferred test command: `docker compose run --rm SERVICE pytest` (works even when container stopped)
- Direct exec only works when container running: `docker exec CONTAINER pytest`

**API Gateway Tests** (32 tests total: 28 unit + 4 integration):
```bash
# Run all tests - use `run --rm` (works even if container not running)
docker compose run --rm api-gateway python -m pytest tests/ -v

# Auth Service tests (77 tests)
docker compose run --rm auth-service python -m pytest tests/ -v

# Specific test file
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py -v

# Single test function
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py::test_function_name -v

# With coverage
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=html
```

**Auth Service Tests** (Django/pytest):
```bash
docker exec ft_transcendence_auth_service python -m pytest tests/ -v
docker exec ft_transcendence_auth_service python manage.py makemigrations
docker exec ft_transcendence_auth_service python manage.py migrate
```

### API Testing

**Through NGINX (production-like):**
```bash
# Health check
curl -k https://localhost/api/health

# Authentication
curl -k -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Protected endpoint
curl -k https://localhost/api/v1/users/me -b cookies.txt
```

**Direct API Gateway (development):**
```bash
# Faster iteration, no NGINX overhead
curl http://localhost:8001/health
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt
```

## Architecture Key Concepts

### Microservices Communication

**Network Topology:**
- **Proxy Network**: Nginx ↔ Frontend ↔ API Gateway (public-facing)
- **Backend Network**: API Gateway ↔ Backend Services ↔ Databases (internal only, isolated)
- API Gateway bridges both networks as the sole entry point

**Authentication Flow:**
1. User logs in → Auth Service issues HTTP-only JWT cookies (24h access + 7d refresh)
2. Browser automatically sends cookies with each request
3. API Gateway validates JWT, extracts user context (user_id, role)
4. Gateway forwards to backend services with headers: `X-User-ID`, `X-User-Role`, `X-Request-ID`
5. Backend services trust API Gateway validation (network isolation ensures security)

**Why HTTP-Only Cookies:** XSS protection (JavaScript cannot access), automatic transmission, CSRF protection via SameSite attribute.

### Service Responsibilities

**API Gateway (FastAPI - port 8001):**
- Single entry point for all requests
- JWT validation (extracts from HTTP-only cookies)
- Rate limiting: 60 req/min per user (Redis-backed)
- Request routing to backend services
- Adds user context headers (`X-User-ID`, `X-User-Role`)
- Zero-touch routing: automatically proxies `/api/*` to backend services
- Location: `srcs/api-gateway/`

**Auth Service (Django - port 3001):** [Models/utils implemented, views pending]
- User model, RefreshToken model, JWT utilities, validators, serializers
- User registration and login (endpoints pending)
- JWT token issuance and refresh
- Password hashing (argon2)
- Location: `srcs/auth-service/`

**User Service (Django - port 3002):** [Complete]
- User profile management (GET/PUT/PATCH /users/me)
- Pet profiles CRUD (name, breed, species, age, weight, health conditions)
- Pet analysis history (breed detection results from AI service)
- Ownership-based permissions (IsOwnerOrAdmin)
- Location: `srcs/user-service/`

**AI Service (FastAPI + LlamaIndex - port 3003):**
- Vision analysis via Ollama (qwen3-vl:8b multimodal model)
- RAG system (ChromaDB + HuggingFace embeddings)
- ML product recommendations (scikit-learn)
- Location: `srcs/ai/`

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
- `ai_schema`: product_catalog, recommendations, rag_documents (owned by ai-service)

**Rule:** Services NEVER directly access other services' schemas. Cross-service data access MUST go through REST APIs via API Gateway.

**Redis Usage:**
- Token blacklist: `blacklist:token:{hash}` (TTL: token lifetime)
- Rate limiting: `rate_limit:user:{user_id}:{endpoint}` (TTL: 1 min)
- API response cache: `cache:breed:{name}` (TTL: 7 days)

### AI/ML Architecture

**LlamaIndex Orchestration:**
- Unified framework for all AI operations (vision, RAG, LLM queries)
- Abstracts Ollama connection handling, retries, error handling
- Components: `VectorStoreIndex`, `QueryEngine`, `ServiceContext`

**ChromaDB Vector Store:**
- Embeddings: 384-dimensional (sentence-transformers/all-MiniLM-L6-v2)
- Collection: `pet_knowledge` (veterinary guides, breed standards, health info)
- Workflow: Document → chunk (500 tokens) → embed → store → semantic search

**ML Recommendations:**
1. scikit-learn scores products based on breed traits (size, energy, health predispositions)
2. LlamaIndex RAG generates natural language explanations ("Recommended because Golden Retrievers need glucosamine for joint health...")
3. Returns: `{products: [...], scores: [...], explanations: [...]}`

## Important Patterns

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

### Service Configuration

Services use environment variables from `.env` files:
- Pydantic Settings for validation and type safety
- Loaded from `.env` in service directory
- Shared secrets: `JWT_SECRET_KEY` must match across auth-service and api-gateway
- Service URLs use Docker Compose service names (e.g., `http://auth-service:3001`)

## Development Workflow

### Adding a New Backend Service

1. Create service directory in `srcs/`
2. Add `Dockerfile` that bakes in requirements
3. Add service to `docker-compose.yml` (assign to `backend-network`)
4. Add service URL to `srcs/api-gateway/.env`: `NEW_SERVICE_URL=http://new-service:PORT`
5. Update `srcs/api-gateway/config.py` to include new URL
6. API Gateway will automatically proxy `/api/*` requests

### Modifying API Gateway Behavior

**Add public endpoint** (no auth): Edit `srcs/api-gateway/middleware/auth_middleware.py`, add path to `PUBLIC_PATHS` list.

**Change rate limits**: Update `RATE_LIMIT_PER_MINUTE` in `srcs/api-gateway/.env`.

**Custom routing logic**: Edit `srcs/api-gateway/routes/proxy.py` for non-standard routing.

### Testing Strategy

1. **Unit tests**: Test components in isolation
2. **Integration tests**: Use direct API Gateway access (localhost:8001)
3. **E2E tests**: Use NGINX proxy (localhost/api) for full stack
4. **Load tests**: Test through NGINX to validate both rate limiting layers

## Security Considerations

- **JWT Tokens**: HS256 algorithm, stored in HTTP-only cookies
- **Network Isolation**: Backend services not exposed externally, only via API Gateway
- **Rate Limiting**: Two layers (NGINX: 200/min, API Gateway: 60/min per user)
- **Password Hashing**: bcrypt/argon2 in auth service
- **HTTPS**: TLS 1.2+ via Nginx (self-signed cert in dev, replace in production)
- **Token Blacklist**: Redis-backed for logout (optional: check in API Gateway middleware)

## Current State

**Completed:**
- API Gateway (FastAPI) with full middleware stack, tests, and documentation
- Docker infrastructure with isolated networks
- Nginx reverse proxy configuration
- Redis integration for rate limiting and caching
- Ollama GPU setup for AI inference
- User Service (Django 5.1.5 with full CRUD, 41 passing tests, Docker integrated)

**In Progress:**
- Auth Service (User/RefreshToken models, JWT utils, validators, serializers done; views/endpoints pending)
- AI Service (LlamaIndex + RAG + ML recommendations)
- Frontend (React scaffolding exists, needs implementation)

## Common Troubleshooting

**"Connection refused" on localhost:8001:**
- Check: `docker compose ps api-gateway`
- Fix: `docker compose up api-gateway -d`

**"502 Bad Gateway" from NGINX:**
- API Gateway down or unreachable
- Check: `curl http://localhost:8001/health`
- Check networks: `docker network inspect ft_transcendence_backend-network`

**JWT always rejected:**
- Ensure `JWT_SECRET_KEY` matches in auth-service and api-gateway `.env` files
- Verify cookie is being set: `curl -v http://localhost:8001/api/v1/auth/login -d '{"email":"user@example.com","password":"pass"}' -H "Content-Type: application/json" 2>&1 | grep -i "set-cookie"`

**Rate limiting not working:**
- Check Redis: `docker exec ft_transcendence_redis redis-cli ping`
- Verify `REDIS_URL` in api-gateway `.env`

**Ollama GPU not detected:**
- Verify NVIDIA runtime: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
- Check docker-compose.yml: `runtime: nvidia` and `deploy.resources.reservations.devices`

## Reference Documentation

- Full architecture details: `ARCHITECTURE.md`
- API testing workflows: `docs/API_TESTING_GUIDE.md`
- Implementation plans: `docs/plans/` (TDD step-by-step guides for each service)
