import pytest
from pydantic import ValidationError

from src.models.responses import (
    BreedProbability,
    CrossbreedAnalysis,
    BreedAnalysis,
    EnrichedInfo,
    VisionAnalysisData
)


def test_breed_probability_valid():
    """Test BreedProbability with valid data."""
    bp = BreedProbability(breed="golden_retriever", probability=0.89)
    assert bp.breed == "golden_retriever"
    assert bp.probability == 0.89


def test_breed_probability_invalid_range():
    """Test BreedProbability rejects probability > 1.0."""
    with pytest.raises(ValidationError):
        BreedProbability(breed="golden_retriever", probability=1.5)


def test_crossbreed_analysis_with_common_name():
    """Test CrossbreedAnalysis with common name."""
    ca = CrossbreedAnalysis(
        detected_breeds=["Golden Retriever", "Poodle"],
        common_name="Goldendoodle",
        confidence_reasoning="Multiple breeds detected"
    )
    assert ca.common_name == "Goldendoodle"
    assert len(ca.detected_breeds) == 2


def test_breed_analysis_purebred():
    """Test BreedAnalysis for purebred."""
    ba = BreedAnalysis(
        primary_breed="golden_retriever",
        confidence=0.89,
        is_likely_crossbreed=False,
        breed_probabilities=[
            BreedProbability(breed="golden_retriever", probability=0.89)
        ],
        crossbreed_analysis=None
    )
    assert ba.is_likely_crossbreed is False
    assert ba.crossbreed_analysis is None


def test_breed_analysis_crossbreed():
    """Test BreedAnalysis for crossbreed."""
    ba = BreedAnalysis(
        primary_breed="goldendoodle",
        confidence=0.42,
        is_likely_crossbreed=True,
        breed_probabilities=[
            BreedProbability(breed="golden_retriever", probability=0.47),
            BreedProbability(breed="poodle", probability=0.36)
        ],
        crossbreed_analysis=CrossbreedAnalysis(
            detected_breeds=["Golden Retriever", "Poodle"],
            common_name="Goldendoodle",
            confidence_reasoning="Multiple breeds with high probabilities"
        )
    )
    assert ba.is_likely_crossbreed is True
    assert ba.crossbreed_analysis.common_name == "Goldendoodle"


def test_enriched_info_purebred():
    """Test EnrichedInfo for single breed."""
    ei = EnrichedInfo(
        breed="Golden Retriever",
        parent_breeds=None,
        description="Large sporting dog",
        care_summary="Daily exercise",
        health_info="Hip dysplasia",
        sources=["akc.md"]
    )
    assert ei.breed == "Golden Retriever"
    assert ei.parent_breeds is None


def test_enriched_info_crossbreed():
    """Test EnrichedInfo for crossbreed."""
    ei = EnrichedInfo(
        breed=None,
        parent_breeds=["Golden Retriever", "Poodle"],
        description="Mix of two breeds",
        care_summary="Moderate exercise",
        health_info="Varies by parent",
        sources=["akc_golden.md", "akc_poodle.md"]
    )
    assert ei.breed is None
    assert len(ei.parent_breeds) == 2


def test_vision_analysis_data_complete():
    """Test VisionAnalysisData with all fields."""
    data = VisionAnalysisData(
        species="dog",
        breed_analysis=BreedAnalysis(
            primary_breed="golden_retriever",
            confidence=0.89,
            is_likely_crossbreed=False,
            breed_probabilities=[
                BreedProbability(breed="golden_retriever", probability=0.89)
            ],
            crossbreed_analysis=None
        ),
        description="Healthy adult dog",
        traits={"size": "large", "energy_level": "high", "temperament": "friendly"},
        health_observations=["Healthy coat"],
        enriched_info=EnrichedInfo(
            breed="Golden Retriever",
            parent_breeds=None,
            description="Large sporting dog",
            care_summary="Daily exercise",
            health_info="Hip dysplasia",
            sources=["akc.md"]
        )
    )
    assert data.species == "dog"
    assert data.breed_analysis.primary_breed == "golden_retriever"
