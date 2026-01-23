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

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
