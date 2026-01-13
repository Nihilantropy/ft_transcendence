import pytest
import os
from config import Settings

def test_settings_load_from_env():
    """Test that settings load from environment variables"""
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"
    os.environ["JWT_ALGORITHM"] = "HS256"
    os.environ["AUTH_SERVICE_URL"] = "http://auth:3001"

    settings = Settings()

    assert settings.JWT_SECRET_KEY == "test-secret-key"
    assert settings.JWT_ALGORITHM == "HS256"
    assert settings.AUTH_SERVICE_URL == "http://auth:3001"

def test_settings_has_required_fields():
    """Test that settings has all required configuration fields"""
    settings = Settings()

    assert hasattr(settings, "JWT_SECRET_KEY")
    assert hasattr(settings, "JWT_ALGORITHM")
    assert hasattr(settings, "AUTH_SERVICE_URL")
    assert hasattr(settings, "USER_SERVICE_URL")
    assert hasattr(settings, "AI_SERVICE_URL")
    assert hasattr(settings, "REDIS_URL")
    assert hasattr(settings, "RATE_LIMIT_PER_MINUTE")
