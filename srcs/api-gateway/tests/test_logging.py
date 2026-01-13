import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
import logging

client = TestClient(app)

def test_logging_middleware_logs_requests(caplog):
    """Test that requests are logged with structured data"""
    with caplog.at_level(logging.INFO):
        response = client.get("/health")

    assert response.status_code == 200

    # Check that request was logged
    log_records = [record for record in caplog.records if "request_id" in record.message.lower() or "GET" in record.message]
    assert len(log_records) > 0

def test_logging_includes_request_duration():
    """Test that logs include request duration"""
    with patch("middleware.logging_middleware.logger") as mock_logger:
        response = client.get("/health")

        # Verify logger was called
        assert mock_logger.info.called

        # Check that duration is in the log message
        log_calls = [str(call) for call in mock_logger.info.call_args_list]
        assert any("duration" in str(call).lower() for call in log_calls)

def test_logging_includes_user_context(caplog):
    """Test that logs include user_id for authenticated requests"""
    from jose import jwt
    from datetime import datetime, timedelta
    from unittest.mock import AsyncMock
    from httpx import Response as HttpxResponse

    # Create test JWT token
    TEST_SECRET = "your-secret-key-here-change-in-production"
    TEST_ALGORITHM = "HS256"
    payload = {
        "user_id": "user123",
        "email": "test@example.com",
        "role": "user",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

    # Mock backend response
    mock_backend_response = HttpxResponse(200, json={"success": True, "data": {}})

    with caplog.at_level(logging.INFO):
        with patch("routes.proxy.httpx_client.request", new=AsyncMock(return_value=mock_backend_response)):
            response = client.get("/api/v1/users/me", cookies={"access_token": token})

    # Verify X-Request-ID header is present (proves logging middleware ran)
    assert "X-Request-ID" in response.headers

    # Check that user_id was logged
    log_messages = [record.message for record in caplog.records]
    assert any("user123" in msg for msg in log_messages)
