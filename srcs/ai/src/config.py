from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Service configuration using Pydantic settings."""

    # Service
    SERVICE_NAME: str = "ai-service"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # Ollama
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen3-vl:8b"
    OLLAMA_TIMEOUT: int = 60
    OLLAMA_TEMPERATURE: float = 0.1

    # Image Processing
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_IMAGE_DIMENSION: int = 1024
    MIN_IMAGE_DIMENSION: int = 224
    SUPPORTED_FORMATS: List[str] = ["jpeg", "jpg", "png", "webp"]

    # Vision Analysis
    LOW_CONFIDENCE_THRESHOLD: float = 0.5

    # RAG - ChromaDB
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "pet_knowledge"

    # RAG - Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG - Document Processing
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # RAG - Query
    RAG_TOP_K: int = 5
    RAG_MIN_RELEVANCE: float = 0.3

    # RAG - Knowledge Base
    KNOWLEDGE_BASE_DIR: str = "./data/knowledge_base"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
