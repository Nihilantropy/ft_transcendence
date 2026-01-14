import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app
from jose import jwt
from datetime import datetime, timedelta
from httpx import Response

client = TestClient(app)

TEST_SECRET = "your-secret-key-here-change-in-production"
TEST_ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str = "user"):
    """Helper to create test JWT tokens"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

@pytest.mark.integration
def test_full_authenticated_request_flow():
    """
    Test complete flow: authentication → routing → backend response
    """
    # Create valid JWT token
    token = create_test_token("user123", "user")

    # Mock backend service response
    mock_backend_response = Response(
        200,
        json={
            "success": True,
            "data": {"pets": [{"name": "Buddy", "breed": "Golden Retriever"}]},
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_backend_response)) as mock_request:
        # Make authenticated request
        response = client.get(
            "/api/v1/users/me/pets",
            cookies={"access_token": token}
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "pets" in data["data"]

        # Verify backend was called with correct headers
        assert mock_request.called
        call_kwargs = mock_request.call_args.kwargs
        headers = call_kwargs.get("headers", {})

        assert "X-User-ID" in headers
        assert headers["X-User-ID"] == "user123"
        assert "X-User-Role" in headers
        assert headers["X-User-Role"] == "user"
        assert "X-Request-ID" in headers

@pytest.mark.integration
def test_unauthenticated_request_to_protected_endpoint_fails():
    """
    Test that unauthenticated requests to protected endpoints fail
    """
    response = client.get("/api/v1/users/me/pets")

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"

@pytest.mark.integration
def test_public_endpoint_does_not_require_authentication():
    """
    Test that public endpoints (health, auth) don't require JWT
    """
    # Health endpoint
    response = client.get("/health")
    assert response.status_code == 200

    # Auth login endpoint (would forward to auth service)
    mock_response = Response(
        200,
        json={"success": True, "data": {"token": "new-token"}}
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        )
        assert response.status_code == 200

@pytest.mark.integration
def test_expired_token_is_rejected():
    """
    Test that expired JWT tokens are rejected
    """
    # Create expired token
    payload = {
        "user_id": "user123",
        "email": "test@example.com",
        "role": "user",
        "iat": datetime.utcnow() - timedelta(hours=2),
        "exp": datetime.utcnow() - timedelta(hours=1)
    }
    expired_token = jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

    response = client.get(
        "/api/v1/users/me",
        cookies={"access_token": expired_token}
    )

    assert response.status_code == 401
    data = response.json()
    assert "expired" in data["error"]["message"].lower()
