# Auth Service Design Document

**Date:** 2026-01-14
**Status:** Design Complete - Ready for Implementation
**Related:** [API Gateway Plan](./2026-01-13-api-gateway.md)

## Overview

The auth-service is a Django REST Framework microservice that handles user authentication and JWT token issuance for the SmartBreeds platform. It serves as the single source of truth for user credentials and token management.

**Core Responsibilities:**
- User registration and login
- JWT token generation (access + refresh tokens)
- Token refresh and revocation
- Password validation and hashing
- User model management

---

## Architecture

### Technology Stack

- **Django 5.0** + **Django REST Framework 3.14** - Web framework and API
- **PostgreSQL** - User and refresh token storage
- **PyJWT** - JWT token generation/validation
- **Argon2** - Password hashing (OWASP recommended)
- **Gunicorn** - WSGI server with 4 workers

### Security Model

**RS256 Asymmetric JWT Signing:**
```
Auth Service:
- Private key (RS256): Signs JWT tokens
- Public key (RS256): Shared with other services
- Never shares private key

API Gateway:
- Public key (RS256): Validates JWT signatures
- Cannot forge tokens (no private key access)
```

**Benefits of RS256:**
- ✅ No shared secret between services
- ✅ Only auth-service can issue tokens
- ✅ Multiple services can validate independently
- ✅ Industry standard for distributed systems
- ✅ Easy key rotation

**Security Features:**
- HTTP-only cookies for all JWTs (XSS protection)
- Secure + SameSite=Strict cookie flags (CSRF protection)
- Argon2 password hashing
- Refresh token revocation support
- Token expiration tracking

### Network Configuration

- **Network:** backend-network only
- **Port:** 3001 (internal only, not exposed to host)
- **Access:** Only via API Gateway
- **Dependencies:** PostgreSQL (db), Redis (for future caching)

---

## Database Schema

### User Model

```python
class User(AbstractBaseUser, PermissionsMixin):
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    email = EmailField(unique=True, max_length=255)
    first_name = CharField(max_length=150, blank=True)
    last_name = CharField(max_length=150, blank=True)

    # Role choices
    ROLE_USER = 'user'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [(ROLE_USER, 'User'), (ROLE_ADMIN, 'Admin')]
    role = CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_USER)

    # Status flags
    is_active = BooleanField(default=True)
    is_verified = BooleanField(default=True)  # For future email verification
    is_staff = BooleanField(default=False)
    is_superuser = BooleanField(default=False)

    # Timestamps
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
```

**Indexes:**
- `email` (unique, automatic)
- `created_at` (for analytics)

### RefreshToken Model

```python
class RefreshToken(models.Model):
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    user = ForeignKey(User, on_delete=CASCADE, related_name='refresh_tokens')
    token_hash = CharField(max_length=64, unique=True)  # SHA256 hash

    created_at = DateTimeField(auto_now_add=True)
    expires_at = DateTimeField()
    last_used_at = DateTimeField(null=True, blank=True)
    is_revoked = BooleanField(default=False)

    class Meta:
        indexes = [
            Index(fields=['token_hash']),
            Index(fields=['user', 'is_revoked']),
            Index(fields=['expires_at']),
        ]
```

**Why hash refresh tokens?**
- Store SHA256 hash, not plaintext
- If database compromised, tokens can't be used
- Same security principle as password hashing

---

## JWT Token Structure

### Access Token (15 min expiration)

```json
{
  "user_id": "uuid-here",
  "email": "user@example.com",
  "role": "user",
  "token_type": "access",
  "iat": 1705234800,
  "exp": 1705235700
}
```

**Signed with:** RS256 private key (auth-service only)
**Validated by:** RS256 public key (API Gateway + other services)
**Storage:** HTTP-only cookie named `access_token`

### Refresh Token (7 days expiration)

```json
{
  "user_id": "uuid-here",
  "token_id": "refresh-token-uuid",
  "token_type": "refresh",
  "iat": 1705234800,
  "exp": 1705839600
}
```

