import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from main import app
from jose import jwt
from datetime import datetime, timedelta
from httpx import Response

client = TestClient(app)

# Test configuration
TEST_SECRET = "your-secret-key-here-change-in-production"  # Match .env
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

def test_rate_limit_blocks_requests_over_limit(mock_redis):
    """Test that requests over rate limit are blocked with 429"""
    with patch("middleware.rate_limit.redis_client", mock_redis):
        mock_redis.get.return_value = "61"  # Over limit of 60
        mock_redis.ttl.return_value = 45  # 45 seconds until reset

        response = client.get("/health")

        assert response.status_code == 429
        data = response.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
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
