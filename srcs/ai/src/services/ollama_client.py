import httpx
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OllamaVisionClient:
    """Client for Ollama vision analysis using native HTTP API."""

    def __init__(self, config):
        """Initialize Ollama client with configuration.

        Args:
            config: Settings instance with Ollama configuration
        """
        self.base_url = config.OLLAMA_BASE_URL
        self.model = config.OLLAMA_MODEL
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.low_confidence_threshold = config.LOW_CONFIDENCE_THRESHOLD
        logger.info(f"Initialized Ollama client: {self.base_url}, model: {self.model}")

    async def analyze_breed(self, image_base64: str) -> Dict[str, Any]:
        """Analyze pet breed from base64 image.

        Args:
            image_base64: Base64-encoded image data URI

        Returns:
            Dict with breed, confidence, traits, health_considerations

        Raises:
            ValueError: If response cannot be parsed
            ConnectionError: If Ollama is unreachable
        """
        try:
            # Extract just the base64 part (remove data URI prefix)
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            # Build structured prompt
            prompt = self._build_analysis_prompt()

            logger.info("Sending image to Ollama for analysis")

            # Call Ollama HTTP API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": [image_base64]
                            }
                        ],
                        "stream": False,
                        "options": {
                            "temperature": self.temperature
                        }
                    }
                )

                response.raise_for_status()
                response_data = response.json()

            # Extract content from response
            content = response_data.get("message", {}).get("content", "")

            # Parse JSON response
            result = self._parse_response(content)

            # Add note if low confidence
            if result["confidence"] < self.low_confidence_threshold:
                result["note"] = "Low confidence - manual verification recommended"
                logger.warning(f"Low confidence result: {result['confidence']}")
            else:
                logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

            return result

        except httpx.HTTPError as e:
            logger.error(f"Ollama connection failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
        except Exception as e:
            logger.error(f"Ollama analysis failed: {str(e)}")
            raise

    def _build_analysis_prompt(self) -> str:
        """Build structured prompt for breed analysis.

        Returns:
            Prompt string for Ollama
        """
        return """Analyze this pet image and identify the breed.
Return ONLY valid JSON in this exact format:
{
  "breed": "breed name or Unknown",
  "confidence": 0.0-1.0,
  "traits": {
    "size": "small/medium/large",
    "energy_level": "low/medium/high",
    "temperament": "brief description"
  },
  "health_considerations": ["condition1", "condition2"]
}"""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON from model response.

        Args:
            response_text: Raw response text from Ollama

        Returns:
            Parsed JSON dict

        Raises:
            ValueError: If JSON cannot be parsed
        """
        try:
            # Try direct JSON parse
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Extract JSON from markdown code blocks if present
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end > start:
                    json_str = response_text[start:end].strip()
                    return json.loads(json_str)

            logger.error(f"Failed to parse response: {response_text[:200]}")
            raise ValueError("Failed to parse JSON from response")

    async def generate(self, prompt: str) -> str:
        """Generate text response from prompt (no image).

        Args:
            prompt: Text prompt for generation

        Returns:
            Generated text response

        Raises:
            ConnectionError: If Ollama is unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "options": {"temperature": self.temperature}
                    }
                )
                response.raise_for_status()
                response_data = response.json()

            return response_data.get("message", {}).get("content", "")

        except httpx.HTTPError as e:
            logger.error(f"Ollama generation failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
