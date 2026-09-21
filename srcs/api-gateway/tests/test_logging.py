import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
import logging
from conftest import TEST_PRIVATE_KEY_PEM

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

    # Create test JWT token using RS256
    payload = {
        "user_id": "user123",
        "email": "test@example.com",
        "role": "user",
        "token_type": "access",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="RS256")

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


def _capture_emitted_lines(make_request):
    """Run make_request() while capturing what the logger actually writes to
    its stream, formatted exactly as it is in production."""
    import io
    from middleware.logging_middleware import JsonFormatter, logger as gateway_logger

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    gateway_logger.addHandler(handler)
    try:
        make_request()
    finally:
        gateway_logger.removeHandler(handler)
    return [line for line in stream.getvalue().splitlines() if line.strip()]


def test_emitted_log_lines_are_valid_flat_json():
    """Every emitted line must be a JSON object whose `message` is never a
    nested object.

    Logstash lifts the parsed line to the event root, and the Elasticsearch
    index template maps `message` as `text`. A nested object there is a mapping
    conflict: Elasticsearch rejects the document and Logstash drops it, so the
    log silently never reaches Kibana. Regression test for that bug.
    """
    import json

    lines = _capture_emitted_lines(lambda: client.get("/health"))
    assert lines, "the middleware emitted nothing"

    for line in lines:
        payload = json.loads(line)  # raises if the line is not valid JSON
        assert isinstance(payload, dict)
        assert not isinstance(payload.get("message"), (dict, list)), (
            f"`message` must stay a scalar for the ES mapping, got: {payload.get('message')!r}"
        )


def test_request_fields_are_logged_at_top_level():
    """The request fields must sit at the root of the JSON object, which is the
    shape srcs/elk/setup/index-template.json describes."""
    import json

    lines = _capture_emitted_lines(lambda: client.get("/health"))
    payloads = [json.loads(line) for line in lines]
    request_logs = [p for p in payloads if "request_id" in p]

    assert request_logs, "no request log was emitted"
    entry = request_logs[0]
    for field in ("method", "path", "status_code", "duration_ms", "timestamp", "level"):
        assert field in entry, f"missing top-level field: {field}"
    assert entry["method"] == "GET"
    assert entry["path"] == "/health"
    assert entry["status_code"] == 200


def test_plain_string_logs_are_still_valid_json():
    """Non-dict records (any third-party library logging through this handler)
    must not produce a broken line — the old format string emitted unquoted
    text, which was invalid JSON."""
    import json
    from middleware.logging_middleware import logger as gateway_logger

    lines = _capture_emitted_lines(
        lambda: gateway_logger.warning('plain text with "quotes" and a \\ backslash')
    )
    payload = json.loads(lines[0])
    assert payload["message"] == 'plain text with "quotes" and a \\ backslash'
    assert payload["level"] == "WARNING"
