# API Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a FastAPI-based API Gateway that handles JWT validation, request routing, rate limiting, and CORS for the SmartBreeds microservices architecture.

**Architecture:** The API Gateway serves as the single entry point for all client requests. It validates HTTP-only JWT cookies, extracts user context, and forwards authenticated requests to backend services (auth-service, user-service, ai-service) with user context headers (X-User-ID, X-User-Role, X-Request-ID). It bridges the proxy and backend networks while providing CORS, rate limiting, and request logging.

**Tech Stack:** FastAPI, Pydantic, PyJWT, uvicorn, httpx (async HTTP client), python-jose, Redis (via redis-py)

---

## Task 1: Project Initialization

**Files:**
- Create: `srcs/api-gateway/requirements.txt`
- Create: `srcs/api-gateway/main.py`
- Create: `srcs/api-gateway/.env.example`
- Create: `tests/api-gateway/test_health.py`
- Create: `srcs/api-gateway/Dockerfile`

**Step 1: Create requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.10.0
pydantic-settings==2.6.0
python-jose[cryptography]==3.3.0
PyJWT==2.10.0
httpx==0.28.0
redis==5.2.0
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.28.0
python-multipart==0.0.17
```

**Step 2: Create basic FastAPI app with health endpoint**

File: `srcs/api-gateway/main.py`
```python
from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 3: Create .env.example**

File: `srcs/api-gateway/.env.example`
```bash
# Server
PORT=8001
HOST=0.0.0.0
DEBUG=false
LOG_LEVEL=info

# JWT Configuration
JWT_SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256

# Backend Services
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
AI_SERVICE_URL=http://ai-service:3003

# Redis
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

**Step 4: Write failing test for health endpoint**

File: `tests/api-gateway/test_health.py`
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint_returns_200():
    """Test that health endpoint returns 200 OK"""
    response = client.get("/health")
    assert response.status_code == 200

def test_health_endpoint_returns_correct_structure():
    """Test that health endpoint returns expected JSON structure"""
    response = client.get("/health")
    data = response.json()

    assert "status" in data
    assert "service" in data
    assert "timestamp" in data
    assert data["status"] == "healthy"
    assert data["service"] == "api-gateway"
```

**Step 5: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_health.py -v`

Expected: PASS (2 tests)

**Step 6: Create Dockerfile**

File: `srcs/api-gateway/Dockerfile`
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

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
```

**Step 7: Commit**

```bash
git add srcs/api-gateway/ tests/api-gateway/ docs/plans/
git commit -m "feat(api-gateway): initialize FastAPI project with health endpoint

- Add FastAPI, uvicorn, pydantic dependencies
- Implement basic health check endpoint
- Add Dockerfile with Python 3.11 slim base
- Add environment configuration template
- Add initial tests for health endpoint"
```

---

## Task 2: Configuration Management

**Files:**
- Create: `srcs/api-gateway/config.py`
- Create: `tests/api-gateway/test_config.py`

**Step 1: Write failing test for configuration**

File: `tests/api-gateway/test_config.py`
```python
import pytest
import os
from config import Settings

def test_settings_load_from_env():
    """Test that settings load from environment variables"""
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"
    os.environ["JWT_ALGORITHM"] = "HS256"
    os.environ["AUTH_SERVICE_URL"] = "http://auth:3001"

    settings = Settings()

    assert settings.JWT_SECRET_KEY == "test-secret-key"
    assert settings.JWT_ALGORITHM == "HS256"
    assert settings.AUTH_SERVICE_URL == "http://auth:3001"

def test_settings_has_required_fields():
    """Test that settings has all required configuration fields"""
    settings = Settings()

    assert hasattr(settings, "JWT_SECRET_KEY")
    assert hasattr(settings, "JWT_ALGORITHM")
    assert hasattr(settings, "AUTH_SERVICE_URL")
    assert hasattr(settings, "USER_SERVICE_URL")
    assert hasattr(settings, "AI_SERVICE_URL")
    assert hasattr(settings, "REDIS_URL")
    assert hasattr(settings, "RATE_LIMIT_PER_MINUTE")
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_config.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'config'"

**Step 3: Implement configuration**

File: `srcs/api-gateway/config.py`
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # JWT Configuration
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    # Backend Service URLs
    AUTH_SERVICE_URL: str
    USER_SERVICE_URL: str
    AI_SERVICE_URL: str

    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

# Global settings instance
settings = Settings()
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_config.py -v`

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add srcs/api-gateway/config.py tests/api-gateway/test_config.py
git commit -m "feat(api-gateway): add configuration management with pydantic-settings

- Create Settings class for environment-based configuration
- Add validation for required JWT and service URL settings
- Add tests for configuration loading"
```

---

## Task 3: JWT Utilities and Validation

**Files:**
- Create: `srcs/api-gateway/auth/jwt_utils.py`
- Create: `tests/api-gateway/test_jwt_utils.py`

**Step 1: Write failing tests for JWT validation**

File: `tests/api-gateway/test_jwt_utils.py`
```python
import pytest
from datetime import datetime, timedelta
from jose import jwt
from auth.jwt_utils import decode_jwt, JWTValidationError

