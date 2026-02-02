from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # JWT Configuration (RS256 Asymmetric)
    JWT_PUBLIC_KEY_PATH: str
    JWT_ALGORITHM: str = "RS256"

    # Backend Service URLs
    AUTH_SERVICE_URL: str
    USER_SERVICE_URL: str
    AI_SERVICE_URL: str
    RECOMMENDATION_SERVICE_URL: str

    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    def load_jwt_public_key(self) -> str:
        """Load RSA public key from filesystem for JWT verification"""
        key_path = Path(self.JWT_PUBLIC_KEY_PATH)
        if not key_path.exists():
            raise FileNotFoundError(f"JWT public key not found at {key_path}")
        return key_path.read_text()

# Global settings instance
settings = Settings()

# Load public key at startup
JWT_PUBLIC_KEY = settings.load_jwt_public_key()