**Signed with:** RS256 private key (auth-service only)
**Validated by:** Auth-service (checks database for revocation)
**Storage:** HTTP-only cookie + database (hashed)

### Token Generation Flow

1. User logs in/registers
2. Create RefreshToken record in database
3. Generate refresh JWT with `token_id`, sign with RS256 private key
4. Hash refresh JWT (SHA256), store hash in database
5. Generate access JWT with user context, sign with RS256 private key
6. Set both as HTTP-only cookies
7. Return user data in response body (NO tokens in body)

---

## API Endpoints

All endpoints return standardized response format:
```json
{
  "success": true/false,
  "data": {...} or null,
  "error": {...} or null,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

### POST /api/v1/auth/register

**Purpose:** Create new user account and issue tokens

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Validation:**
- Email: valid format, unique (case-insensitive)
- Password: min 8 chars, at least one letter + one number
- Names: optional, max 150 chars each

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": true
    }
  },
  "error": null,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

**Set-Cookie Headers:**
- `access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=900`
- `refresh_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`

**Error Responses:**
- 400 - Validation error (invalid email/password format)
- 409 - Email already exists

---

### POST /api/v1/auth/login

**Purpose:** Authenticate user and issue tokens

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user"
    }
  },
  "error": null,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

**Set-Cookie Headers:** Same as register

**Error Responses:**
- 401 - Invalid credentials

---

### POST /api/v1/auth/refresh

**Purpose:** Get new access token using refresh token

**Request:** No body - reads `refresh_token` from cookie

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Token refreshed successfully"
  },
  "error": null,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

**Set-Cookie Header:**
- `access_token=<new_jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=900`

**Behavior:**
- Validates refresh token from cookie
- Checks token exists in database and is not revoked
- Updates `last_used_at` timestamp
- Issues new access token (refresh token unchanged)

**Error Responses:**
- 401 - Invalid/expired/revoked refresh token

---

### POST /api/v1/auth/logout

**Purpose:** Revoke refresh token and clear cookies

**Request:** No body - requires valid `access_token` cookie

**API Gateway Integration:**
- API Gateway validates access token
- Forwards `X-User-ID` header to auth-service
- Auth-service uses user ID to revoke tokens

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "error": null,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

**Set-Cookie Headers (clears cookies):**
- `access_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
- `refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`

**Behavior:**
- Marks refresh token as revoked in database
- Clears both cookies
- User must login again for new tokens

---

### GET /health

**Purpose:** Health check for container orchestration

**Success Response (200):**
```json
{
  "status": "healthy",
  "service": "auth-service",
  "timestamp": "2026-01-14T10:30:00Z"
}
```

**Note:** Public endpoint, bypasses API Gateway auth

---

## Error Handling

