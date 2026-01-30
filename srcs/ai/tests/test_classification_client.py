import pytest
from unittest.mock import AsyncMock, Mock, patch
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

    mock_http_response = Mock()  # Regular Mock, not AsyncMock
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.classification_client.httpx.AsyncClient', return_value=mock_async_client):
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

    mock_http_response = Mock()  # Regular Mock, not AsyncMock
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.classification_client.httpx.AsyncClient', return_value=mock_async_client):
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

    mock_http_response = Mock()  # Regular Mock, not AsyncMock
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.classification_client.httpx.AsyncClient', return_value=mock_async_client):
        result = await client.detect_breed("data:image/jpeg;base64,test123", "dog", top_k=5)

        assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
        assert result["breed_analysis"]["is_likely_crossbreed"] is False


@pytest.mark.asyncio
async def test_connection_error_handling(client):
    """Test connection error handling."""
    async def raise_connect_error(*args, **kwargs):
        raise httpx.ConnectError("Connection failed")

    mock_async_client = AsyncMock()
    mock_async_client.post = raise_connect_error  # Use async function directly
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.classification_client.httpx.AsyncClient', return_value=mock_async_client):
        with pytest.raises(ConnectionError, match="Classification service unavailable"):
            await client.check_content("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_timeout_handling(client):
    """Test timeout error handling."""
    async def raise_timeout(*args, **kwargs):
        raise httpx.TimeoutException("Timeout")

    mock_async_client = AsyncMock()
    mock_async_client.post = raise_timeout  # Use async function directly
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.classification_client.httpx.AsyncClient', return_value=mock_async_client):
        with pytest.raises(ConnectionError, match="Classification service timeout"):
            await client.check_content("data:image/jpeg;base64,test123")
