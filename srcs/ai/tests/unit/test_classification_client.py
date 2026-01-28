import pytest
from unittest.mock import AsyncMock, patch
import httpx

from src.services.classification_client import ClassificationClient
from src.config import Settings


@pytest.fixture
def client():
    """Create classification client with test config."""
    settings = Settings(
        CLASSIFICATION_SERVICE_URL="http://test-classification:3004",
        CLASSIFICATION_TIMEOUT=30
    )
    return ClassificationClient(settings)


@pytest.mark.asyncio
async def test_check_content_safe(client):
    """Test content safety check with safe image."""
    mock_response = {
        "is_safe": True,
        "nsfw_probability": 0.1,
        "threshold": 0.7
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.check_content("data:image/jpeg;base64,test123")

        assert result["is_safe"] is True
        assert result["nsfw_probability"] == 0.1


@pytest.mark.asyncio
async def test_detect_species(client):
    """Test species detection."""
    mock_response = {
        "species": "dog",
        "confidence": 0.87,
        "top_predictions": [
            {"label": "dog", "confidence": 0.87}
        ]
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.detect_species("data:image/jpeg;base64,test123")

        assert result["species"] == "dog"
        assert result["confidence"] == 0.87


@pytest.mark.asyncio
async def test_detect_breed(client):
    """Test breed detection."""
    mock_response = {
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False,
            "breed_probabilities": [
                {"breed": "golden_retriever", "probability": 0.89}
            ],
            "crossbreed_analysis": None
        }
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.detect_breed("data:image/jpeg;base64,test123", "dog", top_k=5)

        assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
        assert result["breed_analysis"]["is_likely_crossbreed"] is False


@pytest.mark.asyncio
async def test_connection_error_handling(client):
    """Test connection error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.ConnectError("Connection failed")):
        with pytest.raises(ConnectionError, match="Classification service unavailable"):
            await client.check_content("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_timeout_handling(client):
    """Test timeout error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.TimeoutException("Timeout")):
        with pytest.raises(ConnectionError, match="Classification service timeout"):
            await client.check_content("data:image/jpeg;base64,test123")
