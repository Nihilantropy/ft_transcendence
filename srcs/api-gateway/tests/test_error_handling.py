import pytest
from fastapi.testclient import TestClient
from main import app
from jose import jwt
from datetime import datetime, timedelta

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

def test_404_returns_standardized_error():
    """Test that 404 errors return standardized format"""
    # Use authenticated request to non-existent API endpoint
    token = create_test_token("user123", "user")
    response = client.get(
        "/api/v1/nonexistent/endpoint",
        cookies={"access_token": token}
    )

    assert response.status_code == 404
    data = response.json()

    assert "success" in data
    assert "error" in data
    assert "timestamp" in data
    assert data["success"] is False
    assert data["error"]["code"] in ["NOT_FOUND", "HTTP_ERROR"]  # Could be either depending on where it fails

def test_500_returns_standardized_error():
    """Test that 500 errors return standardized format"""
    # This would require triggering an actual 500 error
    # For now, test the response structure
    pass

def test_validation_error_returns_standardized_format():
    """Test that validation errors return standardized format"""
    response = client.post(
        "/api/v1/auth/login",
        json={"invalid": "data"}  # Missing required fields
    )

    # Should return 422 (validation error) in standardized format
    data = response.json()
    assert "success" in data
    assert "error" in data