# Test JWT secret and algorithm
TEST_SECRET = "test-secret-key-for-testing"
TEST_ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30):
    """Helper to create test JWT tokens"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

def test_decode_valid_jwt():
    """Test decoding a valid JWT token"""
    token = create_test_token("user123", "user")

    payload = decode_jwt(token, TEST_SECRET, TEST_ALGORITHM)

    assert payload["user_id"] == "user123"
    assert payload["role"] == "user"
    assert payload["email"] == "test@example.com"

def test_decode_expired_jwt_raises_error():
    """Test that expired JWT raises validation error"""
    token = create_test_token("user123", "user", exp_minutes=-10)

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, TEST_SECRET, TEST_ALGORITHM)

    assert "expired" in str(exc_info.value).lower()

def test_decode_invalid_signature_raises_error():
    """Test that invalid signature raises validation error"""
    token = create_test_token("user123", "user")
    wrong_secret = "wrong-secret"

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, wrong_secret, TEST_ALGORITHM)

    assert "signature" in str(exc_info.value).lower()

def test_decode_malformed_token_raises_error():
    """Test that malformed token raises validation error"""
    malformed_token = "not.a.valid.jwt"

    with pytest.raises(JWTValidationError):
        decode_jwt(malformed_token, TEST_SECRET, TEST_ALGORITHM)
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_jwt_utils.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'auth'"

**Step 3: Implement JWT utilities**

File: `srcs/api-gateway/auth/__init__.py`
```python
# Empty file to make auth a package
```

File: `srcs/api-gateway/auth/jwt_utils.py`
```python
from typing import Dict, Any
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime

class JWTValidationError(Exception):
    """Custom exception for JWT validation errors"""
    pass

def decode_jwt(token: str, secret_key: str, algorithm: str = "HS256") -> Dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string
        secret_key: Secret key for signature verification
        algorithm: JWT algorithm (default: HS256)

    Returns:
        Dict containing the decoded payload

    Raises:
        JWTValidationError: If token is invalid, expired, or malformed
    """
    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[algorithm]
        )
        return payload

    except ExpiredSignatureError:
        raise JWTValidationError("Token has expired")

    except JWTError as e:
        # Covers invalid signature, malformed tokens, etc.
        raise JWTValidationError(f"Invalid token: {str(e)}")

