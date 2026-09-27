import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from middleware.auth_middleware import JWTAuthMiddleware
from jose import jwt
from datetime import datetime, timedelta
from conftest import TEST_PRIVATE_KEY_PEM, TEST_PUBLIC_KEY_PEM

app = FastAPI()

# Test configuration - RS256
TEST_ALGORITHM = "RS256"

# Add middleware with public key
app.add_middleware(JWTAuthMiddleware, public_key=TEST_PUBLIC_KEY_PEM, algorithm=TEST_ALGORITHM)

@app.get("/protected")
async def protected_route():
    return {"message": "success"}

@app.get("/health")
async def health_route():
    return {"status": "healthy"}

@app.post("/api/v1/auth/login/2fa")
async def two_factor_login_route():
    return {"message": "reached"}

client = TestClient(app)

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30, token_type: str = "access"):
    """Helper to create test JWT tokens signed with RS256"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "token_type": token_type,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm=TEST_ALGORITHM)

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


# --- token_type enforcement (ROADMAP GW-01) -------------------------------------------
# The auth-service signs several JWT kinds with the same key: access, refresh and the
# short-lived two-factor challenge ("mfa"). Only an access token may authenticate a request,
# otherwise a refresh token would live 7 days as a session and the 2FA challenge token
# (issued after the password step alone) would bypass the second factor.

@pytest.mark.parametrize("token_type", ["refresh", "mfa", "", "ACCESS"])
def test_non_access_token_type_is_rejected(token_type):
    """Only token_type == 'access' authenticates a request"""
    token = create_test_token("user123", token_type=token_type)

    response = client.get("/protected", cookies={"access_token": token})

    assert response.status_code == 401
    assert "token type" in response.json()["error"]["message"].lower()

def test_token_without_token_type_claim_is_rejected():
    """A signed token that carries no token_type claim at all is not an access token"""
    payload = {
        "user_id": "user123",
        "email": "test@example.com",
        "role": "user",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=30),
    }
    token = jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm=TEST_ALGORITHM)

    response = client.get("/protected", cookies={"access_token": token})

    assert response.status_code == 401

@pytest.mark.parametrize("user_id", ["", None])
def test_access_token_without_user_id_is_rejected(user_id):
    """An empty/missing user_id must not reach backends as an empty X-User-ID header"""
    payload = {
        "email": "test@example.com",
        "role": "user",
        "token_type": "access",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=30),
    }
    if user_id is not None:
        payload["user_id"] = user_id
    token = jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm=TEST_ALGORITHM)

    response = client.get("/protected", cookies={"access_token": token})

    assert response.status_code == 401

def test_two_factor_login_endpoint_is_public():
    """POST /api/v1/auth/login/2fa is the second login step: the caller has no cookie yet"""
    response = client.post("/api/v1/auth/login/2fa")

    assert response.status_code == 200
    assert response.json() == {"message": "reached"}
