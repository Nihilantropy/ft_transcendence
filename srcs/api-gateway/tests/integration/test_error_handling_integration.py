"""
Integration tests for error handling across API Gateway and backend services.

These tests verify that 404 errors from backend services are properly
handled and normalized by the API Gateway.

Requirements:
- auth-service must be running
- user-service must be running
- Database must be accessible
"""
import pytest
import requests
import time
import os

# Use Docker service name when running in container, localhost for local testing
BASE_URL = os.getenv("API_GATEWAY_URL", "http://api-gateway:8001")


@pytest.fixture(scope="module")
def authenticated_session():
    """Create an authenticated session for testing"""
    session = requests.Session()
    
    # Register test user
    email = f"test_404_{int(time.time())}@example.com"
    register_resp = session.post(
        f"{BASE_URL}/api/v1/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "password_confirm": "TestPass123!"
        }
    )
    
    if register_resp.status_code != 201:
        # User might already exist, try login
        pass
    
    # Login
    login_resp = session.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": email, "password": "TestPass123!"}
    )
    
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    
    yield session
    
    # Cleanup: logout
    session.post(f"{BASE_URL}/api/v1/auth/logout")


@pytest.mark.integration
class TestAuthService404Handling:
    """Test 404 handling for auth service endpoints"""
    
    def test_nonexistent_auth_endpoint(self, authenticated_session):
        """Test 404 on non-existent auth service endpoint"""
        response = authenticated_session.get(f"{BASE_URL}/api/v1/auth/nonexisting")
        
        assert response.status_code == 404
        assert response.headers.get("content-type") == "application/json"
        
        data = response.json()
        assert data["success"] is False
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"
    
    def test_nested_nonexistent_auth_endpoint(self, authenticated_session):
        """Test 404 on deeply nested non-existent auth endpoint"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/v1/auth/deep/nested/nonexistent"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.integration
class TestUserService404Handling:
    """Test 404 handling for user service endpoints"""
    
    def test_nonexistent_user_endpoint(self, authenticated_session):
        """Test 404 on non-existent user service endpoint"""
        response = authenticated_session.get(f"{BASE_URL}/api/v1/users/nonexisting")
        
        assert response.status_code == 404
        assert "application/json" in response.headers.get("content-type", "")
        
        data = response.json()
        assert data["success"] is False
    
    def test_invalid_uuid_pet(self, authenticated_session):
        """Test 404 for invalid UUID on pets endpoint"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/v1/pets/invalid-uuid-123"
        )
        
        # Should be converted from 500/404 HTML to JSON 404
        assert response.status_code == 404
        assert "application/json" in response.headers.get("content-type", "")
        
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
    
    def test_nonexistent_uuid_pet(self, authenticated_session):
        """Test 404 for non-existent but valid UUID format"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/v1/pets/00000000-0000-0000-0000-000000000000"
        )
        
        assert response.status_code == 404
        assert "application/json" in response.headers.get("content-type", "")
        
        data = response.json()
        assert data["success"] is False


@pytest.mark.integration
class TestCrossService404Consistency:
    """Test that 404 responses are consistent across all services"""
    
    def test_all_services_return_json_404(self, authenticated_session):
        """Verify all services return JSON 404, not HTML"""
        endpoints = [
            "/api/v1/auth/nonexistent",
            "/api/v1/users/nonexistent",
            "/api/v1/pets/nonexistent",
        ]
        
        for endpoint in endpoints:
            response = authenticated_session.get(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 404, f"{endpoint} did not return 404"
            assert "application/json" in response.headers.get("content-type", ""), \
                f"{endpoint} returned HTML, not JSON"
            
            data = response.json()
            assert "success" in data, f"{endpoint} missing 'success' field"
            assert data["success"] is False, f"{endpoint} success should be False"
            assert "error" in data, f"{endpoint} missing 'error' field"
