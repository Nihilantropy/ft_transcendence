# API Gateway

The API Gateway is the single entry point for all client requests in the SmartBreeds microservices architecture. It handles authentication, rate limiting, request routing, logging, and standardized error responses.

## Purpose

- **Single Entry Point**: Provides a unified API interface for frontend clients
- **Security**: JWT authentication and rate limiting to protect backend services
- **Request Routing**: Forwards authenticated requests to appropriate microservices
- **Observability**: Structured logging with request correlation
- **Error Handling**: Standardized error responses across all endpoints

## Architecture

```
Client Request
     ↓
API Gateway (FastAPI)
     ↓
Middleware Stack:
  1. CORS           → Allow frontend origins
  2. Logging        → Log all requests with timing
  3. Rate Limiting  → Throttle requests per user/IP
  4. Authentication → Validate JWT tokens
     ↓
Proxy Router → Forward to backend services
     ↓
Backend Service (Auth/User/AI)
```

## Technology Stack

- **Framework**: FastAPI 0.109.0 (Python 3.11)
- **HTTP Client**: httpx (async)
- **JWT**: python-jose[cryptography]
- **Rate Limiting**: Redis
- **Testing**: pytest, pytest-asyncio
- **Containerization**: Docker

## Configuration

### Environment Variables

Create a `.env` file in the `srcs/api-gateway` directory:

```bash
# JWT Configuration
JWT_SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256

# Backend Service URLs
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
AI_SERVICE_URL=http://ai-service:3003

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

### Configuration Management

Configuration is managed via Pydantic Settings in [config.py](config.py):

- Loads from environment variables or `.env` file
- Validates configuration on startup
- Provides type safety and autocomplete

## Running the API Gateway

### Local Development (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Docker

```bash
# Build and run
docker compose up api-gateway --build

# Run in detached mode
docker compose up api-gateway -d --build

# View logs
docker logs -f ft_transcendence_api_gateway

# Stop
docker compose stop api-gateway
```

### Using Makefile (from project root)

```bash
# Build all services
make build

# Start all services
make up

# Stop all services
make down

# View logs
make logs
```

## API Endpoints

### Health Check

```
GET /health
```

Returns gateway health status. No authentication required.

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2026-01-14T12:00:00.000000"
}
```

### Protected Endpoints (Authentication Required)

All `/api/*` endpoints require a valid JWT token in an HTTP-only cookie.

#### User Service Routes

```
GET    /api/v1/users/me         → Get current user profile
GET    /api/v1/users/me/pets    → Get user's pets
POST   /api/v1/users/me/pets    → Create new pet
PUT    /api/v1/users/me/pets/:id → Update pet
DELETE /api/v1/users/me/pets/:id → Delete pet
```

#### AI Service Routes

```
POST /api/v1/ai/predict → Get breed prediction
GET  /api/v1/ai/breeds  → List available breeds
```

### Public Endpoints (No Authentication)

```
POST /api/v1/auth/register → User registration
POST /api/v1/auth/login    → User login
POST /api/v1/auth/refresh  → Refresh JWT token
```

## Request Flow

### 1. Unauthenticated Request (Login)

```
POST /api/v1/auth/login
  ↓ CORS Middleware (add headers)
  ↓ Logging Middleware (log request)
  ↓ Rate Limiting (check IP-based limit)
  ↓ Auth Middleware (bypass for /auth/*)
  ↓ Proxy Router (forward to auth-service)
  ↓ Auth Service (validate credentials, return JWT)
  ↓ Gateway returns response with HTTP-only cookie
```

### 2. Authenticated Request (Get Profile)

```
GET /api/v1/users/me
  ↓ CORS Middleware
  ↓ Logging Middleware
  ↓ Rate Limiting (check user-based limit)
  ↓ Auth Middleware (validate JWT, extract user_id)
  ↓ Proxy Router (add X-User-ID, X-User-Role headers)
  ↓ User Service (process request with user context)
  ↓ Gateway returns response
```

## Middleware Stack

