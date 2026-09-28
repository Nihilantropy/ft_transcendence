import numpy as np
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application configuration from environment variables."""
    # extra="ignore": pydantic-settings defaults to forbidding unknown keys, and
    # a dotenv file is read key by key, so one leftover line in .env aborts
    # startup. The whole service directory is bind-mounted at /app, so the
    # developer's own gitignored .env is what gets read — removing a setting here
    # must not break their checkout.
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    DATABASE_URL: str
    USER_SERVICE_URL: str
    WEIGHT_HEALTH_CONDITIONS: float = 0.40
    WEIGHT_AGE_COMPATIBILITY: float = 0.20
    WEIGHT_NUTRITIONAL_PROFILE: float = 0.20
    WEIGHT_SIZE_COMPATIBILITY: float = 0.10
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
