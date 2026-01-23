# API Gateway Test Failure Report

**Date:** 2026-01-23
**Test Command:** `docker compose run --rm api-gateway python -m pytest tests/ -v`
**Initial Results:** 27 passed, 5 failed (84% pass rate)
**Final Results:** 32 passed, 0 failed (100% pass rate) ✅ FIXED

---

## Executive Summary

All 5 test failures share a **common root cause**: test files are creating JWT tokens using **HS256 symmetric encryption** with a hardcoded secret, while the API Gateway is configured for **RS256 asymmetric encryption** using RSA keys.

The `conftest.py` correctly generates RSA key pairs and sets up the environment for RS256, but the failing test files define their own `create_test_token()` helper that bypasses this setup.

---

## Test Results Overview

| Status | Count | Percentage |
|--------|-------|------------|
| Passed | 27 | 84% |
| Failed | 5 | 16% |
| **Total** | **32** | 100% |

---

## Failing Tests Analysis

### 1. `test_error_handling.py::test_404_returns_standardized_error`

**Expected:** 404 Not Found
**Actual:** 401 Unauthorized

**Root Cause:**
```python
# test_error_handling.py:9-21
TEST_SECRET = "your-secret-key-here-change-in-production"
TEST_ALGORITHM = "HS256"  # ← WRONG: Gateway uses RS256

def create_test_token(user_id: str, role: str = "user"):
    payload = {...}
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)
```

The test creates an HS256 token, but the API Gateway validates using RS256 with the RSA public key. Token validation fails before the route is reached, returning 401 instead of 404.

---

### 2. `test_logging.py::test_logging_includes_user_context`

**Expected:** Log message containing "user123"
**Actual:** No log message with user_id found

**Root Cause:**
Same HS256/RS256 mismatch (lines 40-49). Authentication fails, so user context is never extracted and logged.

**Flow:**
1. Test creates HS256 token
2. Auth middleware tries RS256 validation → fails
3. Request rejected with 401
4. User context never set, "user123" never logged

---

### 3. `test_proxy.py::test_proxy_forwards_to_user_service`

**Expected:** 200 OK with proxied response
**Actual:** 401 Unauthorized

**Root Cause:**
```python
# test_proxy.py:12-24
TEST_SECRET = "your-secret-key-here-change-in-production"
TEST_ALGORITHM = "HS256"  # ← WRONG
```

Authentication fails before the proxy logic executes. The mock on `httpx_client.request` is never called.

---

### 4. `test_proxy.py::test_proxy_adds_user_context_headers`

**Expected:** `call_args.kwargs` contains X-User-ID header
**Actual:** `AttributeError: 'NoneType' object has no attribute 'kwargs'`

**Root Cause:**
Same HS256/RS256 mismatch. Since authentication fails:
1. Proxy route is never reached
2. `httpx_client.request` is never called
3. `mock_request.call_args` is `None`
4. Accessing `None.kwargs` raises AttributeError

---

### 5. `test_rate_limit.py::test_rate_limit_uses_user_id_when_authenticated`

**Expected:** Redis called with key pattern `rate_limit:user:user123`
**Actual:** Assertion failed - no such key pattern found

**Root Cause:**
```python
# test_rate_limit.py:12-24
TEST_SECRET = "your-secret-key-here-change-in-production"
TEST_ALGORITHM = "HS256"  # ← WRONG
```

Authentication fails, so:
1. User context is never extracted
2. Rate limiter falls back to IP-based key instead of user-based key
3. Redis is called with `rate_limit:ip:testclient` (or similar) instead of `rate_limit:user:user123`

---

## Root Cause Summary

**Configuration Mismatch:**

| Component | Algorithm | Key |
|-----------|-----------|-----|
| `conftest.py` | RS256 | Dynamic RSA key pair |
| `config.py` | RS256 | RSA public key from file |
| `test_error_handling.py` | HS256 | Hardcoded string |
| `test_logging.py` | HS256 | Hardcoded string |
| `test_proxy.py` | HS256 | Hardcoded string |
| `test_rate_limit.py` | HS256 | Hardcoded string |

The working tests (`test_auth_middleware.py`, `test_jwt_utils.py`, integration tests) properly use the `test_private_key` fixture from `conftest.py`.

---

## Recommended Fix

Update the failing test files to use the RS256 fixtures from `conftest.py`:

```python
# BEFORE (broken)
TEST_SECRET = "your-secret-key-here-change-in-production"
TEST_ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str = "user"):
    payload = {...}
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

# AFTER (fixed)
from conftest import TEST_PRIVATE_KEY_PEM

def create_test_token(user_id: str, role: str = "user"):
    payload = {...}
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="RS256")
```

Or better, use pytest fixtures:

```python
@pytest.fixture
def create_token(test_private_key, test_algorithm):
    def _create(user_id: str, role: str = "user"):
        payload = {
            "user_id": user_id,
            "email": "test@example.com",
            "role": role,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        return jwt.encode(payload, test_private_key, algorithm=test_algorithm)
    return _create
```

---

## Files Requiring Changes

1. `srcs/api-gateway/tests/test_error_handling.py` - Lines 9-21
2. `srcs/api-gateway/tests/test_logging.py` - Lines 40-49
3. `srcs/api-gateway/tests/test_proxy.py` - Lines 12-24
4. `srcs/api-gateway/tests/test_rate_limit.py` - Lines 12-24

---

## Impact Assessment

| Area | Impact |
|------|--------|
| Production Code | None - all issues are test-only |
| CI/CD | Pipeline failing if tests are gated |
| Security | None - RS256 correctly configured in production |
| Functionality | Verified by 27 passing tests including integration tests |

---

## Priority

**Medium** - The core functionality works correctly (proven by integration tests). This is a test maintenance issue, not a security or functionality bug.

---

## Resolution (Applied)

### Changes Made

1. **Updated test files to use RS256:**
   - `test_error_handling.py`: Import `TEST_PRIVATE_KEY_PEM` from conftest, use RS256
   - `test_logging.py`: Import `TEST_PRIVATE_KEY_PEM` from conftest, use RS256
   - `test_proxy.py`: Import `TEST_PRIVATE_KEY_PEM` from conftest, use RS256
   - `test_rate_limit.py`: Import `TEST_PRIVATE_KEY_PEM` from conftest, use RS256

2. **Added tests volume mount to docker-compose.yml:**
   ```yaml
   volumes:
     - ./srcs/api-gateway/tests:/app/tests:rw
   ```

### Verification

```
======================= 32 passed, 14 warnings in 1.11s ========================
```

All 32 tests now pass (previously 27 passed, 5 failed).
