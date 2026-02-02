import numpy as np
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application configuration from environment variables."""
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    DATABASE_URL: str
    USER_SERVICE_URL: str
    WEIGHT_HEALTH_CONDITIONS: float = 0.40
    WEIGHT_AGE_COMPATIBILITY: float = 0.20
    WEIGHT_NUTRITIONAL_PROFILE: float = 0.20
    WEIGHT_SIZE_COMPATIBILITY: float = 0.10
    WEIGHT_INGREDIENT_PREFERENCES: float = 0.10
    MIN_SIMILARITY_THRESHOLD: float = 0.3
    DEFAULT_RECOMMENDATION_LIMIT: int = 10
    MAX_RECOMMENDATION_LIMIT: int = 50
    LOG_LEVEL: str = "INFO"

settings = Settings()

WEIGHT_VECTOR = np.array([
    settings.WEIGHT_AGE_COMPATIBILITY,
    settings.WEIGHT_SIZE_COMPATIBILITY / 2,
    0.05,
    settings.WEIGHT_SIZE_COMPATIBILITY / 2,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 2,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 4,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 4,
    0.0
])

MIN_SIMILARITY_THRESHOLD = settings.MIN_SIMILARITY_THRESHOLD
DEFAULT_RECOMMENDATION_LIMIT = settings.DEFAULT_RECOMMENDATION_LIMIT
MAX_RECOMMENDATION_LIMIT = settings.MAX_RECOMMENDATION_LIMIT
