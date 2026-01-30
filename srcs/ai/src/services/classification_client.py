import httpx
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class ClassificationClient:
    """HTTP client for classification service."""

    def __init__(self, config):
        """Initialize classification client.

        Args:
            config: Settings instance with classification service config
        """
        self.base_url = config.CLASSIFICATION_SERVICE_URL
        self.timeout = config.CLASSIFICATION_TIMEOUT

        logger.info(f"ClassificationClient initialized: {self.base_url}")

    async def check_content(self, image: str) -> Dict[str, Any]:
        """Check image content safety (NSFW detection).

        Args:
            image: Base64-encoded image

        Returns:
            Dict with is_safe, nsfw_probability, threshold

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/content",
                    json={"image": image}
                )
                logger.debug(f"Content check response: {response.json()}")
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")

    async def detect_species(self, image: str, top_k: int = 3) -> Dict[str, Any]:
        """Detect animal species from image.

        Args:
            image: Base64-encoded image
            top_k: Number of top predictions

        Returns:
            Dict with species, confidence, top_predictions

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/species",
                    json={"image": image, "top_k": top_k}
                )
                logger.debug(f"Species detection response: {response.json()}")
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")

    async def detect_breed(
        self,
        image: str,
        species: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Detect breed from image (dog or cat).

        Args:
            image: Base64-encoded image
            species: Species (dog or cat)
            top_k: Number of top predictions

        Returns:
            Dict with breed_analysis

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/breed",
                    json={
                        "image": image,
                        "species": species,
                        "top_k": top_k
                    }
                )
                logger.debug(f"Breed detection response: {response.json()}")
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")