def extract_user_context(payload: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract user context from JWT payload for forwarding to backend services.

    Args:
        payload: Decoded JWT payload

    Returns:
        Dict with user_id and role
    """
    return {
        "user_id": payload.get("user_id", ""),
        "role": payload.get("role", "user"),
        "email": payload.get("email", "")
    }
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_jwt_utils.py -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/api-gateway/auth/ tests/api-gateway/test_jwt_utils.py
git commit -m "feat(api-gateway): implement JWT validation utilities

- Add decode_jwt function with signature verification
- Handle expired tokens and invalid signatures
- Add JWTValidationError for consistent error handling
- Add extract_user_context helper for backend forwarding
- Add comprehensive tests for JWT validation"
```

---

## Task 4: JWT Middleware

**Files:**
- Create: `srcs/api-gateway/middleware/auth_middleware.py`
- Create: `tests/api-gateway/test_auth_middleware.py`

**Step 1: Write failing tests for auth middleware**

File: `tests/api-gateway/test_auth_middleware.py`
```python
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from middleware.auth_middleware import JWTAuthMiddleware
from jose import jwt
from datetime import datetime, timedelta

app = FastAPI()

# Test configuration
TEST_SECRET = "test-secret-for-middleware"
TEST_ALGORITHM = "HS256"

# Add middleware
app.add_middleware(JWTAuthMiddleware, secret_key=TEST_SECRET, algorithm=TEST_ALGORITHM)

@app.get("/protected")
async def protected_route():
    return {"message": "success"}

@app.get("/health")
async def health_route():
    return {"status": "healthy"}

client = TestClient(app)

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30):
    """Helper to create test JWT tokens"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

def test_request_with_valid_token_succeeds():
    """Test that request with valid JWT cookie succeeds"""
    token = create_test_token("user123", "user")

    response = client.get(
        "/protected",
        cookies={"access_token": token}
    )

    assert response.status_code == 200
    assert response.json() == {"message": "success"}

def test_request_without_token_fails():
    """Test that request without JWT cookie fails with 401"""
    response = client.get("/protected")

    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert "authentication" in data["error"]["message"].lower()

def test_request_with_expired_token_fails():
    """Test that request with expired token fails with 401"""
    expired_token = create_test_token("user123", "user", exp_minutes=-10)

    response = client.get(
        "/protected",
        cookies={"access_token": expired_token}
    )

    assert response.status_code == 401
    data = response.json()
    assert "expired" in data["error"]["message"].lower()

def test_health_endpoint_bypasses_auth():
    """Test that /health endpoint bypasses authentication"""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_auth_middleware.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'middleware'"

**Step 3: Implement auth middleware**

File: `srcs/api-gateway/middleware/__init__.py`
```python
# Empty file to make middleware a package
```

File: `srcs/api-gateway/middleware/auth_middleware.py`
```python
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from auth.jwt_utils import decode_jwt, JWTValidationError, extract_user_context
from datetime import datetime
import uuid

class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate JWT tokens from HTTP-only cookies.
    Extracts user context and adds headers for backend services.
    """

    def __init__(self, app: ASGIApp, secret_key: str, algorithm: str = "HS256"):
        super().__init__(app)
        self.secret_key = secret_key
        self.algorithm = algorithm

        # Endpoints that bypass authentication
        self.public_endpoints = {
            "/health",
            "/docs",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh"
        }

    async def dispatch(self, request: Request, call_next):
        # Skip authentication for public endpoints
        if request.url.path in self.public_endpoints:
            return await call_next(request)

        # Extract token from HTTP-only cookie
        access_token = request.cookies.get("access_token")

        if not access_token:
            return self._unauthorized_response("Authentication required")

        try:
            # Validate JWT and extract payload
            payload = decode_jwt(access_token, self.secret_key, self.algorithm)
            user_context = extract_user_context(payload)

            # Add user context to request state for use in route handlers
            request.state.user_id = user_context["user_id"]
            request.state.user_role = user_context["role"]
            request.state.user_email = user_context["email"]

            # Generate request ID for tracing
            request_id = str(uuid.uuid4())
            request.state.request_id = request_id

            # Add headers that will be forwarded to backend services
            request.state.backend_headers = {
                "X-User-ID": user_context["user_id"],
                "X-User-Role": user_context["role"],
                "X-Request-ID": request_id,
                "X-Correlation-ID": request.headers.get("X-Correlation-ID", request_id)
            }

            # Continue to route handler
            response = await call_next(request)
            return response

        except JWTValidationError as e:
            return self._unauthorized_response(str(e))

    def _unauthorized_response(self, message: str) -> JSONResponse:
        """Return standardized 401 error response"""
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": message,
                    "details": {}
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_auth_middleware.py -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/api-gateway/middleware/ tests/api-gateway/test_auth_middleware.py
git commit -m "feat(api-gateway): implement JWT authentication middleware

- Add JWTAuthMiddleware for validating HTTP-only cookies
- Extract user context (user_id, role) from JWT payload
- Add request IDs and correlation IDs for tracing
- Set backend headers (X-User-ID, X-User-Role, X-Request-ID)
- Bypass authentication for public endpoints (/health, /auth/*)
- Return standardized 401 responses for auth failures"
```

---

## Task 5: Request Routing to Backend Services

**Files:**
- Create: `srcs/api-gateway/routes/proxy.py`
- Create: `tests/api-gateway/test_proxy.py`

**Step 1: Write failing tests for proxy routing**

File: `tests/api-gateway/test_proxy.py`
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app
from httpx import Response

client = TestClient(app)

@pytest.mark.asyncio
async def test_proxy_forwards_to_auth_service():
    """Test that /api/v1/auth/* routes forward to auth service"""
    mock_response = Response(
        200,
        json={"success": True, "data": {"message": "login successful"}},
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.asyncio
async def test_proxy_forwards_to_user_service():
    """Test that /api/v1/users/* routes forward to user service"""
    mock_response = Response(
        200,
        json={"success": True, "data": {"pets": []}},
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.get("/api/v1/users/me/pets")

    assert response.status_code == 200

@pytest.mark.asyncio
async def test_proxy_adds_user_context_headers():
    """Test that proxy adds X-User-ID and X-User-Role headers"""
    mock_response = Response(200, json={"success": True})

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)) as mock_request:
        response = client.get("/api/v1/users/me")

        # Verify headers were added to backend request
        call_args = mock_request.call_args
        headers = call_args.kwargs.get("headers", {})
        assert "X-User-ID" in headers
        assert "X-Request-ID" in headers
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_proxy.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'routes'"

**Step 3: Implement proxy routing**

File: `srcs/api-gateway/routes/__init__.py`
```python
# Empty file to make routes a package
```

File: `srcs/api-gateway/routes/proxy.py`
```python
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx
from config import settings
from datetime import datetime
from typing import Dict, Any

router = APIRouter()

# Async HTTP client for backend requests
httpx_client = httpx.AsyncClient(timeout=30.0)

# Service routing map
SERVICE_ROUTES = {
    "/api/v1/auth": settings.AUTH_SERVICE_URL,
    "/api/v1/users": settings.USER_SERVICE_URL,
    "/api/v1/pets": settings.USER_SERVICE_URL,
    "/api/v1/vision": settings.AI_SERVICE_URL,
    "/api/v1/rag": settings.AI_SERVICE_URL,
    "/api/v1/recommendations": settings.AI_SERVICE_URL,
}

def get_backend_service_url(path: str) -> str:
    """
    Determine which backend service to route to based on path.

    Args:
        path: Request path (e.g., /api/v1/auth/login)

    Returns:
        Backend service base URL

    Raises:
        HTTPException: If no matching service found
    """
    for prefix, service_url in SERVICE_ROUTES.items():
        if path.startswith(prefix):
            return service_url

    raise HTTPException(
        status_code=404,
        detail={"error": {"code": "NOT_FOUND", "message": "Service not found"}}
    )

async def forward_request(
    request: Request,
    backend_url: str,
    path: str,
    method: str
) -> Dict[str, Any]:
    """
    Forward request to backend service with user context headers.

    Args:
        request: FastAPI request object
        backend_url: Backend service base URL
        path: Request path
        method: HTTP method

    Returns:
        Backend service response as dict
    """
    # Get user context headers from middleware
    backend_headers = getattr(request.state, "backend_headers", {})

    # Forward original headers (except host, cookie)
    forward_headers = dict(request.headers)
    forward_headers.pop("host", None)
    forward_headers.pop("cookie", None)

    # Merge with user context headers
    forward_headers.update(backend_headers)

    # Build full backend URL
    full_url = f"{backend_url}{path}"

    # Get request body if present
    body = None
    if method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    try:
        # Forward request to backend
        response = await httpx_client.request(
            method=method,
            url=full_url,
            headers=forward_headers,
            content=body,
            params=dict(request.query_params)
        )

        return {
            "status_code": response.status_code,
            "content": response.json() if response.content else None,
            "headers": dict(response.headers)
        }

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": f"Backend service unavailable: {str(e)}",
                    "details": {}
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_handler(request: Request, path: str):
    """
    Universal proxy handler that routes requests to appropriate backend services.
    """
    # Construct full path
    full_path = f"/{path}"

    # Determine backend service
    backend_url = get_backend_service_url(full_path)

    # Forward request
    backend_response = await forward_request(
        request=request,
        backend_url=backend_url,
        path=full_path,
        method=request.method
    )

    # Return backend response
    return JSONResponse(
        status_code=backend_response["status_code"],
        content=backend_response["content"]
    )
```

**Step 4: Update main.py to include proxy routes**

File: `srcs/api-gateway/main.py`
```python
from fastapi import FastAPI
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# Add JWT authentication middleware
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 5: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_proxy.py -v`

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add srcs/api-gateway/routes/ srcs/api-gateway/main.py tests/api-gateway/test_proxy.py
git commit -m "feat(api-gateway): implement request routing to backend services

- Add proxy router with service route mapping
- Forward requests to auth, user, and AI services
- Include user context headers (X-User-ID, X-User-Role, X-Request-ID)
- Handle backend service errors with 503 responses
- Add tests for proxy routing and header forwarding"
```

---

## Task 6: CORS Configuration

**Files:**
- Modify: `srcs/api-gateway/main.py`
- Create: `tests/api-gateway/test_cors.py`

**Step 1: Write failing tests for CORS**

File: `tests/api-gateway/test_cors.py`
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_cors_allows_frontend_origin():
    """Test that CORS allows requests from frontend origin"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers

def test_cors_includes_credentials():
    """Test that CORS allows credentials (cookies)"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )

    assert "access-control-allow-credentials" in response.headers
    assert response.headers["access-control-allow-credentials"] == "true"

def test_cors_allows_required_headers():
    """Test that CORS allows required request headers"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )

    assert "access-control-allow-headers" in response.headers
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_cors.py -v`

Expected: FAIL (CORS headers not present)

**Step 3: Implement CORS middleware**

File: `srcs/api-gateway/main.py` (add CORS)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",   # Alternative frontend port
        "https://smartbreeds.local",  # Production domain
    ],
    allow_credentials=True,  # Allow cookies
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["X-Request-ID"],  # Expose custom headers to frontend
)

