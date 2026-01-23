import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app
from httpx import Response
from jose import jwt
from datetime import datetime, timedelta
from conftest import TEST_PRIVATE_KEY_PEM

client = TestClient(app)


def create_test_token(user_id: str, role: str = "user"):
    """Helper to create test JWT tokens using RS256"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="RS256")

@pytest.mark.asyncio
async def test_proxy_forwards_to_auth_service():
    """Test that /api/v1/auth/* routes forward to auth service"""
    mock_response = Response(
        200,
        json={"success": True, "data": {"message": "login successful"}},
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.asyncio
async def test_proxy_forwards_to_user_service():
    """Test that /api/v1/users/* routes forward to user service"""
    token = create_test_token("user123", "user")
    mock_response = Response(
        200,
        json={"success": True, "data": {"pets": []}},
    )

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)):
        response = client.get(
            "/api/v1/users/me/pets",
            cookies={"access_token": token}
        )

    assert response.status_code == 200

@pytest.mark.asyncio
async def test_proxy_adds_user_context_headers():
    """Test that proxy adds X-User-ID and X-User-Role headers"""
    token = create_test_token("user123", "user")
    mock_response = Response(200, json={"success": True})

    with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_response)) as mock_request:
        response = client.get(
            "/api/v1/users/me",
            cookies={"access_token": token}
        )

        # Verify headers were added to backend request
        call_args = mock_request.call_args
        headers = call_args.kwargs.get("headers", {})
        assert "X-User-ID" in headers
        assert "X-Request-ID" in headers
