# Integration Test Failure Analysis
**Date:** 2026-01-23
**Status:** ✅ ALL TESTS PASSING (8/8)

## Summary

Integration tests are failing due to Django's trailing slash behavior conflicting with API Gateway's URL proxying. This is a configuration issue, not a code bug.

## Failed Tests

| Test | Status | Issue |
|------|--------|-------|
| User Registration | ⚠️ Expected | User already exists (acceptable) |
| User Login | ✅ Pass | - |
| Get User Profile | ❌ Fail | Empty response (301 redirect not followed) |
| Update User Profile | ❌ Fail | `INTERNAL_ERROR` (RuntimeError) |
| Create Pet | ❌ Fail | `INTERNAL_ERROR` (RuntimeError) |
| List User Pets | ❌ Fail | Empty response (301 redirect not followed) |
| Token Refresh | ❌ Fail | `MISSING_TOKEN` (refresh_token not in cookies) |
| Logout | ✅ Pass | - |

## Root Cause Analysis

### Issue 1: Django Trailing Slash Behavior

**Problem:**
Django's `APPEND_SLASH` setting (enabled by default) expects URLs to end with trailing slashes. The integration test script sends requests without trailing slashes.

**Evidence from logs:**
```
RuntimeError: You called this URL via PATCH, but the URL doesn't end in a slash
and you have APPEND_SLASH set. Django can't redirect to the slash URL while
maintaining PATCH data. Change your form to point to user-service:3002/api/v1/users/me/
(note the trailing slash), or set APPEND_SLASH=False in your Django settings.
```

**How it manifests:**

1. **GET requests** (GET /api/v1/users/me, GET /api/v1/pets):
   - Django returns `301 Redirect` to `/api/v1/users/me/`
   - curl without `-L` flag doesn't follow redirects
   - Result: Empty response in test script

2. **POST/PATCH/PUT requests** (PATCH /api/v1/users/me, POST /api/v1/pets):
   - Django cannot redirect because it would lose the request body
   - Raises `RuntimeError` (HTTP 500)
   - Result: `INTERNAL_ERROR` response

**Why this happens:**
- DRF's `DefaultRouter` (used in `srcs/user-service/apps/profiles/urls.py`) automatically adds trailing slashes to registered routes
- API Gateway proxies requests exactly as received (no trailing slash manipulation)
- Integration test uses standard RESTful conventions (no trailing slash)

### Issue 2: Refresh Token Missing from Cookies

**Problem:**
The refresh endpoint expects a `refresh_token` cookie, but it's not being sent.

**Evidence:**
```json
{
  "success": false,
  "error": {
    "code": "MISSING_TOKEN",
    "message": "Refresh token is required"
  }
}
```

**Why this happens:**
- Login endpoint sets two cookies: `access_token` and `refresh_token`
- curl's cookie file (`/tmp/smartbreeds_cookies.txt`) saves cookies
- However, the cookie might have expired, been overwritten, or have wrong domain/path attributes
- Need to verify cookie attributes match the request path

### Issue 3: Empty Responses for GET Requests

**Problem:**
GET requests return empty responses instead of 301 redirects.

**Explanation:**
- The 301 redirect response has no body content
- curl shows this as an empty response
- The `grep -q '"success":true'` check fails because there's no JSON response

## Recommended Fixes

### Fix 1: Disable APPEND_SLASH in User Service (RECOMMENDED)

**Why this is the best solution:**
- API-only services typically don't need trailing slash behavior
- Matches RESTful API conventions (no trailing slashes)
- Simplifies API Gateway proxying (no URL manipulation needed)
- Consistent with industry standards (AWS API Gateway, Google Cloud Endpoints, etc.)

**Implementation:**

Edit `srcs/user-service/config/settings.py`:
```python
# Disable trailing slash for API-only service
APPEND_SLASH = False
```

**Impact:**
- All POST/PATCH/PUT requests work immediately
- GET requests work without redirects
- No changes needed in API Gateway or integration tests
- Slight URL inconsistency (no trailing slash) is acceptable for APIs

### Fix 2: Add Trailing Slashes to Integration Tests (ALTERNATIVE)

**Why this works:**
- Django's expected behavior is maintained
- Consistent with Django/DRF conventions

**Implementation:**

Edit `scripts/run-integration-tests.sh` to add trailing slashes:
```bash
# Change:
curl -s -X GET http://localhost:8001/api/v1/users/me

# To:
curl -s -X GET http://localhost:8001/api/v1/users/me/
```