# Add JWT authentication middleware
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_cors.py -v`

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add srcs/api-gateway/main.py tests/api-gateway/test_cors.py
git commit -m "feat(api-gateway): add CORS configuration for frontend

- Add CORSMiddleware with allowed origins
- Enable credentials (cookies) for cross-origin requests
- Allow all HTTP methods and headers
- Expose X-Request-ID header to frontend
- Add tests for CORS functionality"
```

---

## Task 7: Rate Limiting with Redis

**Files:**
- Create: `srcs/api-gateway/middleware/rate_limit.py`
- Create: `tests/api-gateway/test_rate_limit.py`
- Modify: `srcs/api-gateway/main.py`

**Step 1: Write failing tests for rate limiting**

File: `tests/api-gateway/test_rate_limit.py`
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app

client = TestClient(app)

@pytest.fixture
def mock_redis():
    """Mock Redis client for testing"""
    mock = MagicMock()
    mock.get.return_value = None
    mock.incr.return_value = 1
    mock.expire.return_value = True
    return mock

def test_rate_limit_allows_requests_under_limit(mock_redis):
    """Test that requests under rate limit are allowed"""
    with patch("middleware.rate_limit.redis_client", mock_redis):
        mock_redis.get.return_value = "50"  # Under limit of 60

        response = client.get("/health")

        assert response.status_code == 200

def test_rate_limit_blocks_requests_over_limit(mock_redis):
    """Test that requests over rate limit are blocked with 429"""
    with patch("middleware.rate_limit.redis_client", mock_redis):
        mock_redis.get.return_value = "61"  # Over limit of 60

        response = client.get("/health")

        assert response.status_code == 429
        data = response.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"

def test_rate_limit_uses_user_id_when_authenticated(mock_redis):
    """Test that rate limiting uses user_id for authenticated requests"""
    with patch("middleware.rate_limit.redis_client", mock_redis):
        # Mock authenticated request with user_id in state
        response = client.get("/api/v1/users/me")

        # Verify Redis was called with user-based key
        calls = [str(call) for call in mock_redis.get.call_args_list]
        assert any("rate_limit:user:" in str(call) for call in calls)
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_rate_limit.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'middleware.rate_limit'"

**Step 3: Implement rate limiting middleware**

File: `srcs/api-gateway/middleware/rate_limit.py`
```python
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import redis
from config import settings
from datetime import datetime

# Redis client for rate limiting
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce rate limiting using Redis.
    Limits requests per user (authenticated) or IP (unauthenticated).
    """

    def __init__(
        self,
        app: ASGIApp,
        rate_limit_per_minute: int = 60
    ):
        super().__init__(app)
        self.rate_limit_per_minute = rate_limit_per_minute
        self.window_seconds = 60

    async def dispatch(self, request: Request, call_next):
        # Determine rate limit key (user_id or IP)
        user_id = getattr(request.state, "user_id", None)

        if user_id:
            # Authenticated: rate limit by user_id
            rate_key = f"rate_limit:user:{user_id}"
        else:
            # Unauthenticated: rate limit by IP
            client_ip = request.client.host if request.client else "unknown"
            rate_key = f"rate_limit:ip:{client_ip}"

        # Get current request count
        try:
            current_count = redis_client.get(rate_key)

            if current_count is None:
                # First request in window
                redis_client.setex(rate_key, self.window_seconds, 1)
            else:
                current_count = int(current_count)

                if current_count >= self.rate_limit_per_minute:
                    # Rate limit exceeded
                    return self._rate_limit_response(rate_key)

                # Increment counter
                redis_client.incr(rate_key)

        except redis.RedisError as e:
            # If Redis fails, allow request but log error
            print(f"Redis error in rate limiting: {e}")

        # Continue to route handler
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.rate_limit_per_minute)

        try:
            remaining = self.rate_limit_per_minute - int(redis_client.get(rate_key) or 0)
            response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        except redis.RedisError:
            pass

        return response

    def _rate_limit_response(self, rate_key: str) -> JSONResponse:
        """Return standardized 429 rate limit response"""
        try:
            ttl = redis_client.ttl(rate_key)
        except redis.RedisError:
            ttl = 60

        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Try again in {ttl} seconds.",
                    "details": {
                        "retry_after": ttl,
                        "limit": self.rate_limit_per_minute
                    }
                },
                "timestamp": datetime.utcnow().isoformat()
            },
            headers={
                "Retry-After": str(ttl),
                "X-RateLimit-Limit": str(self.rate_limit_per_minute),
                "X-RateLimit-Remaining": "0"
            }
        )
```

