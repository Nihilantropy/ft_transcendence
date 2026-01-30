# Multi-Stage Vision Pipeline Implementation Plan (Part 2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the multi-stage vision analysis pipeline by implementing Ollama client updates, VisionOrchestrator, and updating the vision route.

**Architecture:** Extends Part 1 by adding contextual Ollama analysis with pre-classified context, orchestrating the full pipeline (classification → RAG → Ollama), and updating the vision API endpoint.

**Tech Stack:** FastAPI, httpx, Pydantic, ChromaDB, Ollama HTTP API, pytest

---

## Prerequisites

**Part 1 must be completed:**
- Classification service running (Tasks 1-8)
- AI service response models updated (Task 9)
- ClassificationClient implemented (Task 10)
- RAG breed context retrieval added (Task 11)

**Verify Part 1 completion:**
```bash
git log --oneline | head -11
# Should show commits for Tasks 1-11
```

---

## Phase 5: Ollama Client Enhancements

### Task 12: Ollama Client Contextual Analysis

**Files:**
- Modify: `srcs/ai/src/services/ollama_client.py`
- Create: `srcs/ai/tests/unit/test_ollama_contextual.py`

**Step 1: Write failing test for contextual analysis (purebred)**

File: `srcs/ai/tests/unit/test_ollama_contextual.py`
```python
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

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

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
        call_args = mock_post.call_args
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

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await ollama_client.analyze_with_context(
            image_base64="/9j/test123",  # No data URI prefix
            species="dog",
            breed_analysis=breed_analysis,
            rag_context=rag_context
        )

        assert result["description"] is not None

        # Verify crossbreed prompt structure
        call_args = mock_post.call_args
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

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await ollama_client.analyze_with_context(
            image_base64="test123",
            species="dog",
            breed_analysis=sample_breed_analysis_purebred,
            rag_context=None  # No RAG context
        )

        assert result is not None

        # Verify prompt handles missing RAG gracefully
        call_args = mock_post.call_args
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
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_ollama_contextual.py -v
```

Expected: FAIL with "AttributeError: 'OllamaVisionClient' object has no attribute 'analyze_with_context'"

**Step 3: Add analyze_with_context method to OllamaVisionClient**

File: `srcs/ai/src/services/ollama_client.py` (add after existing methods)
```python
    async def analyze_with_context(
        self,
        image_base64: str,
        species: str,
        breed_analysis: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze pet image with pre-classified context.

        Args:
            image_base64: Base64-encoded image (data URI or raw)
            species: Pre-classified species (dog/cat)
            breed_analysis: Complete breed classification result
            rag_context: RAG-enriched breed knowledge (can be None)

        Returns:
            Dict with visual description, traits, health observations

        Raises:
            ConnectionError: If Ollama unreachable
            RuntimeError: If response parsing fails
        """
        # Extract base64 part if data URI
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        # Build contextual prompt
        prompt = self._build_contextual_prompt(species, breed_analysis, rag_context)

        # Call Ollama HTTP API
        try:
            timeout = httpx.Timeout(self.timeout, connect=self.timeout)
            async with httpx.AsyncClient(timeout=timeout) as client:
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
                        "options": {"temperature": self.temperature}
                    }
                )
                response.raise_for_status()
                response_data = response.json()

        except httpx.ConnectError as e:
            logger.error(f"Ollama connection failed: {e}")
            raise ConnectionError("Ollama service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Ollama timeout: {e}")
            raise ConnectionError("Ollama service timeout")

        # Parse JSON response
        content = response_data.get("message", {}).get("content", "")
        result = self._parse_response(content)

        logger.info(f"Visual analysis complete for {breed_analysis['primary_breed']}")
        return result

    def _build_contextual_prompt(
        self,
        species: str,
        breed_analysis: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]]
    ) -> str:
        """Build focused prompt with classification context."""

        is_crossbreed = breed_analysis["is_likely_crossbreed"]
        confidence = breed_analysis["confidence"]

        # Build RAG context section
        if rag_context:
            if is_crossbreed:
                breed_name = (
                    breed_analysis.get("crossbreed_analysis", {}).get("common_name") or
                    f"{breed_analysis['crossbreed_analysis']['detected_breeds'][0]}-"
                    f"{breed_analysis['crossbreed_analysis']['detected_breeds'][1]} mix"
                )
                parent_breeds = breed_analysis["crossbreed_analysis"]["detected_breeds"]
                context_section = f"""BREED CONTEXT (from database):
Parent breeds: {', '.join(parent_breeds)}
Typical characteristics: {rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
            else:
                breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
                context_section = f"""BREED CONTEXT (from database):
{rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
        else:
            breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
            context_section = "BREED CONTEXT: (unavailable)"

        return f"""You are analyzing a {species} image that has been pre-classified as a {breed_name} (confidence: {confidence:.2f}).

{context_section}

YOUR TASK: Describe THIS SPECIFIC {species} based on what you SEE in the image:
- Physical appearance and condition (coat quality, body condition, visible features)
- Estimated age range based on visual cues
- Any notable characteristics or features specific to this individual
- Visible health indicators (if any)

Return ONLY valid JSON:
{{
  "description": "detailed visual description of this specific {species}",
  "traits": {{
    "size": "small/medium/large (based on visual proportions)",
    "energy_level": "low/medium/high (inferred from posture/expression)",
    "temperament": "brief description based on expression and body language"
  }},
  "health_observations": ["visible observation 1", "visible observation 2"]
}}

Focus on describing what you SEE, not general breed knowledge."""
```

