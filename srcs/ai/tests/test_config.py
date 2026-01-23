import pytest
from src.config import Settings

def test_settings_defaults():
    """Test default configuration values."""
    settings = Settings()

    assert settings.SERVICE_NAME == "ai-service"
    assert settings.OLLAMA_BASE_URL == "http://ollama:11434"
    assert settings.OLLAMA_MODEL == "qwen3-vl:8b"
    assert settings.OLLAMA_TIMEOUT == 60
    assert settings.OLLAMA_TEMPERATURE == 0.1
    assert settings.MAX_IMAGE_SIZE_MB == 5
    assert settings.MAX_IMAGE_DIMENSION == 1024
    assert settings.MIN_IMAGE_DIMENSION == 224
    assert settings.LOW_CONFIDENCE_THRESHOLD == 0.5
    assert "jpeg" in settings.SUPPORTED_FORMATS
    assert "png" in settings.SUPPORTED_FORMATS

def test_settings_from_env(monkeypatch):
    """Test configuration from environment variables."""
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://custom:11434")
    monkeypatch.setenv("MAX_IMAGE_SIZE_MB", "10")
    monkeypatch.setenv("LOW_CONFIDENCE_THRESHOLD", "0.6")

    settings = Settings()

    assert settings.OLLAMA_BASE_URL == "http://custom:11434"
    assert settings.MAX_IMAGE_SIZE_MB == 10
    assert settings.LOW_CONFIDENCE_THRESHOLD == 0.6
