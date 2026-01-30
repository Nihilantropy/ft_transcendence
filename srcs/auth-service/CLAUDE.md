# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

Django REST Framework microservice handling user authentication via JWT tokens with RS256 asymmetric signing. Part of the SmartBreeds platform's microservices architecture.

**Port:** 3001 (internal, accessed via API Gateway)

**Django Configuration:** API-only service with `APPEND_SLASH = False` for RESTful conventions (no trailing slashes)

## Commands

### Testing
```bash
# Run all tests (77 tests) - use `run --rm` for reliability
docker compose run --rm auth-service python -m pytest tests/ -v

# Run specific test file
docker exec ft_transcendence_auth_service python -m pytest tests/test_models.py -v

# Run single test
docker exec ft_transcendence_auth_service python -m pytest tests/test_models.py::TestUserModel::test_create_user_with_email -v

# With coverage
docker exec ft_transcendence_auth_service python -m pytest tests/ --cov=apps --cov-report=html

# Run tests locally (requires PostgreSQL running)
python -m pytest tests/ -v
```

### Database Migrations
```bash
docker exec ft_transcendence_auth_service python manage.py makemigrations
docker exec ft_transcendence_auth_service python manage.py migrate
```

### Development Server
```bash
docker exec ft_transcendence_auth_service python manage.py runserver 0.0.0.0:3001
```

### Generate JWT Keys
```bash
./keys/generate-keys.sh
```

## Architecture

### Project Structure
```
config/          # Django settings and root URL config
apps/
  authentication/
    models.py      # User, RefreshToken models
    jwt_utils.py   # Token generation/decoding (RS256)
    validators.py  # Custom password validator
    serializers.py # DRF serializers for registration/login
    utils.py       # Standardized API responses
    views.py       # Endpoints (pending implementation)
tests/           # pytest-django tests
keys/            # RS256 key pair (private key is gitignored)
```

### Models

**User** (`apps/authentication/models.py`):
- UUID primary key
- Email as username (case-insensitive, unique)
- Roles: `user`, `admin`
- Password hashed with Argon2

**RefreshToken** (`apps/authentication/models.py`):
- Links to User via foreign key
- Stores SHA256 hash of token (not raw token)
- Has `is_valid()` and `revoke()` methods

### JWT Token Flow
1. Auth service signs tokens with **private key** (RS256)
2. Tokens contain: `user_id`, `email`, `role`, `token_type`, `iat`, `exp`
3. Access tokens: 15 min lifetime
4. Refresh tokens: 7 day lifetime, stored as hash in `RefreshToken` model
5. API Gateway validates with **public key** (shared with gateway)

### Standardized Response Format
All endpoints must use `success_response()` and `error_response()` from `apps/authentication/utils.py`:
```python
# Success
{"success": true, "data": {...}, "error": null, "timestamp": "..."}

# Error
{"success": false, "data": null, "error": {"code": "...", "message": "...", "details": {}}, "timestamp": "..."}
```

## Configuration

Environment variables loaded via `python-decouple` from `.env`:

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_ALGORITHM` | RS256 | Do not change |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | 15 | |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | 7 | |
| `JWT_PRIVATE_KEY_PATH` | keys/jwt-private.pem | Auth service only |
| `JWT_PUBLIC_KEY_PATH` | keys/jwt-public.pem | Shared with API Gateway |

## Testing Patterns

Tests use `pytest-django`. Mark database tests with `@pytest.mark.django_db`:
```python
@pytest.mark.django_db
class TestUserModel:
    def test_create_user_with_email(self):
        user = User.objects.create_user(email='test@example.com', password='testpass123')
        assert user.email == 'test@example.com'
```

Custom markers defined in `pytest.ini`:
- `@pytest.mark.slow` - slow tests
- `@pytest.mark.integration` - integration tests

## Current State

**Fully Implemented (77 tests passing):**
- User model with email auth, Argon2 hashing
- RefreshToken model with hash storage
- JWT utilities (generate/decode/hash)
- Password validator (letter + number requirement)
- Serializers (User, Register, Login)
- Response utilities
- Login endpoint (POST /api/v1/auth/login)
- Register endpoint (POST /api/v1/auth/register)
- Refresh endpoint (POST /api/v1/auth/refresh) with token rotation
- Logout endpoint (POST /api/v1/auth/logout) with graceful error handling

**Service Status:** Complete - all authentication endpoints implemented
