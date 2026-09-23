from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

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
        case_sensitive=True,
        # pydantic-settings defaults to extra="forbid", and a dotenv FILE (unlike
        # the process environment, whose unknown names are ignored) is read key by
        # key — so a single stale line in .env aborts startup. The Dockerfile's
        # `COPY . .` bakes this service's .env into the image, and .env is
        # gitignored, so every developer keeps their own copy: dropping a setting
        # here would otherwise break each of them at the next build.
        extra="ignore",
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
