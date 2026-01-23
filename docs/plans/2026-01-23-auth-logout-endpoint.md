# Auth Service Logout Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement logout endpoint that revokes refresh token and clears authentication cookies.

**Architecture:** POST endpoint that extracts refresh token from cookie, revokes it in database, and clears both access_token and refresh_token cookies. Gracefully handles already-revoked or missing tokens.

**Tech Stack:** Django REST Framework, pytest, HTTP-only cookies

---

## Endpoint Specification

**Endpoint:** `POST /api/v1/auth/logout`
**Authentication:** Refresh token via HTTP-only cookie (optional - logout succeeds even without token)

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  },
  "error": null,
  "timestamp": "2026-01-23T10:30:00.000000Z"
}
```

**Cookies Cleared:**
- `access_token`: Set to empty with max_age=0
- `refresh_token`: Set to empty with max_age=0, path=/api/v1/auth/refresh

### Error Responses

| Scenario | Status | Code | Message |
|----------|--------|------|---------|
| Invalid/malformed JWT | 200 | - | Still succeeds (clears cookies) |
| Token not in database | 200 | - | Still succeeds (clears cookies) |
| Token already revoked | 200 | - | Still succeeds (clears cookies) |
| No refresh_token cookie | 200 | - | Still succeeds (clears cookies) |

**Design Decision:** Logout always succeeds and clears cookies. This prevents information leakage and ensures users can always "log out" even with corrupted/expired tokens.

---

## Task 1: Write Logout Tests

**Files:**
- Modify: `srcs/auth-service/tests/test_views.py`

**Step 1: Add TestLogoutView test class with all test cases**

Add to end of `tests/test_views.py`:

```python
@pytest.mark.django_db
class TestLogoutView:
    """Tests for POST /api/v1/auth/logout"""

    @pytest.fixture
    def user_with_refresh_token(self, user):
        """Create a user with a valid refresh token and return (user, token_cookie_value)"""
        refresh_token_record = RefreshToken.objects.create(
            user=user,
            token_hash='placeholder',
            expires_at=timezone.now() + timedelta(days=7)
        )
        token = generate_refresh_token(user, refresh_token_record.id)
        refresh_token_record.token_hash = hash_token(token)
        refresh_token_record.save(update_fields=['token_hash'])
        return user, token, refresh_token_record

    def test_logout_with_valid_token_returns_200(self, client, user_with_refresh_token):
        """Successful logout returns 200 with success message"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['message'] == 'Successfully logged out'

    def test_logout_revokes_refresh_token(self, client, user_with_refresh_token):
        """Logout revokes the refresh token in database"""
        user, token, record = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        record.refresh_from_db()
        assert record.is_revoked is True

    def test_logout_clears_access_token_cookie(self, client, user_with_refresh_token):
        """Logout clears the access_token cookie"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie.value == ''
        assert cookie['max-age'] == 0

    def test_logout_clears_refresh_token_cookie(self, client, user_with_refresh_token):
        """Logout clears the refresh_token cookie"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert 'refresh_token' in response.cookies
        cookie = response.cookies['refresh_token']
        assert cookie.value == ''
        assert cookie['max-age'] == 0
        assert cookie['path'] == '/api/v1/auth/refresh'

    def test_logout_without_cookie_still_succeeds(self, client):
        """Logout without refresh_token cookie still returns 200"""
        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['message'] == 'Successfully logged out'

    def test_logout_with_invalid_jwt_still_succeeds(self, client):
        """Logout with invalid JWT still returns 200 and clears cookies"""
        client.cookies['refresh_token'] = 'not-a-valid-jwt'

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        # Cookies should still be cleared
        assert response.cookies['access_token'].value == ''
        assert response.cookies['refresh_token'].value == ''

    def test_logout_with_expired_jwt_still_succeeds(self, client, user):
        """Logout with expired JWT still returns 200"""
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(user.id),  # Fake token_id
            'token_type': 'refresh',
            'iat': int((timezone.now() - timedelta(days=8)).timestamp()),
            'exp': int((timezone.now() - timedelta(days=1)).timestamp())
        }
        expired_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)
        client.cookies['refresh_token'] = expired_token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

    def test_logout_with_revoked_token_still_succeeds(self, client, user_with_refresh_token):
        """Logout with already-revoked token still returns 200"""
        user, token, record = user_with_refresh_token
        record.is_revoked = True
        record.save(update_fields=['is_revoked'])
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

    def test_logout_with_token_not_in_database_still_succeeds(self, client, user):
        """Logout with token not in database still returns 200"""
        import uuid
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(uuid.uuid4()),  # Non-existent ID
            'token_type': 'refresh',
            'iat': int(timezone.now().timestamp()),
            'exp': int((timezone.now() + timedelta(days=7)).timestamp())
        }
        fake_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)
        client.cookies['refresh_token'] = fake_token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
```

**Step 2: Run tests to verify they fail**

Run: `docker compose run --rm auth-service python -m pytest tests/test_views.py::TestLogoutView -v`

Expected: All 10 tests FAIL with "404 Not Found" (endpoint doesn't exist yet)

**Step 3: Commit tests**

```bash
git add srcs/auth-service/tests/test_views.py
git commit -m "test(auth-service): add logout endpoint tests"
```

---

## Task 2: Add clear_auth_cookies Helper

**Files:**
- Modify: `srcs/auth-service/apps/authentication/utils.py`

**Step 1: Add clear_auth_cookies function**

Add to end of `apps/authentication/utils.py`:

```python
def clear_auth_cookies(response):
    """
    Clear authentication cookies (for logout).

    Args:
        response: Response object to clear cookies on

    Returns:
        response: Response with cookies cleared
    """
    # Clear access_token
    response.set_cookie(
        key='access_token',
        value='',
        max_age=0,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    # Clear refresh_token
    response.set_cookie(
        key='refresh_token',
        value='',
        max_age=0,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path='/api/v1/auth/refresh',
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    return response
```

**Step 2: Commit helper**

```bash
git add srcs/auth-service/apps/authentication/utils.py
git commit -m "feat(auth-service): add clear_auth_cookies helper"
```

---

## Task 3: Implement LogoutView

**Files:**
- Modify: `srcs/auth-service/apps/authentication/views.py`

**Step 1: Add LogoutView class**

Add import at top of `views.py`:
```python
from apps.authentication.utils import success_response, error_response, issue_auth_tokens, clear_auth_cookies
```

Add to end of `views.py`:

```python
class LogoutView(APIView):
    """
    POST /api/v1/auth/logout

    Revoke refresh token and clear authentication cookies.
    Always succeeds - gracefully handles missing/invalid/expired tokens.
    """

    def post(self, request):
        # Try to revoke token if present and valid
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                payload = decode_token(refresh_token)
                if payload.get('token_type') == 'refresh':
                    token_id = payload.get('token_id')
                    if token_id:
                        RefreshToken.objects.filter(id=token_id).update(is_revoked=True)
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                # Token invalid/expired - still proceed with logout
                pass

        # Always return success and clear cookies
        response = success_response(
            data={'message': 'Successfully logged out'},
            status=200
        )
        response = clear_auth_cookies(response)

        return response
```

**Step 2: Run tests to verify they pass**

Run: `docker compose run --rm auth-service python -m pytest tests/test_views.py::TestLogoutView -v`

Expected: All 10 tests still FAIL (URL not registered yet)

**Step 3: Commit view**

```bash
git add srcs/auth-service/apps/authentication/views.py
git commit -m "feat(auth-service): implement LogoutView"
```

---

## Task 4: Add URL Pattern

**Files:**
- Modify: `srcs/auth-service/apps/authentication/urls.py`

**Step 1: Update imports and add URL pattern**

Update `urls.py`:

```python
"""
URL configuration for authentication app
"""
from django.urls import path
from apps.authentication.views import LoginView, RegisterView, RefreshView, LogoutView

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('refresh', RefreshView.as_view(), name='refresh'),
    path('logout', LogoutView.as_view(), name='logout'),
]
```

**Step 2: Run tests to verify they pass**

Run: `docker compose run --rm auth-service python -m pytest tests/test_views.py::TestLogoutView -v`

Expected: All 10 tests PASS

**Step 3: Commit URL pattern**

```bash
git add srcs/auth-service/apps/authentication/urls.py
git commit -m "feat(auth-service): add logout URL pattern"
```

---

## Task 5: Run Full Test Suite

**Step 1: Run all auth-service tests**

Run: `docker compose run --rm auth-service python -m pytest tests/ -v`

Expected: All 78 tests PASS (68 existing + 10 new logout tests)

**Step 2: Final commit with test verification**

```bash
git add -A
git commit -m "feat(auth-service): complete logout endpoint implementation

- POST /api/v1/auth/logout revokes refresh token and clears cookies
- Gracefully handles missing, invalid, expired, or revoked tokens
- 10 new tests, 78 total tests passing"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Write logout tests | 10 tests |
| 2 | Add clear_auth_cookies helper | - |
| 3 | Implement LogoutView | - |
| 4 | Add URL pattern | - |
| 5 | Run full test suite | 78 total |

**Total new tests:** 10
**Expected final test count:** 78
