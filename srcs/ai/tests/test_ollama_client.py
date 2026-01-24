import pytest
from unittest.mock import Mock, patch, AsyncMock
import json
from src.services.ollama_client import OllamaVisionClient
from src.config import Settings

@pytest.fixture
def settings():
    """Test settings."""
    return Settings()

@pytest.fixture
def ollama_client(settings):
    """Ollama client instance."""
    return OllamaVisionClient(settings)

@pytest.fixture
def mock_image_base64():
    """Mock image base64 data."""
    return "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

@pytest.fixture
def mock_ollama_response():
    """Mock successful Ollama response."""
    return {
        "breed": "Golden Retriever",
        "confidence": 0.92,
        "traits": {
            "size": "large",
            "energy_level": "high",
            "temperament": "friendly, intelligent"
        },
        "health_considerations": ["Hip dysplasia", "Cancer risk"]
    }

@pytest.fixture
def mock_low_confidence_response():
    """Mock low confidence Ollama response."""
    return {
        "breed": "Unknown",
        "confidence": 0.35,
        "traits": {
            "size": "medium",
            "energy_level": "medium",
            "temperament": "unknown"
        },
        "health_considerations": []
    }

class TestOllamaClient:
    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_successful_analysis(self, mock_post, ollama_client,
                                      mock_image_base64, mock_ollama_response):
        """Test successful breed analysis."""
        # Mock httpx response
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": json.dumps(mock_ollama_response)
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Golden Retriever"
        assert result["confidence"] == 0.92
        assert result["traits"]["size"] == "large"
        assert "Hip dysplasia" in result["health_considerations"]
        assert "note" not in result  # High confidence, no note

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_low_confidence_adds_note(self, mock_post, ollama_client,
                                           mock_image_base64, mock_low_confidence_response):
        """Test low confidence analysis adds warning note."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": json.dumps(mock_low_confidence_response)
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Unknown"
        assert result["confidence"] == 0.35
        assert result["note"] == "Low confidence - manual verification recommended"

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_parse_json_from_markdown(self, mock_post, ollama_client,
                                           mock_image_base64, mock_ollama_response):
        """Test parsing JSON from markdown code blocks."""
        # Response wrapped in markdown
        markdown_response = f"```json\n{json.dumps(mock_ollama_response)}\n```"

        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": markdown_response
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Golden Retriever"

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_invalid_json_raises_error(self, mock_post, ollama_client,
                                            mock_image_base64):
        """Test invalid JSON response raises error."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": "This is not JSON"
            }
        }
        mock_post.return_value = mock_response

        with pytest.raises(ValueError, match="Failed to parse JSON"):
            await ollama_client.analyze_breed(mock_image_base64)

    def test_build_analysis_prompt(self, ollama_client):
        """Test prompt building."""
        prompt = ollama_client._build_analysis_prompt()

        assert "Analyze this pet image" in prompt
        assert "breed" in prompt.lower()
        assert "JSON" in prompt
        assert "confidence" in prompt
