from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Service configuration using Pydantic settings."""

    # Service
    SERVICE_NAME: str = "ai-service"
    LOG_LEVEL: str = "info"

    # LLM inference (via LiteLLM proxy — OpenAI-compatible endpoint)
    LLM_BASE_URL: str = "http://litellm:4000/v1"
    LLM_API_KEY: str = "sk-smartbreeds-local"  # must match LiteLLM LITELLM_MASTER_KEY
    LLM_VISION_MODEL: str = "vision-model"     # or vision-model-cloud (Mistral/Pixtral)
    LLM_TEXT_MODEL: str = "text-model"         # or text-model-cloud
    LLM_TIMEOUT: int = 300  # Ollama crossbreed detection can take 120-180s; cloud is faster
    LLM_TEMPERATURE: float = 0.1

    # Classification Service (HF models, GPU). Disable in cloud/no-GPU profile:
    # the vision LLM then handles species/breed detection (NSFW filter is NOT applied).
    CLASSIFICATION_ENABLED: bool = True
    CLASSIFICATION_SERVICE_URL: str = "http://classification-service:3004"
    CLASSIFICATION_TIMEOUT: int = 30

    # Image Processing
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_IMAGE_DIMENSION: int = 1024
    MIN_IMAGE_DIMENSION: int = 224
    SUPPORTED_FORMATS: List[str] = ["jpeg", "jpg", "png", "webp"]

    # Vision Analysis Thresholds
    LOW_CONFIDENCE_THRESHOLD: float = 0.5
    SPECIES_MIN_CONFIDENCE: float = 0.10  # Minimum confidence for species detection
    BREED_MIN_CONFIDENCE: float = 0.05  # Minimum confidence for breed detection (lowered for crossbreeds)

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

    # RAG - Knowledge Base
    KNOWLEDGE_BASE_DIR: str = "./data/knowledge_base"

    class Config:
        env_file = ".env"
        case_sensitive = False