**Step 4: Add missing import**

File: `srcs/ai/src/services/ollama_client.py` (add to imports at top)
```python
from typing import Dict, Any, List, Optional
```

**Step 5: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_ollama_contextual.py -v
```

Expected: All tests PASS

**Step 6: Commit Ollama client enhancements**

```bash
git add srcs/ai/src/services/ollama_client.py
git add srcs/ai/tests/unit/test_ollama_contextual.py
git commit -m "feat(ai): add contextual analysis to Ollama client

- Add analyze_with_context() method with breed/RAG context
- Build contextual prompts for purebred and crossbreed analysis
- Focus Ollama on visual description vs breed identification
- Handle missing RAG context gracefully
- Add comprehensive tests for contextual analysis

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Vision Orchestration

### Task 13: VisionOrchestrator Implementation

**Files:**
- Create: `srcs/ai/src/services/vision_orchestrator.py`
- Create: `srcs/ai/tests/unit/test_vision_orchestrator.py`

**Step 1: Write failing test for VisionOrchestrator (purebred pipeline)**

File: `srcs/ai/tests/unit/test_vision_orchestrator.py`
```python
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


@pytest.mark.asyncio
async def test_purebred_pipeline_success(mock_classification, mock_ollama, mock_rag):
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

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

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
async def test_crossbreed_pipeline_success(mock_classification, mock_ollama, mock_rag):
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

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

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
async def test_nsfw_rejection(mock_classification, mock_ollama, mock_rag):
    """Test content policy violation rejection."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={
        "is_safe": False,
        "nsfw_probability": 0.85
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act & Assert
    with pytest.raises(ValueError, match="CONTENT_POLICY_VIOLATION"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Verify pipeline stopped early
    mock_classification.detect_species.assert_not_called()


@pytest.mark.asyncio
async def test_unsupported_species_rejection(mock_classification, mock_ollama, mock_rag):
    """Test rabbit image rejection."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "rabbit",
        "confidence": 0.92
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act & Assert
    with pytest.raises(ValueError, match="UNSUPPORTED_SPECIES"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Verify pipeline stopped early
    mock_classification.detect_breed.assert_not_called()


@pytest.mark.asyncio
async def test_low_species_confidence_rejection(mock_classification, mock_ollama, mock_rag):
    """Test rejection when species confidence < 0.60."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.45  # Below threshold
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act & Assert
    with pytest.raises(ValueError, match="SPECIES_DETECTION_FAILED"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_low_breed_confidence_rejection(mock_classification, mock_ollama, mock_rag):
    """Test rejection when breed confidence < 0.40."""
    # Arrange
    mock_classification.check_content = AsyncMock(return_value={"is_safe": True})
    mock_classification.detect_species = AsyncMock(return_value={
        "species": "dog",
        "confidence": 0.85
    })
    mock_classification.detect_breed = AsyncMock(return_value={
        "breed_analysis": {
            "primary_breed": "unknown",
            "confidence": 0.32,  # Below threshold
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    })

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act & Assert
    with pytest.raises(ValueError, match="BREED_DETECTION_FAILED"):
        await orchestrator.analyze_image("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_rag_failure_graceful_degradation(mock_classification, mock_ollama, mock_rag):
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

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

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
async def test_cat_species_pipeline(mock_classification, mock_ollama, mock_rag):
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

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,test123")

    # Assert
    assert result["species"] == "cat"
    assert result["breed_analysis"]["primary_breed"] == "persian"

    # Verify breed detection called with species="cat"
    call_args = mock_classification.detect_breed.call_args
    assert call_args[0][1] == "cat"
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_vision_orchestrator.py -v
```