### Standardized Error Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "2026-01-14T10:30:00Z"
}
```

### Error Codes

**400 Bad Request:**
- `VALIDATION_ERROR` - Request validation failed
  ```json
  {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "email": ["This field is required."],
      "password": ["Password must be at least 8 characters."]
    }
  }
  ```

**401 Unauthorized:**
- `INVALID_CREDENTIALS` - Wrong email/password
- `INVALID_REFRESH_TOKEN` - Refresh token expired/revoked/invalid

**409 Conflict:**
- `EMAIL_ALREADY_EXISTS` - Email already registered

**500 Internal Server Error:**
- `INTERNAL_ERROR` - Unexpected server error

### Password Validation

```python
# Custom validator
- Minimum 8 characters
- At least one letter (a-z or A-Z)
- At least one number (0-9)
- Maximum 128 characters (Django default)
```

### Email Validation

- Django EmailField validation
- Unique across all users
- Case-insensitive (normalized to lowercase)

---

## Testing Strategy

### Test Coverage

- **Unit Tests:** Model methods, validators, utilities
- **Integration Tests:** API endpoints, authentication flow
- **Minimum Coverage:** 80%

### Test Structure

```
tests/
├── __init__.py
├── conftest.py              # Pytest fixtures
├── test_models.py           # User and RefreshToken models
├── test_validators.py       # Password validation
├── test_authentication.py   # Login/register/logout flow
├── test_token_refresh.py    # Token refresh logic
└── test_error_handling.py   # Error responses
```

### Key Test Scenarios

**Authentication Flow:**
- ✅ Register new user with valid data
- ✅ Register fails with duplicate email
- ✅ Register fails with invalid password
- ✅ Login with valid credentials
- ✅ Login fails with wrong password
- ✅ Login fails with non-existent email
- ✅ Tokens set as HTTP-only cookies

**Token Management:**
- ✅ Refresh token generates new access token
- ✅ Refresh fails with expired token
- ✅ Refresh fails with revoked token
- ✅ Logout revokes refresh token
- ✅ Logout clears cookies

**Security:**
- ✅ Passwords stored as Argon2 hash
- ✅ Refresh tokens stored as SHA256 hash
- ✅ Cookies have HttpOnly, Secure, SameSite flags
- ✅ JWT signed with RS256 private key
- ✅ JWT validated with RS256 public key

**Validation:**
- ✅ Email format validation
- ✅ Email uniqueness (case-insensitive)
- ✅ Password minimum 8 characters
- ✅ Password requires letter + number

### Testing Tools

```txt
# requirements-dev.txt
pytest==7.4.3
pytest-django==4.7.0
pytest-cov==4.1.0
factory-boy==3.3.0       # Test data factories
freezegun==1.4.0         # Mock datetime for token expiration
```

---

## Deployment

### Directory Structure

```
srcs/auth-service/
├── keys/
│   ├── .gitkeep
│   ├── generate-keys.sh      # Key generation script
│   ├── jwt-private.pem        # Generated, git-ignored
│   └── jwt-public.pem         # Generated, shared with API Gateway
├── config/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   └── authentication/
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       └── validators.py
├── tests/
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
├── manage.py
├── .env.example
└── README.md
```

### RSA Key Generation

**Script: `keys/generate-keys.sh`**
```bash
#!/bin/bash
# Generate RS256 key pair for JWT signing

set -e

KEYS_DIR="$(dirname "$0")"

echo "Generating RS256 key pair..."

# Generate private key (4096 bits)
openssl genrsa -out "$KEYS_DIR/jwt-private.pem" 4096

# Extract public key
openssl rsa -in "$KEYS_DIR/jwt-private.pem" -pubout -out "$KEYS_DIR/jwt-public.pem"

# Set permissions
chmod 600 "$KEYS_DIR/jwt-private.pem"
chmod 644 "$KEYS_DIR/jwt-public.pem"

echo "✅ Keys generated successfully"
```

**Usage:**
```bash
cd srcs/auth-service/keys
bash generate-keys.sh
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create keys directory
RUN mkdir -p /app/keys && chown -R 1000:1000 /app/keys

# Create non-root user
RUN useradd -m -u 1000 authuser && chown -R authuser:authuser /app
USER authuser

EXPOSE 3001

# Run migrations and start server
CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn config.wsgi:application --bind 0.0.0.0:3001 --workers 4 --timeout 30
```

### Docker Compose Integration

```yaml
auth-service:
  container_name: ft_transcendence_auth_service
  image: ft_transcendence_auth_service:local
  build:
    context: ./srcs/auth-service
    dockerfile: Dockerfile
  env_file:
    - ./srcs/auth-service/.env
  volumes:
    - ./srcs/auth-service:/app:rw
    - ./srcs/auth-service/keys:/app/keys:ro  # Mount keys read-only
  networks:
    - backend-network
  depends_on:
    - db
    - redis
  restart: on-failure
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Environment Variables

