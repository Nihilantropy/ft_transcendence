# Auth Service Register Endpoint Design

**Date:** 2026-01-22
**Status:** Approved
**Service:** auth-service (Django)

## Overview

Implement the registration endpoint for new user signup. Creates a user account and immediately logs them in by issuing JWT tokens as HTTP-only cookies.

## Endpoint Specification

**Endpoint:** `POST /api/v1/auth/register`
**Authentication:** None (public endpoint)

### Request

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

| Field | Required | Constraints |
|-------|----------|-------------|
| email | Yes | Valid email format, unique (case-insensitive) |
| password | Yes | Min 8 chars, at least one letter, at least one number |
| first_name | No | Max 150 chars |
| last_name | No | Max 150 chars |

### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": true
    }
  },
  "error": null,
  "timestamp": "2026-01-22T10:30:00.000000Z"
}
```

**Cookies Set:**
- `access_token`: JWT, 15 min expiry, HttpOnly, Secure (prod), SameSite=Strict
- `refresh_token`: JWT, 7 day expiry, HttpOnly, Secure (prod), SameSite=Strict, Path=/api/v1/auth/refresh

## Error Responses

| Scenario | Status | Code | Message |
|----------|--------|------|---------|
| Invalid email format | 422 | `VALIDATION_ERROR` | "Enter a valid email address" |
| Missing email | 422 | `VALIDATION_ERROR` | Field-specific in details |
| Missing password | 422 | `VALIDATION_ERROR` | Field-specific in details |
| Email already exists | 409 | `EMAIL_ALREADY_EXISTS` | "A user with this email already exists" |
| Password too short | 422 | `VALIDATION_ERROR` | "Password must be at least 8 characters" |
| Password missing letter | 422 | `VALIDATION_ERROR` | "Password must contain at least one letter" |
| Password missing number | 422 | `VALIDATION_ERROR` | "Password must contain at least one number" |

**Note:** 409 Conflict is used for duplicate email to clearly distinguish "already exists" from "invalid format".

## Account Policy

- **Immediately active:** Accounts are usable right away without email verification
- **Auto-login:** Registration issues JWT tokens, user is logged in immediately
- **Default role:** New users have role="user"

## Implementation Flow

```
1. Validate request body using RegisterSerializer
   ├─ Invalid email format? → 422 VALIDATION_ERROR
   ├─ Missing required fields? → 422 VALIDATION_ERROR
   ├─ Password validation failed? → 422 VALIDATION_ERROR
   └─ Email already exists? → 409 EMAIL_ALREADY_EXISTS

2. Create user via serializer.save()
   └─ Hashes password with Argon2, saves to database

3. Issue tokens (shared helper with LoginView)
   ├─ Generate access token
   ├─ Create RefreshToken record with SHA256 hash
   └─ Set HTTP-only cookies on response

4. Return success_response with user data (201 Created)
```

## Refactoring: Token Issuance Helper

Extract shared token issuance logic into a helper function:

```python
# apps/authentication/utils.py

def issue_auth_tokens(user, response):
    """
    Issue access and refresh tokens for a user.

    Args:
        user: User object to issue tokens for
        response: Response object to set cookies on

    Returns:
        response: Response with cookies set
    """
    # Generate access token
    access_token = generate_access_token(user)

    # Create refresh token record
    refresh_token_record = RefreshToken.objects.create(
        user=user,
        token_hash='placeholder',
        expires_at=timezone.now() + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)
    )

    # Generate refresh token
    refresh_token = generate_refresh_token(user, refresh_token_record.id)

    # Update token hash
    refresh_token_record.token_hash = hash_token(refresh_token)
    refresh_token_record.save(update_fields=['token_hash'])

    # Set cookies
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path='/api/v1/auth/refresh',
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    return response
```

## Files to Modify

1. **`apps/authentication/utils.py`** - Add `issue_auth_tokens()` helper
2. **`apps/authentication/views.py`** - Add `RegisterView`, refactor `LoginView` to use helper
3. **`apps/authentication/urls.py`** - Add URL pattern for register
4. **`tests/test_views.py`** - Add register endpoint tests

## Test Cases

1. Successful registration with all fields
2. Successful registration with only required fields (no names)
3. Registration with invalid email format (422)
4. Registration with missing email (422)
5. Registration with missing password (422)
6. Registration with duplicate email (409)
7. Registration with weak password - too short (422)
8. Registration with password missing letter (422)
9. Registration with password missing number (422)
10. Verify cookies are set correctly
11. Verify user is created in database
12. Verify RefreshToken is created
13. Email is case-insensitive (TEST@example.com treated same as test@example.com)

## Dependencies

Uses existing components:
- `RegisterSerializer` from `apps/authentication/serializers.py`
- `UserSerializer` from `apps/authentication/serializers.py`
- `generate_access_token`, `generate_refresh_token`, `hash_token` from `apps/authentication/jwt_utils.py`
- `success_response`, `error_response` from `apps/authentication/utils.py`
- `User`, `RefreshToken` models from `apps/authentication/models.py`

## Implementation Order

1. Add `issue_auth_tokens()` helper to utils.py
2. Write failing tests for RegisterView
3. Implement RegisterView
4. Refactor LoginView to use the helper
5. Verify all tests pass