**Step 4: Update main.py to include rate limiting**

File: `srcs/api-gateway/main.py` (add rate limit middleware)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# CORS Configuration (must be first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://smartbreeds.local",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# Rate Limiting (before auth to limit unauthenticated requests)
app.add_middleware(
    RateLimitMiddleware,
    rate_limit_per_minute=settings.RATE_LIMIT_PER_MINUTE
)

# JWT Authentication
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 5: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_rate_limit.py -v`

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add srcs/api-gateway/middleware/rate_limit.py srcs/api-gateway/main.py tests/api-gateway/test_rate_limit.py
git commit -m "feat(api-gateway): add Redis-backed rate limiting

- Add RateLimitMiddleware with per-user and per-IP limits
- Use Redis for distributed rate limit counters
- Return 429 responses with Retry-After header
- Add rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)
- Handle Redis failures gracefully
- Add tests for rate limiting behavior"
```

---

## Task 8: Request Logging and Monitoring

**Files:**
- Create: `srcs/api-gateway/middleware/logging_middleware.py`
- Create: `tests/api-gateway/test_logging.py`
- Modify: `srcs/api-gateway/main.py`

**Step 1: Write failing tests for logging**

File: `tests/api-gateway/test_logging.py`
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
import logging

client = TestClient(app)

def test_logging_middleware_logs_requests(caplog):
    """Test that requests are logged with structured data"""
    with caplog.at_level(logging.INFO):
        response = client.get("/health")

    assert response.status_code == 200

    # Check that request was logged
    log_records = [record for record in caplog.records if "request_id" in record.message.lower() or "GET" in record.message]
    assert len(log_records) > 0

def test_logging_includes_request_duration():
    """Test that logs include request duration"""
    with patch("middleware.logging_middleware.logger") as mock_logger:
        response = client.get("/health")

        # Verify logger was called
        assert mock_logger.info.called

        # Check that duration is in the log message
        log_calls = [str(call) for call in mock_logger.info.call_args_list]
        assert any("duration" in str(call).lower() for call in log_calls)

def test_logging_includes_user_context():
    """Test that logs include user_id for authenticated requests"""
    with patch("middleware.logging_middleware.logger") as mock_logger:
        # Mock authenticated request
        response = client.get("/api/v1/users/me")

        # Verify user context is logged
        assert mock_logger.info.called
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_logging.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'middleware.logging_middleware'"

**Step 3: Implement logging middleware**

File: `srcs/api-gateway/middleware/logging_middleware.py`
```python
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import logging
from datetime import datetime

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
)
logger = logging.getLogger("api-gateway")

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests with structured data.
    Includes request details, user context, duration, and status code.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Record start time
        start_time = time.time()

        # Get request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Get request ID and user context if available
        request_id = getattr(request.state, "request_id", "no-request-id")
        user_id = getattr(request.state, "user_id", "anonymous")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request
        log_data = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }

        logger.info(str(log_data))

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response
```

**Step 4: Update main.py to include logging**

File: `srcs/api-gateway/main.py` (add logging middleware)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.logging_middleware import LoggingMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# CORS Configuration (must be first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://smartbreeds.local",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# Request Logging
app.add_middleware(LoggingMiddleware)

# Rate Limiting
app.add_middleware(
    RateLimitMiddleware,
    rate_limit_per_minute=settings.RATE_LIMIT_PER_MINUTE
)

# JWT Authentication
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 5: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_logging.py -v`

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add srcs/api-gateway/middleware/logging_middleware.py srcs/api-gateway/main.py tests/api-gateway/test_logging.py
git commit -m "feat(api-gateway): add structured request logging

- Add LoggingMiddleware for all requests
- Log method, path, status, duration, user_id
- Include request_id and correlation_id for tracing
- Use structured JSON logging format
- Add X-Request-ID header to responses
- Add tests for logging functionality"
```

---

## Task 9: Error Handling and Standardized Responses

**Files:**
- Create: `srcs/api-gateway/utils/responses.py`
- Create: `tests/api-gateway/test_error_handling.py`
- Modify: `srcs/api-gateway/main.py`

**Step 1: Write failing tests for error handling**

File: `tests/api-gateway/test_error_handling.py`
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_404_returns_standardized_error():
    """Test that 404 errors return standardized format"""
    response = client.get("/nonexistent/path")

    assert response.status_code == 404
    data = response.json()

    assert "success" in data
    assert "error" in data
    assert "timestamp" in data
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"

def test_500_returns_standardized_error():
    """Test that 500 errors return standardized format"""
    # This would require triggering an actual 500 error
    # For now, test the response structure
    pass