Expected: FAIL with "ModuleNotFoundError: No module named 'src.services.vision_orchestrator'"

**Step 3: Write VisionOrchestrator implementation**

File: `srcs/ai/src/services/vision_orchestrator.py`
```python
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class VisionOrchestrator:
    """Orchestrates multi-stage vision analysis pipeline.

    Coordinates sequential execution:
    1. Content safety check (NSFW detection)
    2. Species detection (dog/cat validation)
    3. Breed classification (with crossbreed detection)
    4. RAG enrichment (graceful failure)
    5. Contextual Ollama analysis
    """

    def __init__(self, classification_client, ollama_client, rag_service):
        """Initialize orchestrator with service dependencies.

        Args:
            classification_client: ClassificationClient instance
            ollama_client: OllamaVisionClient instance
            rag_service: RAGService instance
        """
        self.classification = classification_client
        self.ollama = ollama_client
        self.rag = rag_service

        logger.info("VisionOrchestrator initialized")

    async def analyze_image(self, image: str) -> Dict[str, Any]:
        """Execute full vision analysis pipeline with early rejection.

        Args:
            image: Base64-encoded image (with or without data URI prefix)

        Returns:
            Dict with species, breed_analysis, description, traits,
            health_observations, and enriched_info

        Raises:
            ValueError: If any validation stage fails (CONTENT_POLICY_VIOLATION,
                       UNSUPPORTED_SPECIES, SPECIES_DETECTION_FAILED,
                       BREED_DETECTION_FAILED)
            ConnectionError: If classification or Ollama service unavailable
        """
        logger.info("Starting vision analysis pipeline")

        # Stage 1: Content safety (strict)
        safety = await self.classification.check_content(image)
        if not safety["is_safe"]:
            logger.warning(f"Content policy violation: NSFW probability {safety['nsfw_probability']}")
            raise ValueError("CONTENT_POLICY_VIOLATION")

        logger.info("Content safety check passed")

        # Stage 2: Species detection (strict)
        species_result = await self.classification.detect_species(image)
        if species_result["species"] not in ["dog", "cat"]:
            logger.warning(f"Unsupported species: {species_result['species']}")
            raise ValueError("UNSUPPORTED_SPECIES")
        if species_result["confidence"] < 0.60:
            logger.warning(f"Low species confidence: {species_result['confidence']}")
            raise ValueError("SPECIES_DETECTION_FAILED")

        logger.info(f"Species detected: {species_result['species']} (confidence: {species_result['confidence']:.2f})")

        # Stage 3: Breed classification (strict)
        breed_result = await self.classification.detect_breed(
            image,
            species_result["species"],
            top_k=5
        )
        if breed_result["breed_analysis"]["confidence"] < 0.40:
            logger.warning(f"Low breed confidence: {breed_result['breed_analysis']['confidence']}")
            raise ValueError("BREED_DETECTION_FAILED")

        logger.info(
            f"Breed detected: {breed_result['breed_analysis']['primary_breed']} "
            f"(confidence: {breed_result['breed_analysis']['confidence']:.2f}, "
            f"crossbreed: {breed_result['breed_analysis']['is_likely_crossbreed']})"
        )

        # Stage 4: RAG enrichment (graceful failure)
        rag_context = None
        try:
            if breed_result["breed_analysis"]["is_likely_crossbreed"]:
                detected_breeds = breed_result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]
                logger.info(f"Retrieving crossbreed context for: {detected_breeds}")
                rag_context = await self.rag.get_crossbreed_context(detected_breeds)
            else:
                logger.info(f"Retrieving breed context for: {breed_result['breed_analysis']['primary_breed']}")
                rag_context = await self.rag.get_breed_context(
                    breed_result["breed_analysis"]["primary_breed"]
                )
            logger.info("RAG enrichment successful")
        except Exception as e:
            logger.warning(f"RAG enrichment failed (graceful degradation): {e}")
            rag_context = None

        # Stage 5: Contextual Ollama analysis
        logger.info("Starting Ollama visual analysis")
        ollama_result = await self.ollama.analyze_with_context(
            image=image,
            species=species_result["species"],
            breed_analysis=breed_result["breed_analysis"],
            rag_context=rag_context
        )

        # Assemble final response
        result = {
            "species": species_result["species"],
            "breed_analysis": breed_result["breed_analysis"],
            "description": ollama_result["description"],
            "traits": ollama_result["traits"],
            "health_observations": ollama_result["health_observations"],
            "enriched_info": rag_context
        }

        logger.info("Vision analysis pipeline completed successfully")
        return result
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_vision_orchestrator.py -v
```

