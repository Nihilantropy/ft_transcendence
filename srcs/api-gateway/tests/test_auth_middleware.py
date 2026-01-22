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

client = TestClient(app)

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30):
    """Helper to create test JWT tokens signed with RS256"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
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