**File: `.env`**
```bash
# Django Settings
DEBUG=False
SECRET_KEY=CHANGE_THIS_TO_SECURE_RANDOM_STRING
ALLOWED_HOSTS=auth-service,localhost

# Database
DB_NAME=smartbreeds
DB_USER=smartbreeds_user
DB_PASSWORD=secure_password_here
DB_HOST=db
DB_PORT=5432

# JWT Configuration (RS256 Asymmetric)
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
JWT_PRIVATE_KEY_PATH=/app/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem

# Cookie Settings
COOKIE_SECURE=True          # False for local http development
COOKIE_SAMESITE=Strict
COOKIE_DOMAIN=localhost

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Server
PORT=3001
```

### Dependencies

**File: `requirements.txt`**
```txt
Django==5.0.1
djangorestframework==3.14.0
psycopg2-binary==2.9.9
PyJWT==2.8.0
cryptography==41.0.7        # For RS256 support
argon2-cffi==23.1.0
python-decouple==3.8
gunicorn==21.2.0
django-cors-headers==4.3.1
dj-database-url==2.1.0
```

---

## API Gateway Integration

### Public Endpoints (Bypass Auth)

These endpoints in API Gateway middleware bypass authentication:
```python
public_endpoints = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/health"
}
```

### Protected Endpoints (Require Auth)

- `/api/v1/auth/logout` - API Gateway validates access token, forwards `X-User-ID`

### Request Flow: Login

```
1. Frontend → API Gateway: POST /api/v1/auth/login + credentials
2. API Gateway: Bypasses auth (public endpoint)
3. API Gateway → Auth Service: POST /api/v1/auth/login
4. Auth Service: Validates credentials, generates tokens (RS256)
5. Auth Service → API Gateway: Response + Set-Cookie headers
6. API Gateway → Frontend: Response + Set-Cookie headers
7. Frontend: Stores cookies (HttpOnly, inaccessible to JS)
```

### Request Flow: Logout

```
1. Frontend → API Gateway: POST /api/v1/auth/logout + access_token cookie
2. API Gateway: Validates JWT (RS256 public key), extracts user_id
3. API Gateway → Auth Service: POST + X-User-ID header
4. Auth Service: Revokes refresh token for user
5. Auth Service → API Gateway: Response + Clear cookies
6. API Gateway → Frontend: Response + Clear cookies
```

### Key Distribution

**Setup:**
1. Generate keys: `bash srcs/auth-service/keys/generate-keys.sh`
2. Private key stays in `auth-service/keys/` (git-ignored)
3. Public key mounted to API Gateway via docker-compose

**Security Model:**
```
┌─────────────────────┐
│   Auth Service      │
│  🔐 Private Key     │ ← Signs JWTs
│  🔓 Public Key      │
└─────────────────────┘
           │
           │ jwt-public.pem (shared)
           ↓
┌─────────────────────┐
│   API Gateway       │
│  🔓 Public Key      │ ← Validates JWTs (cannot forge)
└─────────────────────┘
```

### API Gateway Configuration Updates

**Update `api-gateway/.env`:**
```bash
# JWT Configuration (RS256 Asymmetric)
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem
```

**Update `api-gateway/config.py`:**
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    # ... existing settings ...

    # JWT Configuration (read from env)
    JWT_ALGORITHM: str = "RS256"
    JWT_PUBLIC_KEY_PATH: str = "/app/keys/jwt-public.pem"

    # ... other settings ...

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @property
    def JWT_PUBLIC_KEY(self) -> str:
        """Load JWT public key from file"""
        key_path = Path(self.JWT_PUBLIC_KEY_PATH)
        if not key_path.exists():
            raise FileNotFoundError(f"JWT public key not found at {key_path}")
        return key_path.read_text()

settings = Settings()
```

**Update `api-gateway/auth/jwt_utils.py`:**
```python
from typing import Dict, Any
from jose import jwt, JWTError, ExpiredSignatureError
from config import settings

def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode and validate JWT using RS256 public key"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_PUBLIC_KEY,  # Use public key property
            algorithms=[settings.JWT_ALGORITHM]  # RS256
        )
        return payload
    except ExpiredSignatureError:
        raise JWTValidationError("Token has expired")
    except JWTError as e:
        raise JWTValidationError(f"Invalid token: {str(e)}")