def test_validation_error_returns_standardized_format():
    """Test that validation errors return standardized format"""
    response = client.post(
        "/api/v1/auth/login",
        json={"invalid": "data"}  # Missing required fields
    )

    # Should return 422 (validation error) in standardized format
    data = response.json()
    assert "success" in data
    assert "error" in data
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_error_handling.py -v`

Expected: FAIL (standardized error format not implemented)

**Step 3: Implement error handlers**

File: `srcs/api-gateway/utils/__init__.py`
```python
# Empty file to make utils a package
```

File: `srcs/api-gateway/utils/responses.py`
```python
from typing import Any, Optional, Dict
from datetime import datetime
from pydantic import BaseModel

class ErrorDetail(BaseModel):
    """Error detail structure"""
    code: str
    message: str
    details: Dict[str, Any] = {}

class StandardResponse(BaseModel):
    """Standardized API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[ErrorDetail] = None
    timestamp: str = datetime.utcnow().isoformat()

def success_response(data: Any) -> Dict[str, Any]:
    """Create standardized success response"""
    response = StandardResponse(
        success=True,
        data=data,
        error=None
    )
    return response.model_dump()

def error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    response = StandardResponse(
        success=False,
        data=None,
        error=ErrorDetail(
            code=code,
            message=message,
            details=details or {}
        )
    )
    return response.model_dump()
```

File: `srcs/api-gateway/main.py` (add error handlers)
```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.logging_middleware import LoggingMiddleware
from routes import proxy
from utils.responses import error_response

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized format"""
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            code="HTTP_ERROR",
            message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            details={}
        )
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with standardized format"""
    return JSONResponse(
        status_code=422,
        content=error_response(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"errors": exc.errors()}
        )
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors with standardized format"""
    return JSONResponse(
        status_code=404,
        content=error_response(
            code="NOT_FOUND",
            message=f"Endpoint not found: {request.url.path}",
            details={}
        )
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors with standardized format"""
    return JSONResponse(
        status_code=500,
        content=error_response(
            code="INTERNAL_ERROR",
            message="An internal error occurred",
            details={}
        )
    )

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://smartbreeds.local",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# Request Logging
app.add_middleware(LoggingMiddleware)

# Rate Limiting
app.add_middleware(
    RateLimitMiddleware,
    rate_limit_per_minute=settings.RATE_LIMIT_PER_MINUTE
)

# JWT Authentication
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/test_error_handling.py -v`

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add srcs/api-gateway/utils/ srcs/api-gateway/main.py tests/api-gateway/test_error_handling.py
git commit -m "feat(api-gateway): add standardized error handling

- Create standardized response format (success/error)
- Add error handlers for HTTP, validation, 404, 500 errors
- Implement success_response and error_response utilities
- Ensure all errors follow consistent JSON structure
- Add tests for error response formats"
```

---

## Task 10: Integration Testing

**Files:**
- Create: `tests/api-gateway/integration/test_full_flow.py`
- Create: `tests/api-gateway/conftest.py`

**Step 1: Create pytest configuration**

File: `tests/api-gateway/conftest.py`
```python
import pytest
import os

# Set test environment variables
os.environ["JWT_SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["AUTH_SERVICE_URL"] = "http://auth-service-test:3001"
os.environ["USER_SERVICE_URL"] = "http://user-service-test:3002"
os.environ["AI_SERVICE_URL"] = "http://ai-service-test:3003"
os.environ["REDIS_URL"] = "redis://redis-test:6379/0"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100"

@pytest.fixture
def test_settings():
    """Provide test settings"""
    from config import settings
    return settings
```

**Step 2: Write integration tests**

File: `tests/api-gateway/integration/test_full_flow.py`
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app
from jose import jwt
from datetime import datetime, timedelta
from httpx import Response

client = TestClient(app)

TEST_SECRET = "test-secret-key-do-not-use-in-production"
TEST_ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str = "user"):
    """Helper to create test JWT tokens"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

@pytest.mark.integration
def test_full_authenticated_request_flow():
    """
    Test complete flow: authentication → routing → backend response
    """
    # Create valid JWT token
    token = create_test_token("user123", "user")

    # Mock backend service response
    mock_backend_response = Response(
        200,
        json={
            "success": True,
            "data": {"pets": [{"name": "Buddy", "breed": "Golden Retriever"}]},
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_backend_response)) as mock_request:
        # Make authenticated request
        response = client.get(
            "/api/v1/users/me/pets",
            cookies={"access_token": token}
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "pets" in data["data"]

        # Verify backend was called with correct headers
        assert mock_request.called
        call_kwargs = mock_request.call_args.kwargs
        headers = call_kwargs.get("headers", {})

        assert "X-User-ID" in headers
        assert headers["X-User-ID"] == "user123"
        assert "X-User-Role" in headers
        assert headers["X-User-Role"] == "user"
        assert "X-Request-ID" in headers

@pytest.mark.integration
def test_unauthenticated_request_to_protected_endpoint_fails():
    """
    Test that unauthenticated requests to protected endpoints fail
    """
    response = client.get("/api/v1/users/me/pets")

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"

@pytest.mark.integration
def test_public_endpoint_does_not_require_authentication():
    """
    Test that public endpoints (health, auth) don't require JWT
    """
    # Health endpoint
    response = client.get("/health")
    assert response.status_code == 200

    # Auth login endpoint (would forward to auth service)
    mock_response = Response(
        200,
        json={"success": True, "data": {"token": "new-token"}}
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        )
        assert response.status_code == 200

@pytest.mark.integration
def test_expired_token_is_rejected():
    """
    Test that expired JWT tokens are rejected
    """
    # Create expired token
    payload = {
        "user_id": "user123",
        "email": "test@example.com",
        "role": "user",
        "iat": datetime.utcnow() - timedelta(hours=2),
        "exp": datetime.utcnow() - timedelta(hours=1)
    }
    expired_token = jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

    response = client.get(
        "/api/v1/users/me",
        cookies={"access_token": expired_token}
    )

    assert response.status_code == 401
    data = response.json()
    assert "expired" in data["error"]["message"].lower()
```

**Step 3: Run integration tests**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/integration/ -v -m integration`

Expected: PASS (4 tests)

**Step 4: Run all tests**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/ -v`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add tests/api-gateway/
git commit -m "test(api-gateway): add comprehensive integration tests

- Add pytest configuration with test environment
- Test full authenticated request flow
- Test unauthenticated access is blocked
- Test public endpoints don't require auth
- Test expired tokens are rejected
- Verify user context headers are forwarded to backend"
```

---

## Task 11: Documentation and README

**Files:**
- Create: `srcs/api-gateway/README.md`
- Create: `srcs/api-gateway/.env`

**Step 1: Create comprehensive README**

File: `srcs/api-gateway/README.md`
```markdown
# API Gateway - SmartBreeds

FastAPI-based API Gateway for the SmartBreeds microservices architecture.

## Purpose

The API Gateway serves as the single entry point for all client requests. It handles:

- **JWT Validation**: Validates HTTP-only JWT cookies from authenticated requests
- **Request Routing**: Routes requests to appropriate backend services
- **User Context**: Extracts user information and forwards as headers to backend
- **Rate Limiting**: Redis-backed rate limiting per user/IP
- **CORS**: Cross-origin resource sharing for frontend
- **Request Logging**: Structured logging with request IDs and correlation IDs

## Architecture

```
Client (Frontend) → Nginx → API Gateway → Backend Services
                                ├─→ Auth Service (port 3001)
                                ├─→ User Service (port 3002)
                                └─→ AI Service (port 3003)
```

## Technology Stack

- **FastAPI**: Async web framework
- **Pydantic**: Configuration and validation
- **PyJWT**: JWT token handling
- **Redis**: Rate limiting and caching
- **httpx**: Async HTTP client for backend requests
- **uvicorn**: ASGI server

## Configuration

Environment variables (see `.env.example`):

```bash
# Server
PORT=8001
HOST=0.0.0.0
DEBUG=false
LOG_LEVEL=info

# JWT
JWT_SECRET_KEY=<your-secret-key>
JWT_ALGORITHM=HS256

# Backend Services
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
AI_SERVICE_URL=http://ai-service:3003

# Redis
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

## Running Locally

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Docker

```bash
# Build image
docker build -t smartbreeds-api-gateway .

# Run container
docker run -p 8001:8001 --env-file .env smartbreeds-api-gateway
```

### Using Makefile (Project Root)

```bash
# Build and start all services
make build
make up

# View logs
make logs-api-gateway

# Restart gateway
docker-compose restart api-gateway
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2026-01-13T10:30:00Z"
}
```

### Proxied Endpoints

All requests to `/api/v1/*` are proxied to backend services:

- `/api/v1/auth/*` → Auth Service
- `/api/v1/users/*` → User Service
- `/api/v1/pets/*` → User Service
- `/api/v1/vision/*` → AI Service
- `/api/v1/rag/*` → AI Service
- `/api/v1/recommendations/*` → AI Service

## Request Flow

### Authenticated Request

1. Client sends request with `access_token` cookie
2. **Auth Middleware**: Validates JWT, extracts user context
3. **Rate Limit**: Checks Redis for rate limit
4. **Proxy**: Routes to backend with headers:
   - `X-User-ID`: User ID from JWT
   - `X-User-Role`: User role (user/admin)
   - `X-Request-ID`: Unique request identifier
5. Backend processes request
6. Gateway returns response to client

### Unauthenticated Request

1. Client sends request without cookie
2. **Auth Middleware**: Returns 401 if endpoint is protected
3. Public endpoints (`/health`, `/auth/login`, `/auth/register`) bypass auth

## Testing

```bash
# Run all tests
pytest tests/api-gateway/ -v

# Run unit tests only
pytest tests/api-gateway/ -v -m "not integration"

# Run integration tests
pytest tests/api-gateway/integration/ -v -m integration

# Run with coverage
pytest tests/api-gateway/ --cov=. --cov-report=html
```

## Middleware Stack

Middlewares are applied in this order (inner to outer):

1. **Logging**: Logs all requests with duration and status
2. **Rate Limiting**: Enforces per-user/IP rate limits
3. **JWT Authentication**: Validates tokens and extracts user context
4. **CORS**: Handles cross-origin requests

## Error Responses

All errors follow standardized format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "2026-01-13T10:30:00Z"
}
```

Common error codes:
- `UNAUTHORIZED`: Missing or invalid JWT token
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `NOT_FOUND`: Endpoint not found
- `SERVICE_UNAVAILABLE`: Backend service unavailable
- `VALIDATION_ERROR`: Request validation failed

## Security

- **HTTP-Only Cookies**: JWT stored in httpOnly cookies (XSS protection)
- **CORS**: Configured for specific frontend origins
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Network Isolation**: Backend services only accessible via gateway
- **Request Logging**: All requests logged with correlation IDs

## Monitoring

Response headers for monitoring:
- `X-Request-ID`: Unique request identifier
- `X-RateLimit-Limit`: Rate limit per minute
- `X-RateLimit-Remaining`: Remaining requests in window
- `Retry-After`: Seconds until rate limit resets (on 429)

## Development

### Adding New Routes

1. Add service URL to `config.py` settings
2. Add route mapping to `routes/proxy.py` `SERVICE_ROUTES`
3. Update documentation

### Adding New Middleware

1. Create middleware in `middleware/` directory
2. Add to `main.py` middleware stack (order matters!)
3. Add tests in `tests/api-gateway/`

## Troubleshooting

### Gateway returns 503 (Service Unavailable)

- Check backend service is running: `docker ps`
- Check backend service health: `curl http://auth-service:3001/health`
- Check Docker network: services must be on `backend-network`

### Gateway returns 401 (Unauthorized)

- Verify JWT_SECRET_KEY matches Auth Service
- Check token expiration
- Verify cookie is being sent by frontend

### Rate limiting not working

- Check Redis is running: `docker ps | grep redis`
- Verify REDIS_URL in .env
- Check Redis connectivity: `redis-cli -u $REDIS_URL ping`

## License

Part of the SmartBreeds project. See root LICENSE file.
```

**Step 2: Create production .env template**

File: `srcs/api-gateway/.env`
```bash
# Server Configuration
PORT=8001
HOST=0.0.0.0
DEBUG=false
LOG_LEVEL=info

# JWT Configuration (MUST match Auth Service)
JWT_SECRET_KEY=CHANGE_THIS_TO_SECURE_RANDOM_STRING_256_BITS
JWT_ALGORITHM=HS256

# Backend Service URLs (Docker service names)
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
AI_SERVICE_URL=http://ai-service:3003

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

**Step 3: Commit**

```bash
git add srcs/api-gateway/README.md srcs/api-gateway/.env
git commit -m "docs(api-gateway): add comprehensive README and configuration

- Document API Gateway purpose and architecture
- Add configuration guide with all environment variables
- Document request flow and middleware stack
- Add testing, troubleshooting, and development guides
- Create production .env template"
```

---

## Task 12: Docker Compose Integration

**Files:**
- Modify: `docker-compose.yml` (project root)

**Step 1: Uncomment API Gateway service in docker-compose.yml**

File: `docker-compose.yml` (modify existing file)

Find the commented API Gateway section and uncomment:

```yaml
### API GATEWAY ###
  api-gateway:
    container_name: ft_transcendence_api_gateway
    image: ft_transcendence_api_gateway:local
    build:
      context: ./srcs/api-gateway
      dockerfile: Dockerfile
    env_file:
      - ./srcs/api-gateway/.env
    volumes:
      # Mount source code for development hot reload
      - ./srcs/api-gateway/src:/app/src:rw
    networks:
      - proxy
      - backend-network
    restart: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    depends_on:
      - redis
```

**Step 2: Test Docker build**

Run: `make build`

Expected: All services build successfully, including api-gateway

**Step 3: Test Docker Compose startup**

Run: `make up`

Expected: All services start, api-gateway health check passes

**Step 4: Test health endpoint**

Run: `curl http://localhost:8001/health`

Expected:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2026-01-13T..."
}
```

**Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): integrate API Gateway into docker-compose stack

- Uncomment api-gateway service configuration
- Configure networks (proxy + backend-network)
- Add health check with curl
- Set dependencies on redis service"
```