### 1. CORS Middleware

**Purpose**: Allow frontend origins to access the API

**Configuration**:
- Allowed origins: `http://localhost:5173`, `http://localhost:3000`, `https://smartbreeds.local`
- Allow credentials: `true` (for cookies)
- Allow methods: All
- Expose headers: `X-Request-ID`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`

**Location**: [main.py:42-53](main.py#L42-L53)

### 2. Logging Middleware

**Purpose**: Log all requests with structured data for observability

**Logged Data**:
- Request ID (unique per request)
- HTTP method and path
- Status code
- Duration (milliseconds)
- Client IP
- User ID (if authenticated)
- Timestamp

**Log Format**: JSON for easy parsing

**Location**: [middleware/logging_middleware.py](middleware/logging_middleware.py)

### 3. Rate Limiting Middleware

**Purpose**: Protect backend services from abuse and DoS attacks

**Strategy**:
- **Authenticated requests**: Rate limit by `user_id` (60 req/min default)
- **Unauthenticated requests**: Rate limit by IP address

**Storage**: Redis with 60-second sliding window

**Response**: `429 Too Many Requests` with `Retry-After` header

**Headers**:
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Requests remaining in current window
- `Retry-After`: Seconds until limit resets (on 429)

**Location**: [middleware/rate_limit.py](middleware/rate_limit.py)

### 4. Authentication Middleware (JWT)

**Purpose**: Validate JWT tokens and extract user context

**Token Storage**: HTTP-only cookie named `access_token`

**Public Paths** (no authentication required):
- `/health`
- `/api/v1/auth/*`

**User Context Added to Request**:
- `request.state.user_id`
- `request.state.user_email`
- `request.state.user_role`
- `request.state.request_id` (UUID v4)

**Error Response**: `401 Unauthorized` with standardized error format

**Location**: [middleware/auth_middleware.py](middleware/auth_middleware.py)

## Error Response Format

All errors follow a standardized JSON format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-01-14T12:00:00.000000"
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Missing or invalid JWT token
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `NOT_FOUND` (404): Endpoint not found
- `VALIDATION_ERROR` (422): Request validation failed
- `INTERNAL_ERROR` (500): Server error

**Location**: [utils/responses.py](utils/responses.py)

## Testing

### Run All Tests

```bash
# Using Docker (recommended)
docker exec ft_transcendence_api_gateway python -m pytest tests/ -v

# Local
pytest tests/ -v
```

### Run Integration Tests Only

```bash
docker exec ft_transcendence_api_gateway python -m pytest tests/integration/ -v -m integration
```

### Run Specific Test File

```bash
docker exec ft_transcendence_api_gateway python -m pytest tests/test_auth_middleware.py -v
```

### Test Coverage

```bash
docker exec ft_transcendence_api_gateway python -m pytest tests/ --cov=. --cov-report=html
```

### Test Structure

```
tests/
├── conftest.py                    # Pytest configuration
├── integration/                   # Integration tests
│   ├── __init__.py
│   └── test_full_flow.py         # End-to-end request flow tests
├── test_auth_middleware.py       # JWT authentication tests
├── test_config.py                # Configuration tests
├── test_cors.py                  # CORS tests
├── test_error_handling.py        # Error response tests
├── test_health.py                # Health endpoint tests
├── test_jwt_utils.py             # JWT utility tests
├── test_logging.py               # Logging middleware tests
├── test_proxy.py                 # Request routing tests
└── test_rate_limit.py            # Rate limiting tests
```

**Total Tests**: 31 (27 unit + 4 integration)

## Security Features

### 1. JWT Authentication

- Tokens stored in HTTP-only cookies (XSS protection)
- Token expiration validation
- Signature verification with secret key

### 2. Rate Limiting

- Per-user and per-IP throttling
- Redis-backed distributed rate limiting
- Graceful degradation on Redis failure

### 3. CORS

- Whitelist-based origin validation
- Credentials support for cookies
- Preflight request handling

### 4. Request Validation

- FastAPI automatic request validation
- Pydantic models for type safety
- Standardized error responses

## Monitoring and Troubleshooting

### Health Check

```bash
curl http://localhost:8000/health
```

### View Logs

```bash
# Docker logs
docker logs -f ft_transcendence_api_gateway

# Follow logs with timestamps
docker logs -f --timestamps ft_transcendence_api_gateway

# Last 100 lines
docker logs --tail 100 ft_transcendence_api_gateway
```

### Log Format

Logs are structured JSON for easy parsing:

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/v1/users/me",
  "status_code": 200,
  "duration_ms": 45.23,
  "client_ip": "172.18.0.1",
  "user_id": "user123",
  "timestamp": "2026-01-14T12:00:00.000000"
}
```

### Common Issues

#### 1. JWT Token Rejected

**Symptom**: `401 Unauthorized` with "Invalid or expired token"

**Solutions**:
- Check `JWT_SECRET_KEY` matches between auth service and gateway
- Verify token hasn't expired
- Check cookie is being sent by client

#### 2. Rate Limit Not Working

**Symptom**: No rate limiting applied

**Solutions**:
- Verify Redis is running: `docker compose ps redis`
- Check `REDIS_URL` in `.env`
- Test Redis connection: `docker exec redis redis-cli ping`

#### 3. CORS Errors

**Symptom**: Browser blocks requests with CORS error

**Solutions**:
- Verify frontend origin is in `allow_origins` list in [main.py:44](main.py#L44)
- Check frontend is sending requests with credentials: `fetch(url, { credentials: 'include' })`

#### 4. Backend Service Unreachable

**Symptom**: `503 Service Unavailable`

**Solutions**:
- Verify backend services are running: `docker compose ps`
- Check service URLs in `.env` match docker-compose service names
- Verify services are on same Docker network

## Development

### Adding a New Route

1. Backend service implements endpoint
2. Gateway automatically proxies `/api/*` routes
3. No changes needed to gateway (zero-touch routing)

### Adding a Public Endpoint

Edit [middleware/auth_middleware.py](middleware/auth_middleware.py) to add path to `PUBLIC_PATHS`:

```python
PUBLIC_PATHS = [
    "/health",
    "/api/v1/auth",
    "/api/v1/your-new-public-endpoint"  # Add here
]
```

### Changing Rate Limits

Update `RATE_LIMIT_PER_MINUTE` in `.env`:

```bash
RATE_LIMIT_PER_MINUTE=100  # Allow 100 requests per minute
```

### Adding a New Backend Service

1. Update `.env` with service URL:
   ```bash
   NEW_SERVICE_URL=http://new-service:3004
   ```

2. Update [config.py](config.py):
   ```python
   NEW_SERVICE_URL: str
   ```

3. Update [routes/proxy.py](routes/proxy.py) routing logic if custom routing needed

## File Structure

```
srcs/api-gateway/
├── Dockerfile                    # Container definition
├── requirements.txt              # Python dependencies
├── .env.example                  # Example environment variables
├── .env                         # Environment variables (gitignored)
├── README.md                    # This file
├── main.py                      # FastAPI application entry point
├── config.py                    # Configuration management
├── jwt_utils.py                 # JWT utilities
├── middleware/
│   ├── __init__.py
│   ├── auth_middleware.py       # JWT authentication middleware
│   ├── rate_limit.py            # Rate limiting middleware
│   └── logging_middleware.py    # Request logging middleware
├── routes/
│   ├── __init__.py
│   └── proxy.py                 # Request routing to backend services
├── utils/
│   ├── __init__.py
│   └── responses.py             # Standardized response utilities
└── tests/
    ├── conftest.py              # Pytest configuration
    ├── integration/             # Integration tests
    └── test_*.py                # Unit tests
```

## Contributing

1. Follow TDD: Write tests first, then implementation
2. Ensure all tests pass before committing
3. Use structured logging for debugging
4. Follow existing code style and patterns
5. Update this README when adding features

## License

Proprietary - SmartBreeds Project
