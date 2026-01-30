import pytest
from unittest.mock import AsyncMock, patch, Mock
import httpx

from src.services.ollama_client import OllamaVisionClient
from src.config import Settings


@pytest.fixture
def ollama_client():
    """Create Ollama client with test config."""
    settings = Settings(
        OLLAMA_BASE_URL="http://test-ollama:11434",
        OLLAMA_MODEL="qwen3-vl:8b",
        OLLAMA_TIMEOUT=300,
        OLLAMA_TEMPERATURE=0.1
    )
    return OllamaVisionClient(settings)


@pytest.fixture
def sample_breed_analysis_purebred():
    """Sample breed analysis for purebred."""
    return {
        "primary_breed": "golden_retriever",
        "confidence": 0.89,
        "is_likely_crossbreed": False,
        "breed_probabilities": [
            {"breed": "golden_retriever", "probability": 0.89}
        ],
        "crossbreed_analysis": None
    }


@pytest.fixture
def sample_rag_context_purebred():
    """Sample RAG context for purebred."""
    return {
        "breed": "Golden Retriever",
        "parent_breeds": None,
        "description": "Large sporting dog known for friendly temperament and golden coat.",
        "care_summary": "Requires daily exercise and regular grooming.",
        "health_info": "Common issues: hip dysplasia, cancer, heart disease.",
        "sources": ["akc_golden_retriever.md"]
    }


@pytest.mark.asyncio
async def test_analyze_with_context_purebred(
    ollama_client,
    sample_breed_analysis_purebred,
    sample_rag_context_purebred
):
    """Test contextual analysis for purebred dog."""
    mock_response = {
        "message": {
            "content": '''{
                "description": "This Golden Retriever appears to be an adult dog in excellent physical condition with a healthy golden coat.",
                "traits": {
                    "size": "large",
                    "energy_level": "medium",
                    "temperament": "Alert and friendly based on calm expression"
                },
                "health_observations": [
                    "Coat appears healthy and well-groomed",
                    "Eyes are clear and bright"
                ]
            }'''
        }
    }

    mock_http_response = Mock()
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_async_client):
        result = await ollama_client.analyze_with_context(
            image_base64="data:image/jpeg;base64,/9j/test123",
            species="dog",
            breed_analysis=sample_breed_analysis_purebred,
            rag_context=sample_rag_context_purebred
        )

        assert "description" in result
        assert "traits" in result
        assert "health_observations" in result
        assert result["traits"]["size"] == "large"
        assert len(result["health_observations"]) > 0

        # Verify prompt contains breed context
        call_args = mock_async_client.post.call_args
        prompt = call_args[1]["json"]["messages"][0]["content"]
        assert "Golden Retriever" in prompt
        assert "confidence: 0.89" in prompt
        assert "BREED CONTEXT" in prompt
        assert "hip dysplasia" in prompt


@pytest.mark.asyncio
async def test_analyze_with_context_crossbreed(ollama_client):
    """Test contextual analysis for crossbreed dog."""
    breed_analysis = {
        "primary_breed": "goldendoodle",
        "confidence": 0.42,
        "is_likely_crossbreed": True,
        "breed_probabilities": [
            {"breed": "golden_retriever", "probability": 0.47},
            {"breed": "poodle", "probability": 0.36}
        ],
        "crossbreed_analysis": {
            "detected_breeds": ["Golden Retriever", "Poodle"],
            "common_name": "Goldendoodle",
            "confidence_reasoning": "Multiple breeds with high probabilities"
        }
    }

    rag_context = {
        "breed": None,
        "parent_breeds": ["Golden Retriever", "Poodle"],
        "description": "Mix of Golden Retriever and Poodle, typically medium to large size.",
        "care_summary": "Moderate exercise needs, regular grooming required.",
        "health_info": "May inherit health issues from both parent breeds.",
        "sources": ["golden.md", "poodle.md"]
    }

    mock_response = {
        "message": {
            "content": '''{
                "description": "This Goldendoodle shows characteristics of both parent breeds.",
                "traits": {
                    "size": "medium",
                    "energy_level": "high",
                    "temperament": "Friendly and playful"
                },
                "health_observations": ["Wavy coat appears healthy"]
            }'''
        }
    }

    mock_http_response = Mock()
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_async_client):
        result = await ollama_client.analyze_with_context(
            image_base64="/9j/test123",  # No data URI prefix
            species="dog",
            breed_analysis=breed_analysis,
            rag_context=rag_context
        )

        assert result["description"] is not None

        # Verify crossbreed prompt structure
        call_args = mock_async_client.post.call_args
        prompt = call_args[1]["json"]["messages"][0]["content"]
        assert "Goldendoodle" in prompt
        assert "Parent breeds: Golden Retriever, Poodle" in prompt


@pytest.mark.asyncio
async def test_analyze_with_context_no_rag(
    ollama_client,
    sample_breed_analysis_purebred
):
    """Test contextual analysis when RAG context unavailable."""
    mock_response = {
        "message": {
            "content": '''{
                "description": "Adult Golden Retriever",
                "traits": {"size": "large", "energy_level": "medium", "temperament": "friendly"},
                "health_observations": []
            }'''
        }
    }

    mock_http_response = Mock()
    mock_http_response.json.return_value = mock_response
    mock_http_response.raise_for_status = Mock()

    mock_async_client = AsyncMock()
    mock_async_client.post = AsyncMock(return_value=mock_http_response)
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=None)

    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_async_client):
        result = await ollama_client.analyze_with_context(
            image_base64="test123",
            species="dog",
            breed_analysis=sample_breed_analysis_purebred,
            rag_context=None  # No RAG context
        )

        assert result is not None

        # Verify prompt handles missing RAG gracefully
        call_args = mock_async_client.post.call_args
        prompt = call_args[1]["json"]["messages"][0]["content"]
        assert "BREED CONTEXT: (unavailable)" in prompt


@pytest.mark.asyncio
async def test_analyze_with_context_connection_error(
    ollama_client,
    sample_breed_analysis_purebred
):
    """Test connection error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.ConnectError("Connection failed")):
        with pytest.raises(ConnectionError, match="Ollama service unavailable"):
            await ollama_client.analyze_with_context(
                image_base64="test",
                species="dog",
                breed_analysis=sample_breed_analysis_purebred,
                rag_context=None
            )


@pytest.mark.asyncio
async def test_analyze_with_context_timeout_error(
    ollama_client,
    sample_breed_analysis_purebred
):
    """Test timeout error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.TimeoutException("Timeout")):
        with pytest.raises(ConnectionError, match="Ollama service timeout"):
            await ollama_client.analyze_with_context(
                image_base64="test",
                species="dog",
                breed_analysis=sample_breed_analysis_purebred,
                rag_context=None
            )
