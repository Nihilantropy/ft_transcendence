import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint_returns_200():
    """Test that health endpoint returns 200 OK"""
    response = client.get("/health")
    assert response.status_code == 200

def test_health_endpoint_returns_correct_structure():
    """Test that health endpoint returns expected JSON structure"""
    response = client.get("/health")
    data = response.json()

    assert "status" in data
    assert "service" in data
    assert "timestamp" in data
    assert data["status"] == "healthy"
    assert data["service"] == "api-gateway"
