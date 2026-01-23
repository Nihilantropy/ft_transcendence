import pytest
import os
from config import Settings
from conftest import TEST_PUBLIC_KEY_PATH

def test_settings_load_from_env():
    """Test that settings load from environment variables"""
    settings = Settings()

    assert settings.JWT_PUBLIC_KEY_PATH == TEST_PUBLIC_KEY_PATH
    assert settings.JWT_ALGORITHM == "RS256"

def test_settings_has_required_fields():
    """Test that settings has all required configuration fields"""
    settings = Settings()

    assert hasattr(settings, "JWT_PUBLIC_KEY_PATH")
    assert hasattr(settings, "JWT_ALGORITHM")
    assert hasattr(settings, "AUTH_SERVICE_URL")
    assert hasattr(settings, "USER_SERVICE_URL")
    assert hasattr(settings, "AI_SERVICE_URL")
    assert hasattr(settings, "REDIS_URL")
    assert hasattr(settings, "RATE_LIMIT_PER_MINUTE")

def test_load_jwt_public_key():
    """Test that JWT public key can be loaded from file"""
    settings = Settings()
    public_key = settings.load_jwt_public_key()

    assert public_key is not None
    assert "BEGIN PUBLIC KEY" in public_key
    assert "END PUBLIC KEY" in public_key
