from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Classification service configuration."""

    # Service
    SERVICE_NAME: str = "classification-service"
    SERVICE_PORT: int = 3004
    LOG_LEVEL: str = "INFO"

    # HuggingFace Models
    NSFW_MODEL: str = "Falconsai/nsfw_image_detection"
    SPECIES_MODEL: str = "dima806/animal_151_types_image_detection"
    DOG_BREED_MODEL: str = "wesleyacheng/dog-breeds-multiclass-image-classification-with-vit"
    CAT_BREED_MODEL: str = "dima806/cat_breed_image_detection"

    # Classification Thresholds
    NSFW_REJECTION_THRESHOLD: float = 0.70
    SPECIES_MIN_CONFIDENCE: float = 0.60
    BREED_MIN_CONFIDENCE: float = 0.40

    # Crossbreed Detection Thresholds
    CROSSBREED_PROBABILITY_THRESHOLD: float = 0.35
    PUREBRED_CONFIDENCE_THRESHOLD: float = 0.75
    PUREBRED_GAP_THRESHOLD: float = 0.30

    # HuggingFace
    TRANSFORMERS_CACHE: str = "/app/.cache/huggingface"
    HF_HOME: str = "/app/.cache/huggingface"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
