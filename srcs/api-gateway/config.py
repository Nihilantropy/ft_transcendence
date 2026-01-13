from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # JWT Configuration
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    # Backend Service URLs
    AUTH_SERVICE_URL: str
    USER_SERVICE_URL: str
    AI_SERVICE_URL: str

    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

# Global settings instance
settings = Settings()
