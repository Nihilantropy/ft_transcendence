# Auth Service Login Endpoint Design

**Date:** 2026-01-22
**Status:** Approved
**Service:** auth-service (Django)

## Overview

Implement the login endpoint for user authentication. This is the foundational auth endpoint that validates credentials and issues JWT tokens as HTTP-only cookies.

## Endpoint Specification

**Endpoint:** `POST /api/v1/auth/login`
**Authentication:** None (public endpoint)

### Request

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Success Response (200 OK)

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
| Missing email/password | 422 | `VALIDATION_ERROR` | Field-specific in details |
| User not found | 401 | `INVALID_CREDENTIALS` | "Invalid email or password" |
| Wrong password | 401 | `INVALID_CREDENTIALS` | "Invalid email or password" |
| Account deactivated | 403 | `ACCOUNT_DISABLED` | "Account is disabled" |

**Security Note:** "User not found" and "wrong password" return identical responses to prevent user enumeration.

## Session Policy

**Single active session:** On successful login, all previous refresh tokens for the user are revoked. User can only be logged in on one device at a time.

## Implementation Flow

```
1. Validate request body using LoginSerializer
   ├─ Invalid? → 422 VALIDATION_ERROR

2. Query User by email (case-insensitive)
   ├─ Not found? → 401 INVALID_CREDENTIALS

3. Check user.is_active
   ├─ False? → 403 ACCOUNT_DISABLED

4. Verify password using user.check_password()
   ├─ Invalid? → 401 INVALID_CREDENTIALS

5. Revoke all existing refresh tokens for this user
   └─ RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

6. Generate new access token
   └─ jwt_utils.generate_access_token(user)

7. Create new RefreshToken record
   ├─ Generate refresh token using jwt_utils.generate_refresh_token(user, token_id)
   ├─ Store SHA256 hash in database
   └─ Set expires_at = now + 7 days

8. Set HTTP-only cookies on response
   ├─ access_token: max_age=15*60 seconds
   └─ refresh_token: max_age=7*24*60*60 seconds, path=/api/v1/auth/refresh

9. Return success_response with user data (UserSerializer)
```

## Cookie Configuration

From `settings.py`:
- `secure`: `COOKIE_SECURE` (False in dev, True in prod)
- `samesite`: `COOKIE_SAMESITE` (Strict)
- `httponly`: True (always)
- `domain`: `COOKIE_DOMAIN` (localhost in dev)

## Files to Modify

1. **`apps/authentication/views.py`** - Add `LoginView` class
2. **`apps/authentication/urls.py`** - Add URL pattern for login
3. **`tests/test_views.py`** (new) - Add login endpoint tests

## Test Cases

1. Successful login with valid credentials
2. Login with invalid email format (422)
3. Login with non-existent user (401)
4. Login with wrong password (401)
5. Login with disabled account (403)
6. Verify cookies are set correctly
7. Verify previous refresh tokens are revoked
8. Verify response format matches specification

## Dependencies

Uses existing components:
- `LoginSerializer` from `apps/authentication/serializers.py`
- `UserSerializer` from `apps/authentication/serializers.py`
- `generate_access_token`, `generate_refresh_token`, `hash_token` from `apps/authentication/jwt_utils.py`
- `success_response`, `error_response` from `apps/authentication/utils.py`
- `User`, `RefreshToken` models from `apps/authentication/models.py`
