# Auth Service Refresh Endpoint Design

**Date:** 2026-01-22
**Status:** Approved
**Service:** auth-service (Django)

## Overview

Implement the token refresh endpoint for seamless session continuation. Exchanges a valid refresh token for new access and refresh tokens, implementing token rotation for security.

## Endpoint Specification

**Endpoint:** `POST /api/v1/auth/refresh`
**Authentication:** Refresh token via HTTP-only cookie (automatically sent)

### Request

No request body required. The refresh token is sent automatically via the `refresh_token` cookie (path restricted to `/api/v1/auth/refresh`).

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
| No refresh_token cookie | 401 | `MISSING_TOKEN` | "Refresh token is required" |
| Invalid/malformed JWT | 401 | `INVALID_TOKEN` | "Invalid refresh token" |
| Token expired (past exp claim) | 401 | `TOKEN_EXPIRED` | "Refresh token has expired" |
| Token not found in database | 401 | `INVALID_TOKEN` | "Invalid refresh token" |
| Token revoked (is_revoked=True) | 401 | `TOKEN_REVOKED` | "Refresh token has been revoked" |
| Token hash mismatch | 401 | `INVALID_TOKEN` | "Invalid refresh token" |
| User not found | 401 | `INVALID_TOKEN` | "Invalid refresh token" |
| User account disabled | 403 | `ACCOUNT_DISABLED` | "Account is disabled" |

**Note:** Generic "Invalid refresh token" message used for most failures to prevent enumeration attacks.

## Token Rotation Security

Each refresh operation:
1. Revokes the current refresh token immediately
2. Issues a completely new refresh token

This ensures stolen tokens can only be used once. If an attacker uses a stolen token, the legitimate user's next refresh attempt will fail with `TOKEN_REVOKED`, signaling a potential compromise.

## Implementation Flow

```
1. Extract refresh_token from cookies
   └─ Missing? → 401 MISSING_TOKEN

2. Decode JWT (using public key)
   ├─ Invalid signature/malformed? → 401 INVALID_TOKEN
   ├─ Expired (exp claim)? → 401 TOKEN_EXPIRED
   └─ Wrong token_type (not 'refresh')? → 401 INVALID_TOKEN

3. Find RefreshToken record by jti (token ID from JWT)
   └─ Not found? → 401 INVALID_TOKEN

4. Validate RefreshToken record
   ├─ is_revoked=True? → 401 TOKEN_REVOKED
   ├─ expires_at passed? → 401 TOKEN_EXPIRED
   └─ token_hash != hash(cookie_value)? → 401 INVALID_TOKEN

5. Find user by user_id from JWT
   └─ Not found? → 401 INVALID_TOKEN

6. Check user status
   └─ is_active=False? → 403 ACCOUNT_DISABLED

7. Revoke current refresh token (token rotation)
   └─ Set is_revoked=True on the RefreshToken record

8. Issue new tokens (reuse issue_auth_tokens helper)
   ├─ Generate new access token
   ├─ Create new RefreshToken record
   └─ Set HTTP-only cookies

9. Return success_response with user data (200 OK)
```

## Files to Modify

1. **`apps/authentication/views.py`** - Add `RefreshView`
2. **`apps/authentication/urls.py`** - Add URL pattern for refresh
3. **`tests/test_views.py`** - Add refresh endpoint tests

## Test Cases

1. Successful refresh with valid token (200)
2. Refresh sets new access_token cookie
3. Refresh sets new refresh_token cookie
4. Refresh creates new RefreshToken record
5. Refresh revokes old RefreshToken (token rotation)
6. Missing refresh_token cookie (401 MISSING_TOKEN)
7. Invalid/malformed JWT (401 INVALID_TOKEN)
8. Expired JWT (401 TOKEN_EXPIRED)
9. Token not in database (401 INVALID_TOKEN)
10. Token already revoked (401 TOKEN_REVOKED)
11. User not found (401 INVALID_TOKEN)
12. User account disabled (403 ACCOUNT_DISABLED)
13. Wrong token_type (access token used as refresh) (401 INVALID_TOKEN)

## Dependencies

Uses existing components:
- `decode_token`, `hash_token` from `apps/authentication/jwt_utils.py`
- `issue_auth_tokens`, `success_response`, `error_response` from `apps/authentication/utils.py`
- `UserSerializer` from `apps/authentication/serializers.py`
- `User`, `RefreshToken` models from `apps/authentication/models.py`

## Implementation Order

1. Write failing tests for RefreshView
2. Implement RefreshView
3. Add URL pattern
4. Verify all tests pass
