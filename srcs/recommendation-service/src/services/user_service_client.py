"""HTTP client for user-service integration."""
import httpx
from typing import Optional, Dict, Any
from src.config import settings


class UserServiceClient:
    """Client for fetching pet profiles from user-service."""

    def __init__(self, base_url: str = None, timeout: float = 10.0):
        """
        Initialize user service client.

        Args:
            base_url: User service base URL (defaults to config.USER_SERVICE_URL)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or settings.USER_SERVICE_URL
        self.timeout = timeout

    async def get_pet_profile(
        self, pet_id: int, user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch pet profile from user-service.

        Args:
            pet_id: Pet ID to fetch
            user_id: User ID for authentication (passed as X-User-ID header)

        Returns:
            Pet profile data dictionary, or None if not found/error
        """
        url = f"{self.base_url}/api/v1/pets/{pet_id}"
        headers = {"X-User-ID": str(user_id)}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return data.get("data")

                # 404 or other errors
                return None

        except (httpx.TimeoutException, TimeoutError):
            # Log timeout (in production, use proper logging)
            return None
        except Exception:
            # Log error (in production, use proper logging)
            return None