**Downsides:**
- Inconsistent with standard RESTful conventions
- All external clients must remember to add trailing slashes
- API Gateway documentation must emphasize this requirement

### Fix 3: Configure curl to Follow Redirects (NOT RECOMMENDED)

**Implementation:**
Add `-L` flag to all curl commands in integration tests.

**Why this is not ideal:**
- Extra network roundtrip for every GET request (performance impact)
- Doesn't solve POST/PATCH/PUT issues (Django still throws RuntimeError)
- Masks the underlying configuration issue

### Fix 4: Refresh Token Cookie Issue

**Diagnosis steps:**
1. Check cookie file content: `cat /tmp/smartbreeds_cookies.txt`
2. Verify cookies have correct domain/path attributes
3. Check cookie expiration times

**Potential fixes:**
- Ensure auth service sets cookies with `path=/` (not just `/api/v1/auth`)
- Check `SameSite` and `Secure` attributes don't block cookie transmission
- Verify cookie domain matches request domain

## Implementation Plan

### Phase 1: Fix Trailing Slash Issue (5 min)

1. Edit `srcs/user-service/config/settings.py`
2. Add `APPEND_SLASH = False`
3. Restart user service: `docker compose restart user-service`
4. Re-run integration tests: `bash scripts/run-integration-tests.sh`

### Phase 2: Debug Refresh Token (if still failing)

1. Check cookie file: `cat /tmp/smartbreeds_cookies.txt`
2. Verify cookie attributes in auth service response
3. Check API Gateway cookie forwarding (already implemented in ProxyResponse class)

### Phase 3: Verify All Tests Pass

Expected result after Phase 1:
- ✅ Get User Profile
- ✅ Update User Profile
- ✅ Create Pet
- ✅ List User Pets
- ⚠️ Token Refresh (may still need debugging)

## Long-term Recommendations

1. **Document trailing slash policy** in API documentation
2. **Add API Gateway URL normalization** (optional): Strip or add trailing slashes consistently
3. **Standardize across services**: Ensure auth-service also has `APPEND_SLASH = False`
4. **Update test suite** to verify both trailing and non-trailing slash behavior
5. **Add integration test for cookie handling** to catch refresh token issues early

## Final Resolution

**All 8 tests now passing!** The following fixes were implemented:

### Fix 1: Django Trailing Slash Configuration
**Files Modified:**
- `srcs/user-service/config/settings.py` - Added `APPEND_SLASH = False`
- `srcs/auth-service/config/settings.py` - Added `APPEND_SLASH = False`
- `srcs/user-service/apps/profiles/urls.py` - Changed `DefaultRouter()` to `DefaultRouter(trailing_slash=False)`

**Impact:** Enabled API-only services to accept URLs without trailing slashes, matching RESTful conventions.

### Fix 2: Response Object Double-Wrapping
**Files Modified:**
- `srcs/user-service/apps/profiles/views.py` - Removed `Response()` wrapper around `success_response()` and `error_response()` calls

**Issue:** The utility functions already return `Response` objects, but views were wrapping them again, causing `TypeError: Object of type Response is not JSON serializable`.

**Fix:** Changed from:
```python
return Response(success_response(serializer.data))  # WRONG
```
To:
```python
return success_response(serializer.data)  # CORRECT
```

### Fix 3: Cookie Forwarding for Auth Endpoints
**Files Modified:**
- `srcs/api-gateway/routes/proxy.py` - Added conditional cookie forwarding for `/api/v1/auth/*` endpoints

**Issue:** API Gateway was stripping all cookies before forwarding to backend services. The refresh and logout endpoints need access to the `refresh_token` cookie.

**Fix:** Modified proxy to preserve cookies for auth service endpoints:
```python
# Strip cookies for non-auth endpoints (auth service needs cookies for refresh/logout)
if not path.startswith("/api/v1/auth"):
    forward_headers.pop("cookie", None)
```

## Test Results

**Before fixes:** 3/8 passing (Registration, Login, Logout)
**After fixes:** 8/8 passing (100% success rate)

All integration tests now pass:
- ✅ User Registration (expected: already exists)
- ✅ User Login
- ✅ Get User Profile
- ✅ Update User Profile
- ✅ Create Pet
- ✅ List User Pets
- ✅ Token Refresh
- ✅ Logout

## References

- Django `APPEND_SLASH` documentation: https://docs.djangoproject.com/en/5.1/ref/settings/#append-slash
- DRF Router trailing slashes: https://www.django-rest-framework.org/api-guide/routers/#defaultrouter
- User Service logs: `docker compose logs user-service | tail -50`