```

**Update `docker-compose.yml` for API Gateway:**
```yaml
api-gateway:
  # ... existing config ...
  volumes:
    - ./srcs/api-gateway:/app:rw
    - ./srcs/auth-service/keys/jwt-public.pem:/app/keys/jwt-public.pem:ro  # Mount public key
```

---

## Development Workflow

### Initial Setup

**1. Generate JWT Keys:**
```bash
cd srcs/auth-service/keys
bash generate-keys.sh
```

**2. Update .gitignore:**
```bash
# Add to project root .gitignore
srcs/auth-service/keys/jwt-private.pem
srcs/api-gateway/keys/jwt-private.pem
```

**3. Start Services:**
```bash
make build
make up
```

### Running Tests

```bash
# All tests
docker exec ft_transcendence_auth_service pytest tests/ -v

# With coverage
docker exec ft_transcendence_auth_service pytest tests/ --cov=. --cov-report=html

# Specific test file
docker exec ft_transcendence_auth_service pytest tests/test_authentication.py -v
```

### Manual Testing

```bash
# Register (via API Gateway)
curl -X POST https://localhost/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","first_name":"Test","last_name":"User"}' \
  -c cookies.txt -k

# Login
curl -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}' \
  -c cookies.txt -k

# Refresh token
curl -X POST https://localhost/api/v1/auth/refresh \
  -b cookies.txt -k

# Logout
curl -X POST https://localhost/api/v1/auth/logout \
  -b cookies.txt -k
```

### Database Operations

```bash
# Create migration
docker exec ft_transcendence_auth_service python manage.py makemigrations

# Apply migrations
docker exec ft_transcendence_auth_service python manage.py migrate

# Create superuser
docker exec -it ft_transcendence_auth_service python manage.py createsuperuser

# Django shell
docker exec -it ft_transcendence_auth_service python manage.py shell
```

### Key Rotation (Production)

```bash
# 1. Generate new key pair
cd srcs/auth-service/keys
bash generate-keys.sh

# 2. Restart services (docker-compose auto-mounts new keys)
docker-compose restart auth-service api-gateway

# 3. All old JWTs become invalid (users must re-login)
```

---

## Future Enhancements (Post-MVP)

### Email Verification
- Add email service integration (SendGrid, AWS SES)
- Generate verification tokens
- `POST /api/v1/auth/verify-email` endpoint
- Update `is_verified` flag on verification

### Password Reset
- `POST /api/v1/auth/forgot-password` - Send reset email
- `POST /api/v1/auth/reset-password` - Reset with token
- Store reset tokens in database (expiring)

### Session Management
- `GET /api/v1/auth/sessions` - List active refresh tokens
- `POST /api/v1/auth/logout-all` - Revoke all user tokens
- Track device/IP information

### OAuth Integration
- Social login (Google, Apple, Facebook)
- Link social accounts to existing users
- Unified user profile

### Two-Factor Authentication
- TOTP-based 2FA (authenticator apps)
- Backup codes for account recovery
- SMS-based 2FA (optional)

---

## Summary

This design provides:

✅ **Security First:**
- RS256 asymmetric JWT signing
- HTTP-only cookies (XSS protection)
- Argon2 password hashing
- Token revocation support

✅ **Best Practices:**
- RESTful API design
- Standardized error responses
- Comprehensive validation
- TDD approach with 80%+ coverage

✅ **Scalability:**
- Stateless token validation (API Gateway)
- Database-backed revocation
- Multiple service support

✅ **Production Ready:**
- Docker containerization
- Health checks
- Structured logging
- Environment-based configuration

✅ **Developer Friendly:**
- Clear API documentation
- Easy local development
- Comprehensive testing
- Manual testing examples

The auth-service integrates seamlessly with the existing API Gateway and follows the same architectural patterns for consistency across the SmartBreeds platform.
