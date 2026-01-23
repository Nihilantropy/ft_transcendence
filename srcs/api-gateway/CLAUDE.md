# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the API Gateway for the SmartBreeds microservices platform. It's a FastAPI application that serves as the single entry point, handling JWT authentication (RS256), rate limiting, and request proxying to backend services.

## Essential Commands

### Running Tests

```bash
# All tests (32 total: 28 unit + 4 integration)
# Use `run --rm` - works even if container not running
docker compose run --rm api-gateway python -m pytest tests/ -v

# Integration tests only
docker exec ft_transcendence_api_gateway python -m pytest tests/integration/ -v

# Single test file
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py -v

# Single test function
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py::test_function_name -v

# With coverage
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=html
```

### Docker Operations

```bash
# From project root
make build           # Rebuild images (required after requirements.txt changes)
make up              # Start services
make logs-api-gateway # View logs
make exec-api-gateway # Shell into container

# Direct
docker compose up api-gateway -d
```

### API Testing

```bash
# Health check
curl http://localhost:8001/health

# Through NGINX (production-like)
curl -k https://localhost/api/health
```

## Architecture

### Middleware Stack

Execution order is bottom-to-top in `main.py`:
1. **CORS** - Whitelist origins, allow credentials
2. **Logging** - Structured JSON logs with request_id
3. **Rate Limiting** - Redis-backed, per-user or per-IP (60 req/min default)
4. **JWT Auth** - RS256 asymmetric validation from HTTP-only cookie

### Request Flow

1. Client sends request with `access_token` cookie
2. Auth middleware validates JWT using public key only (private key stays with auth-service)
3. User context extracted: `user_id`, `role`, `email`
4. Context headers added: `X-User-ID`, `X-User-Role`, `X-Request-ID`
5. Request proxied to backend service based on path prefix

### Service Routing (`routes/proxy.py`)

Zero-touch routing - backend services add endpoints without gateway changes:
```
/api/v1/auth/*           → AUTH_SERVICE_URL
/api/v1/users/*          → USER_SERVICE_URL
/api/v1/pets/*           → USER_SERVICE_URL
/api/v1/vision/*         → AI_SERVICE_URL
/api/v1/rag/*            → AI_SERVICE_URL
/api/v1/recommendations/* → AI_SERVICE_URL
```

### Public Paths (no auth required)

Defined in `middleware/auth_middleware.py`:
- `/health`, `/docs`, `/openapi.json`
- `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh`

## Common Tasks

### Add a public endpoint
Edit `middleware/auth_middleware.py`, add to `self.public_endpoints` set.

### Change rate limits
Update `RATE_LIMIT_PER_MINUTE` in `.env`.

### Add new backend service
1. Add URL to `.env`: `NEW_SERVICE_URL=http://new-service:PORT`
2. Add to `config.py`: `NEW_SERVICE_URL: str`
3. Add route mapping in `routes/proxy.py` `SERVICE_ROUTES` dict

### Add middleware
Create in `middleware/`, inherit from `BaseHTTPMiddleware`, register in `main.py` (order matters).

## Testing Patterns

**CRITICAL:** After modifying source files, run `docker compose build api-gateway` to rebuild the image (code is baked in at build time).

Tests use dynamically generated RSA key pairs (see `conftest.py`):
- `test_private_key` fixture - for signing test tokens
- `test_public_key` fixture - for verification
- Environment variables set automatically in conftest

**CRITICAL:** All JWT tokens in tests MUST use RS256 with `TEST_PRIVATE_KEY_PEM`:
```python
from conftest import TEST_PRIVATE_KEY_PEM
jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="RS256")
```
Never use HS256 with hardcoded secrets - the auth middleware validates RS256 only.

**Preferred test command:** `docker compose run --rm api-gateway python -m pytest tests/ -v` (works even if container not running)

Mocking patterns:
- Redis: `unittest.mock.patch`
- Backend services: `httpx` mocking with `AsyncMock`
- Use `TestClient` from FastAPI for synchronous test requests

## Common Gotchas

**httpx.Response headers:** Use `response.headers.raw` (returns `List[Tuple[bytes, bytes]]`), NOT `response.raw_headers` (doesn't exist)

**pytest warnings:** Configure pytest.ini with custom markers and `asyncio_default_fixture_loop_scope = function`

**Cookie forwarding:** Multiple `Set-Cookie` headers require ProxyResponse class with `raw_headers` parameter

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | App init, middleware registration, exception handlers |
| `config.py` | Pydantic Settings, loads `.env`, exposes `JWT_PUBLIC_KEY` |
| `auth/jwt_utils.py` | `decode_jwt()`, `extract_user_context()`, `JWTValidationError` |
| `middleware/auth_middleware.py` | JWT validation, public path bypass |
| `middleware/rate_limit.py` | Redis sliding window, graceful degradation |
| `routes/proxy.py` | `SERVICE_ROUTES` dict, `forward_request()` |
| `utils/responses.py` | `error_response()` helper, Pydantic models |

## Error Response Format

All errors return:
```json
{
  "success": false,
  "data": null,
  "error": {"code": "ERROR_CODE", "message": "...", "details": {}},
  "timestamp": "..."
}
```

## Important Notes

- **RS256 asymmetric JWT**: Gateway only has public key for verification, cannot sign tokens
- **HTTP-only cookies**: Token in `access_token` cookie, not Authorization header
- **Network isolation**: Backend services only accessible through gateway (Docker backend-network)
- **Graceful degradation**: Redis failure allows requests through (logged, not blocked)
- **Requirements baked into image**: Run `make build` after changing `requirements.txt`
