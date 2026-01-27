import pytest
from src.config import Settings

def test_settings_defaults():
    """Test default configuration values."""
    settings = Settings()

    assert settings.SERVICE_NAME == "ai-service"
    assert settings.OLLAMA_BASE_URL == "http://ollama:11434"
    assert settings.OLLAMA_MODEL == "qwen3-vl:8b"
    assert settings.OLLAMA_TIMEOUT == 300  # Increased for complex crossbreed detection
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


def test_rag_settings_defaults():
    """Test RAG configuration has expected defaults."""
    settings = Settings()

    # ChromaDB settings
    assert settings.CHROMA_PERSIST_DIR == "./data/chroma"
    assert settings.CHROMA_COLLECTION_NAME == "pet_knowledge"

    # Embeddings settings
    assert settings.EMBEDDING_MODEL == "all-MiniLM-L6-v2"
    assert settings.EMBEDDING_DIMENSION == 384

    # Document processing settings
    assert settings.CHUNK_SIZE == 500
    assert settings.CHUNK_OVERLAP == 50

    # RAG query settings
    assert settings.RAG_TOP_K == 5
    assert settings.RAG_MIN_RELEVANCE == 0.3

    # Knowledge base path
    assert settings.KNOWLEDGE_BASE_DIR == "./data/knowledge_base"
