import pytest
from unittest.mock import Mock, AsyncMock
import logging

from src.services.vision_orchestrator import VisionOrchestrator


@pytest.fixture
def mock_classification():
    """Mock classification client."""
    return Mock()


@pytest.fixture
def mock_ollama():
    """Mock Ollama client."""
    return Mock()


@pytest.fixture
def mock_rag():
    """Mock RAG service."""
    return Mock()


@pytest.fixture
def mock_config():
    """Mock config with threshold values."""
    config = Mock()
    config.SPECIES_MIN_CONFIDENCE = 0.10
    config.BREED_MIN_CONFIDENCE = 0.05
    return config


@pytest.mark.asyncio
async def test_purebred_pipeline_success(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test successful purebred dog analysis."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={
        "is_safe": True,
        "nsfw_probability": 0.1
    })
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.87
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False,
            "breed_probabilities": [
                {"breed": "golden_retriever", "probability": 0.89}
            ],
            "crossbreed_analysis": None
        }
    })
    mock_rag.get_breed_context = AsyncMock(return_value={
        "breed": "Golden Retriever",
        "parent_breeds": None,
        "description": "Large sporting dog...",
        "care_summary": "Daily exercise...",
        "health_info": "Hip dysplasia...",
        "sources": ["akc.md"]
    })
    mock_ollama.analyze_with_context = AsyncMock(return_value={
        "description": "This Golden Retriever appears healthy...",
        "traits": {"size": "large", "energy_level": "medium", "temperament": "friendly"},
        "health_observations": ["Healthy coat"]
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Assert
    assert result["species"] == "dog"
    assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
    assert result["breed_analysis"]["is_likely_crossbreed"] is False
    assert result["enriched_info"] is not None
    assert result["description"] is not None
    assert result["traits"]["size"] == "large"
    assert len(result["health_observations"]) > 0

    # Verify all stages called
    mock_classification.check_content.assert_called_once()
    mock_classification.detect_species.assert_called_once()
    mock_classification.detect_breed.assert_called_once()
    mock_rag.get_breed_context.assert_called_once_with("golden_retriever")
    mock_ollama.analyze_with_context.assert_called_once()


@pytest.mark.asyncio
async def test_crossbreed_pipeline_success(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test successful crossbreed detection (Goldendoodle)."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.90
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
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
    })
    mock_rag.get_crossbreed_context = AsyncMock(return_value={
        "breed": None,
        "parent_breeds": ["Golden Retriever", "Poodle"],
        "description": "Mix of two breeds...",
        "care_summary": "Moderate exercise...",
        "health_info": "Varies by parent...",
        "sources": ["golden.md", "poodle.md"]
    })
    mock_ollama.analyze_with_context = AsyncMock(return_value={
        "description": "Goldendoodle with wavy coat...",
        "traits": {"size": "medium", "energy_level": "high", "temperament": "playful"},
        "health_observations": []
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Assert
    assert result["breed_analysis"]["is_likely_crossbreed"] is True
    assert result["breed_analysis"]["crossbreed_analysis"]["common_name"] == "Goldendoodle"
    assert "Golden Retriever" in result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]
    assert "Poodle" in result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]

    # Verify crossbreed RAG method called
    mock_rag.get_crossbreed_context.assert_called_once_with(["Golden Retriever", "Poodle"])


@pytest.mark.asyncio
async def test_nsfw_rejection(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test content policy violation rejection."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={
        "is_safe": False,
        "nsfw_probability": 0.85
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act & Assert
    with pytest.raises(ValueError, match="CONTENT_POLICY_VIOLATION"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Verify pipeline stopped early
    mock_classification.detect_species.assert_not_called()


@pytest.mark.asyncio
async def test_unsupported_species_rejection(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test rabbit image rejection."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "rabbit",
        "confidence": 0.92
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act & Assert
    with pytest.raises(ValueError, match="UNSUPPORTED_SPECIES"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Verify pipeline stopped early
    mock_classification.detect_breed.assert_not_called()


@pytest.mark.asyncio
async def test_low_species_confidence_rejection(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test rejection when species confidence < configured threshold."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.05  # Below 0.10 threshold
    })
    # Mock detect_breed even though we expect early rejection (in case threshold changes)
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "unknown",
            "confidence": 0.0,
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act & Assert
    with pytest.raises(ValueError, match="SPECIES_DETECTION_FAILED"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_low_breed_confidence_rejection(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test rejection when breed confidence < 0.05."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.85
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "unknown",
            "confidence": 0.04,  # Below 0.05 threshold
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    })
    # Mock RAG and Ollama even though we expect early rejection (in case threshold changes)
    mock_rag.get_breed_context = AsyncMock(return_value={
        "breed": "Unknown",
        "description": "Unknown breed",
        "care_summary": "General care",
        "health_info": "Unknown",
        "sources": []
    })
    mock_ollama.analyze_with_context = AsyncMock(return_value={
        "description": "Unable to analyze",
        "traits": {},
        "health_observations": []
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act & Assert
    with pytest.raises(ValueError, match="BREED_DETECTION_FAILED"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_rag_failure_graceful_degradation(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test pipeline continues when RAG fails."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.87
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    })
    mock_rag.get_breed_context = AsyncMock(side_effect=Exception("ChromaDB connection failed"))
    mock_ollama.analyze_with_context = AsyncMock(return_value={
        "description": "Golden Retriever in good condition",
        "traits": {"size": "large", "energy_level": "medium", "temperament": "friendly"},
        "health_observations": []
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Assert
    assert result["enriched_info"] is None  # RAG failed gracefully
    assert result["description"] is not None  # Ollama still worked
    assert result["breed_analysis"]["primary_breed"] == "golden_retriever"

    # Verify Ollama called with rag_context=None
    call_args = mock_ollama.analyze_with_context.call_args
    assert call_args[1]["rag_context"] is None


@pytest.mark.asyncio
async def test_cat_species_pipeline(mock_classification, mock_ollama, mock_rag, mock_config):
    """Test pipeline works for cats too."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "cat",
        "confidence": 0.91
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "persian",
            "confidence": 0.77,
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    })
    mock_rag.get_breed_context = AsyncMock(return_value={
        "breed": "Persian",
        "description": "Long-haired cat breed...",
        "care_summary": "Daily brushing...",
        "health_info": "Respiratory issues...",
        "sources": []
    })
    mock_ollama.analyze_with_context = AsyncMock(return_value={
        "description": "Persian cat with fluffy coat",
        "traits": {"size": "medium", "energy_level": "low", "temperament": "calm"},
        "health_observations": []
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag, mock_config)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Assert
    assert result["species"] == "cat"
    assert result["breed_analysis"]["primary_breed"] == "persian"

    # Verify breed detection called with species="cat"
    call_args = mock_classification.detect_breed.call_args
    assert call_args[0][1] == "cat"