---

## Final Verification

**Step 1: Run all tests**

Run: `cd srcs/api-gateway && pytest tests/api-gateway/ -v --cov=.`

Expected: All tests pass with good coverage

**Step 2: Build and start full stack**

Run:
```bash
make build
make up
make health
```

Expected: All services healthy, including api-gateway

**Step 3: Test API Gateway manually**

```bash
# Health check
curl http://localhost:8001/health

# Should return 401 (no auth)
curl http://localhost:8001/api/v1/users/me

# Should return 429 after many requests (rate limit)
for i in {1..70}; do curl http://localhost:8001/health; done
```

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(api-gateway): complete FastAPI API Gateway implementation

Complete implementation of API Gateway with:
- JWT validation from HTTP-only cookies
- Request routing to auth, user, and AI services
- Redis-backed rate limiting (60 req/min)
- CORS configuration for frontend
- Structured request logging with correlation IDs
- Standardized error responses
- Comprehensive test suite (unit + integration)
- Docker containerization with health checks
- Full documentation and troubleshooting guide

The gateway serves as the single entry point for all client requests,
handling authentication, routing, rate limiting, and logging."
```

---

## Summary

This plan implements a complete API Gateway with:

✅ **FastAPI** async framework for high performance
✅ **JWT Authentication** from HTTP-only cookies
✅ **Request Routing** to backend services (auth, user, AI)
✅ **Rate Limiting** with Redis (per-user/IP)
✅ **CORS** for frontend cross-origin requests
✅ **Request Logging** with structured JSON and correlation IDs
✅ **Error Handling** with standardized response format
✅ **Testing** comprehensive unit and integration tests
✅ **Docker** containerization with health checks
✅ **Documentation** complete README with troubleshooting

**Architecture Compliance:**
- Validates JWT from HTTP-only cookies ✓
- Extracts user context (user_id, role) ✓
- Forwards requests with X-User-ID, X-User-Role, X-Request-ID headers ✓
- Handles CORS for frontend ✓
- Implements rate limiting ✓
- Bridges proxy and backend networks ✓

**Next Steps:**
After API Gateway is complete, the next microservices to implement are:
1. Auth Service (Django) - user registration, login, JWT issuance
2. User Service (Django) - user profiles, pet management
3. AI Service (FastAPI + LlamaIndex) - vision, RAG, recommendations