Expected: All tests PASS

**Step 5: Commit VisionOrchestrator**

```bash
git add srcs/ai/src/services/vision_orchestrator.py
git add srcs/ai/tests/unit/test_vision_orchestrator.py
git commit -m "feat(ai): add VisionOrchestrator for multi-stage pipeline

- Coordinate classification → RAG → Ollama pipeline
- Implement early rejection at each validation stage
- Handle graceful degradation for RAG failures
- Support both purebred and crossbreed workflows
- Add comprehensive tests for all pipeline scenarios

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Update Vision Route to Use Orchestrator

**Files:**
- Modify: `srcs/ai/src/routes/vision.py`
- Modify: `srcs/ai/src/main.py`

**Step 1: Update vision route to use orchestrator**

File: `srcs/ai/src/routes/vision.py` (replace analyze_image function)
```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from src.models.responses import VisionAnalysisResponse, VisionAnalysisData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/vision", tags=["vision"])


# Request model
class VisionAnalysisRequest(BaseModel):
    """Request for vision analysis."""
    image: str = Field(..., description="Base64-encoded image (with or without data URI prefix)")


# Service instances (injected at startup)
image_processor = None
vision_orchestrator = None  # Changed from ollama_client


@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image with multi-stage pipeline.

    Pipeline stages:
    1. Image processing and validation
    2. Content safety check (NSFW)
    3. Species detection (dog/cat)
    4. Breed classification (with crossbreed detection)
    5. RAG enrichment (graceful failure)
    6. Contextual Ollama visual analysis

    Returns:
        VisionAnalysisResponse with species, breed_analysis, description,
        traits, health_observations, and enriched_info
    """
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)

        # Run orchestrated pipeline
        result = await vision_orchestrator.analyze_image(processed_image)

        # Build response
        data = VisionAnalysisData(**result)
        return VisionAnalysisResponse(
            success=True,
            data=data,
            error=None,
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as e:
        # Classification rejection errors (422)
        error_code = str(e)
        error_map = {
            "CONTENT_POLICY_VIOLATION": "Image does not meet content policy requirements",
            "UNSUPPORTED_SPECIES": "Only dog and cat images are supported",
            "SPECIES_DETECTION_FAILED": "Unable to identify species with sufficient confidence",
            "BREED_DETECTION_FAILED": "Unable to identify breed with sufficient confidence",
            "INVALID_IMAGE_FORMAT": "Invalid image format or corrupted image",
            "IMAGE_TOO_LARGE": "Image size exceeds maximum allowed size",
            "IMAGE_TOO_SMALL": "Image dimensions are too small for analysis"
        }

        logger.warning(f"Validation error: {error_code}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": error_code,
                    "message": error_map.get(error_code, "Validation failed")
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    except ConnectionError as e:
        # Service unavailability (503)
        logger.error(f"Service connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "VISION_SERVICE_UNAVAILABLE",
                    "message": "Vision analysis temporarily unavailable, please try again"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        # Unexpected errors (500)
        logger.error(f"Unexpected error during vision analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred during analysis"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health")
async def health_check():
    """Vision service health check."""
    return {
        "status": "healthy",
        "service": "vision-analysis",
        "pipeline": "multi-stage"
    }
```

**Step 2: Update main.py to inject VisionOrchestrator**

File: `srcs/ai/src/main.py` (modify lifespan and service injection)
```python
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routes import vision
from src.services.ollama_client import OllamaVisionClient
from src.services.rag_service import RAGService
from src.services.embedder import Embedder
from src.services.image_processor import ImageProcessor
from src.services.classification_client import ClassificationClient
from src.services.vision_orchestrator import VisionOrchestrator

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info(f"Starting {settings.SERVICE_NAME}...")

    # Initialize services
    embedder = Embedder(settings)
    ollama_client = OllamaVisionClient(settings)
    rag_service = RAGService(settings, embedder, ollama_client)
    classification_client = ClassificationClient(settings)
    image_processor = ImageProcessor(settings)

    # Initialize orchestrator
    vision_orchestrator = VisionOrchestrator(
        classification_client,
        ollama_client,
        rag_service
    )

    # Inject into routes
    vision.image_processor = image_processor
    vision.vision_orchestrator = vision_orchestrator

    logger.info(f"{settings.SERVICE_NAME} started successfully")

    yield

    logger.info(f"Shutting down {settings.SERVICE_NAME}...")


# Create FastAPI app
app = FastAPI(
    title="SmartBreeds AI Service",
    description="Multi-stage vision analysis pipeline for pet breed identification",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(vision.router)


@app.get("/health")
async def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": "2.0.0"
    }
```

**Step 3: Test vision route with mocked dependencies**

Create quick integration test to verify route works:

File: `srcs/ai/tests/integration/test_vision_route.py`
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch
import base64
from io import BytesIO
from PIL import Image


@pytest.fixture
def sample_image_base64():
    """Create sample base64 image."""
    img = Image.new('RGB', (224, 224), color='red')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


@pytest.fixture
def client():
    """Create test client with mocked services."""
    from src.main import app
    from src.routes import vision
    from src.services.image_processor import ImageProcessor
    from src.config import Settings

    # Mock services
    mock_orchestrator = Mock()
    mock_orchestrator.analyze_image = AsyncMock(return_value={
        "species": "dog",
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False,
            "breed_probabilities": [
                {"breed": "golden_retriever", "probability": 0.89}
            ],
            "crossbreed_analysis": None
        },
        "description": "Healthy adult Golden Retriever",
        "traits": {
            "size": "large",
            "energy_level": "medium",
            "temperament": "friendly"
        },
        "health_observations": ["Healthy coat"],
        "enriched_info": {
            "breed": "Golden Retriever",
            "parent_breeds": None,
            "description": "Large sporting dog",
            "care_summary": "Daily exercise",
            "health_info": "Hip dysplasia risk",
            "sources": ["akc.md"]
        }
    })

    # Inject mocks
    vision.image_processor = ImageProcessor(Settings())
    vision.vision_orchestrator = mock_orchestrator

    return TestClient(app)


def test_analyze_image_success(client, sample_image_base64):
    """Test successful image analysis."""
    response = client.post(
        "/api/v1/vision/analyze",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["species"] == "dog"
    assert data["data"]["breed_analysis"]["primary_breed"] == "golden_retriever"
    assert data["data"]["enriched_info"] is not None


def test_analyze_image_nsfw_rejection(client, sample_image_base64):
    """Test NSFW content rejection."""
    from src.routes import vision

    vision.vision_orchestrator.analyze_image = AsyncMock(
        side_effect=ValueError("CONTENT_POLICY_VIOLATION")
    )

    response = client.post(
        "/api/v1/vision/analyze",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "CONTENT_POLICY_VIOLATION"


def test_analyze_image_unsupported_species(client, sample_image_base64):
    """Test unsupported species rejection."""
    from src.routes import vision

    vision.vision_orchestrator.analyze_image = AsyncMock(
        side_effect=ValueError("UNSUPPORTED_SPECIES")
    )

    response = client.post(
        "/api/v1/vision/analyze",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "UNSUPPORTED_SPECIES"


def test_analyze_image_service_unavailable(client, sample_image_base64):
    """Test service unavailability error."""
    from src.routes import vision

    vision.vision_orchestrator.analyze_image = AsyncMock(
        side_effect=ConnectionError("Classification service unavailable")
    )

    response = client.post(
        "/api/v1/vision/analyze",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 503
    data = response.json()
    assert data["error"]["code"] == "VISION_SERVICE_UNAVAILABLE"


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/api/v1/vision/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
```

**Step 4: Run integration test**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/integration/test_vision_route.py -v
```

Expected: All tests PASS

**Step 5: Commit vision route updates**

```bash
git add srcs/ai/src/routes/vision.py
git add srcs/ai/src/main.py
git add srcs/ai/tests/integration/test_vision_route.py
git commit -m "feat(ai): update vision route to use VisionOrchestrator

- Replace direct ollama_client with vision_orchestrator
- Update error handling for new rejection codes
- Inject VisionOrchestrator in main.py lifespan
- Add integration tests for route with mocked services
- Return structured VisionAnalysisResponse model

BREAKING CHANGE: Response format updated with multi-stage results

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: End-to-End Testing

### Task 15: Full Pipeline Integration Tests

**Files:**
- Create: `srcs/ai/tests/integration/test_full_pipeline.py`
- Create: `srcs/ai/tests/fixtures/sample_images.py`

**Step 1: Create sample image fixtures**

File: `srcs/ai/tests/fixtures/sample_images.py`
```python
import base64
from io import BytesIO
from PIL import Image


def create_test_image(color: str = "red", size: tuple = (224, 224)) -> str:
    """Create a simple test image as base64.

    Args:
        color: Color name (red, blue, green, etc.)
        size: Image dimensions (width, height)

    Returns:
        Base64-encoded JPEG with data URI prefix
    """
    img = Image.new('RGB', size, color=color)
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


# Pre-generated fixtures
SAMPLE_DOG_IMAGE = create_test_image("brown")
SAMPLE_CAT_IMAGE = create_test_image("gray")
SAMPLE_INVALID_IMAGE = "data:image/jpeg;base64,invalid_data"
```

**Step 2: Write full pipeline integration test (requires real services)**

File: `srcs/ai/tests/integration/test_full_pipeline.py`
```python
import pytest
import httpx
from tests.fixtures.sample_images import SAMPLE_DOG_IMAGE, SAMPLE_CAT_IMAGE


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_pipeline_with_real_services():
    """Test full pipeline with real classification service and Ollama.

    REQUIREMENTS:
    - classification-service must be running
    - ollama service must be running with qwen3-vl:8b
    - ChromaDB must be populated with breed knowledge

    This is a SLOW test (~4-5 seconds).
    """
    # This test is marked as integration and should be run separately
    # Run with: pytest tests/integration/test_full_pipeline.py -v -m integration

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test with real AI service endpoint
        response = await client.post(
            "http://localhost:3003/api/v1/vision/analyze",
            json={"image": SAMPLE_DOG_IMAGE}
        )

        # Should succeed or return meaningful error
        assert response.status_code in [200, 422, 503]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "species" in data["data"]
            assert "breed_analysis" in data["data"]
            assert "description" in data["data"]


@pytest.mark.integration
def test_classification_service_health():
    """Verify classification service is reachable."""
    import requests

    try:
        response = requests.get("http://localhost:3004/health", timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    except requests.exceptions.ConnectionError:
        pytest.skip("Classification service not running")


@pytest.mark.integration
def test_ollama_service_health():
    """Verify Ollama service is reachable."""
    import requests

    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        assert response.status_code == 200
        data = response.json()
        # Verify qwen3-vl:8b model is loaded
        model_names = [model["name"] for model in data.get("models", [])]
        assert "qwen3-vl:8b" in model_names
    except requests.exceptions.ConnectionError:
        pytest.skip("Ollama service not running")
```

**Step 3: Add pytest markers to pytest.ini**

File: `srcs/ai/pytest.ini` (create if doesn't exist)
```ini
[pytest]
markers =
    integration: marks tests as integration tests (require real services)
    unit: marks tests as unit tests (mocked dependencies)
    slow: marks tests as slow running (> 1 second)

asyncio_mode = auto
```

**Step 4: Create test script for integration tests**

File: `srcs/ai/scripts/run-integration-tests.sh` (create new file)
```bash
#!/bin/bash

set -e

echo "================================"
echo "AI Service Integration Tests"
echo "================================"
echo ""
echo "REQUIREMENTS:"
echo "- docker compose up classification-service ollama ai-service"
echo "- ChromaDB populated with breed knowledge"
echo ""
echo "These tests are SLOW (~30-60 seconds total)"
echo ""

# Check if services are running
echo "Checking service health..."

if ! curl -sf http://localhost:3004/health > /dev/null; then
    echo "ERROR: classification-service not responding at localhost:3004"
    echo "Run: docker compose up classification-service -d"
    exit 1
fi

if ! curl -sf http://localhost:11434/api/tags > /dev/null; then
    echo "ERROR: ollama not responding at localhost:11434"
    echo "Run: docker compose up ollama -d"
    exit 1
fi

echo "✓ Services healthy"
echo ""
echo "Running integration tests..."
echo ""

# Run integration tests with verbose output
docker compose run --rm ai-service python -m pytest \
    tests/integration/ \
    -v \
    -m integration \
    --timeout=60 \
    --tb=short

echo ""
echo "Integration tests complete!"
```

**Step 5: Make script executable**

Run:
```bash
chmod +x /home/crea/Desktop/ft_transcendence/srcs/ai/scripts/run-integration-tests.sh
```

**Step 6: Run unit tests to ensure nothing broke**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/ -v
```

Expected: All unit tests PASS

**Step 7: Commit integration tests**

```bash
git add srcs/ai/tests/integration/test_full_pipeline.py
git add srcs/ai/tests/fixtures/sample_images.py
git add srcs/ai/pytest.ini
git add srcs/ai/scripts/run-integration-tests.sh
git commit -m "test(ai): add full pipeline integration tests

- Add integration tests requiring real services
- Create sample image fixtures for testing
- Add pytest markers for integration vs unit tests
- Create script to run integration tests with health checks
- Tests verify end-to-end pipeline functionality

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion Checklist

After completing all tasks (12-15), verify the implementation:

**Unit Tests:**
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/ -v --cov=src --cov-report=term-missing
```

Expected: All unit tests PASS, coverage > 80%

**Service Health Checks:**
```bash
# Classification service
curl http://localhost:3004/health

# AI service
curl http://localhost:3003/health
```

**Manual End-to-End Test:**
```bash
# Create test image
python3 << 'EOF'
import base64
from io import BytesIO
from PIL import Image

img = Image.new('RGB', (512, 512), color='brown')
buffer = BytesIO()
img.save(buffer, format='JPEG')
encoded = base64.b64encode(buffer.getvalue()).decode()
print(f'data:image/jpeg;base64,{encoded}')
EOF

# Copy output, then test API
curl -X POST http://localhost:3003/api/v1/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{"image":"<PASTE_BASE64_HERE>"}' \
  | jq .
```

Expected: JSON response with species, breed_analysis, description, traits, health_observations, enriched_info

**Git Log Verification:**
```bash
git log --oneline | head -15
```

Expected commits:
- Task 12: Ollama contextual analysis
- Task 13: VisionOrchestrator
- Task 14: Vision route updates
- Task 15: Integration tests

---

## Final Deployment

**Step 1: Rebuild AI service**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence
docker compose build ai-service
```

**Step 2: Restart services**

Run:
```bash
docker compose down
docker compose up -d
```

**Step 3: Verify all services healthy**

Run:
```bash
docker compose ps
curl http://localhost:3004/health
curl http://localhost:3003/health
curl http://localhost:11434/api/tags
```

**Step 4: Run full integration test suite**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
./scripts/run-integration-tests.sh
```

Expected: All integration tests PASS

---

## Success Criteria

✅ **Task 12 Complete:**
- OllamaVisionClient.analyze_with_context() implemented
- Contextual prompts build correctly for purebred/crossbreed
- Unit tests pass (8 tests)

✅ **Task 13 Complete:**
- VisionOrchestrator coordinates full pipeline
- Early rejection at each stage works
- Graceful RAG degradation works
- Unit tests pass (9 tests)

✅ **Task 14 Complete:**
- Vision route uses VisionOrchestrator
- Error handling for all rejection codes
- Integration tests pass (4 tests)

✅ **Task 15 Complete:**
- Full pipeline integration tests created
- Sample image fixtures available
- Test infrastructure ready

✅ **Overall:**
- All unit tests pass (~25+ tests)
- AI service starts successfully
- End-to-end API call returns correct response format
- Pipeline executes all 5 stages
- Logs show clear stage progression

---

## Next Steps (Post-Implementation)

After completing Part 2:

1. **Frontend Updates:** Update React frontend to handle new response format
2. **API Documentation:** Update OpenAPI docs with new response models
3. **Performance Tuning:** Benchmark pipeline latency, tune thresholds
4. **Monitoring:** Add metrics for each pipeline stage
5. **Production Deploy:** Deploy to staging, run smoke tests, promote to production

**Refer to design document for long-term enhancements:**
- Batch processing API
- Image quality scoring
- Caching layer
- Custom fine-tuning

---

**End of Part 2 Implementation Plan**
