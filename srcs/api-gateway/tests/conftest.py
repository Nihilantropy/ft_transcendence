import pytest
import os

# Set test environment variables to match other tests
os.environ["JWT_SECRET_KEY"] = "your-secret-key-here-change-in-production"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["AUTH_SERVICE_URL"] = "http://auth-service-test:3001"
os.environ["USER_SERVICE_URL"] = "http://user-service-test:3002"
os.environ["AI_SERVICE_URL"] = "http://ai-service-test:3003"
os.environ["REDIS_URL"] = "redis://redis-test:6379/0"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100"

@pytest.fixture
def test_settings():
    """Provide test settings"""
    from config import settings
    return settings
