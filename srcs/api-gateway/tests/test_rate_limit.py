import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from main import app
from jose import jwt
from datetime import datetime, timedelta
from httpx import Response
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

@pytest.fixture
def mock_redis():
    """Mock Redis client for testing"""
    mock = MagicMock()
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.incr.return_value = 1
    mock.ttl.return_value = 60  # Return integer for TTL
    return mock

def test_rate_limit_allows_requests_under_limit(mock_redis):
    """Test that requests under rate limit are allowed"""
    with patch("middleware.rate_limit.redis_client", mock_redis):
        mock_redis.get.return_value = "50"  # Under limit of 60

        response = client.get("/health")

        assert response.status_code == 200
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

def test_rate_limit_response_structure():
    """Test that rate limit exceeded responses have correct structure"""
    from middleware.rate_limit import RateLimitMiddleware

    # Create middleware instance
    middleware = RateLimitMiddleware(app, rate_limit_per_minute=60)

    # Call the private method that creates the rate limit response
    response = middleware._rate_limit_response("test:key")

    # Verify response structure
    assert response.status_code == 429
    data = response.body.decode()
    import json
    json_data = json.loads(data)

    assert json_data["success"] is False
    assert json_data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert "Retry-After" in response.headers
    assert response.headers["X-RateLimit-Remaining"] == "0"

def test_rate_limit_uses_user_id_when_authenticated(mock_redis):
    """Test that rate limiting uses user_id for authenticated requests"""
    token = create_test_token("user123", "user")

    with patch("middleware.rate_limit.redis_client", mock_redis):
        mock_redis.get.return_value = "10"  # Some count under limit

        # Mock backend response for the proxied request
        mock_backend_response = Response(200, json={"success": True, "data": {}})

        with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_backend_response)):
            response = client.get(
                "/api/v1/users/me",
                cookies={"access_token": token}
            )

        # Verify Redis was called with user-based key
        calls = [str(call) for call in mock_redis.get.call_args_list]
        assert any("rate_limit:user:user123" in str(call) for call in calls)
