import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_cors_allows_frontend_origin():
    """Test that CORS allows requests from frontend origin"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers

def test_cors_includes_credentials():
    """Test that CORS allows credentials (cookies)"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )

    assert "access-control-allow-credentials" in response.headers
    assert response.headers["access-control-allow-credentials"] == "true"

def test_cors_allows_required_headers():
    """Test that CORS allows required request headers"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )

    assert "access-control-allow-headers" in response.headers
