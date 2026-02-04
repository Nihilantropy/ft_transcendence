# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

Django REST Framework microservice handling user profiles and pet management. Part of the SmartBreeds platform's microservices architecture.

**Port:** 3002 (internal, accessed via API Gateway)

**Django Configuration:** API-only service with `APPEND_SLASH = False` and `DefaultRouter(trailing_slash=False)` for RESTful conventions (no trailing slashes)

## Commands

### Testing

```bash
# Run all tests (~41 tests total)
docker compose run --rm user-service python -m pytest tests/ -v

# Specific test file
docker exec ft_transcendence_user_service python -m pytest tests/test_models.py -v

# Single test function
docker exec ft_transcendence_user_service python -m pytest tests/test_models.py::test_function_name -v

# With coverage
docker exec ft_transcendence_user_service python -m pytest tests/ --cov=apps --cov-report=html
```

**Test Limitations:** No cross-schema FK constraints (user_id fields are soft references). pytest-django auto-creates an isolated test DB at runtime from the configured `smartbreeds` database — no separate test database is provisioned.

### Database Migrations

```bash
docker exec ft_transcendence_user_service python manage.py makemigrations
docker exec ft_transcendence_user_service python manage.py migrate
```

### Development Server

```bash
docker exec ft_transcendence_user_service python manage.py runserver 0.0.0.0:3002
```

## Architecture

### Project Structure

```
config/          # Django settings and root URL config
apps/
  profiles/
    models.py      # UserProfile, Pet, PetAnalysis models
    serializers.py # DRF serializers
    views.py       # ViewSet endpoints
    permissions.py # IsOwnerOrAdmin permission
    middleware.py  # UserContextMiddleware (X-User-ID extraction)
    utils.py       # Standardized API responses
tests/           # pytest-django tests
```

### Response Utilities

**IMPORTANT:** `success_response()` and `error_response()` in `apps/profiles/utils.py` already return `Response` objects.

**Correct usage:**
```python
return success_response(serializer.data)  # ✓ Correct
return error_response('NOT_FOUND', 'Pet not found', status=404)  # ✓ Correct
```

**Incorrect usage:**
```python
return Response(success_response(serializer.data))  # ✗ Double-wrapping causes serialization error
```

### Models

**UserProfile**: Extended user data (phone, address, preferences)
**Pet**: Pet profiles (name, breed, species, age, weight, health_conditions)
**PetAnalysis**: History of breed identification analyses

### API Endpoints

**User Profiles:**
- GET/PUT/PATCH /api/v1/users/me

**Pets:**
- GET /api/v1/pets - List user's pets
- POST /api/v1/pets - Create pet
- GET /api/v1/pets/{id} - Get pet details
- PUT/PATCH /api/v1/pets/{id} - Update pet
- DELETE /api/v1/pets/{id} - Delete pet
- GET /api/v1/pets/{id}/analyses - Get analysis history

**Pet Analyses:**
- GET /api/v1/analyses - List analyses
- POST /api/v1/analyses - Create analysis record
- GET /api/v1/analyses/{id} - Get specific analysis

### Authentication Flow

User-service receives pre-authenticated requests from API Gateway:
- `X-User-ID` header: Authenticated user UUID
- `X-User-Role` header: User role (user/admin)
- UserContextMiddleware extracts headers and attaches to request
- IsOwnerOrAdmin permission checks ownership or admin role

### Database Schema

**user_schema** (PostgreSQL):
- `user_profiles` - Extended user data
- `pets` - Pet profiles
- `pet_analyses` - Breed identification history

**Cross-schema references (soft, no DB-level FK):**
- user_profiles.user_id, pets.user_id — plain UUIDs referencing auth_schema.users.id
- Validated at the API/view layer, not enforced by the database

## Configuration

Environment variables loaded via `python-decouple` from `.env`:

| Variable | Default | Notes |
|----------|---------|-------|
| `DB_NAME` | smartbreeds | Shared database |
| `DB_USER` | smartbreeds_user | |
| `DB_PASSWORD` | smartbreeds_password | |
| `DB_HOST` | db | Docker service name |

## Current State

**Status:** Fully implemented with 41 passing tests

**Completed:**
- UserProfile, Pet, PetAnalysis models
- 6 serializers with validation
- 3 ViewSets with full CRUD operations
- IsOwnerOrAdmin permission class
- UserContextMiddleware
- Database migrations with cross-schema FKs
- Docker integration
- Comprehensive test suite

**Test Breakdown:**
- Models: 12 tests
- Middleware: 4 tests
- Permissions: 5 tests
- Serializers: 11 tests
- Views: 9 tests

**Note:** user_id fields are soft references (plain UUIDs), not ForeignKeys. No cross-schema FK constraints exist.
