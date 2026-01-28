import pytest
from PIL import Image
from src.models.species_classifier import SpeciesClassifier
from src.config import settings


@pytest.fixture
def classifier():
    """Create species classifier (CPU for testing)."""
    return SpeciesClassifier(device="cpu", model_id=settings.SPECIES_MODEL)


@pytest.fixture
def sample_image():
    """Create a sample image."""
    return Image.new('RGB', (224, 224), color='green')


def test_species_classifier_initialization(classifier):
    """Test species classifier initializes correctly."""
    assert classifier.device == "cpu"
    assert classifier.model is not None
    assert classifier.processor is not None


def test_predict_returns_top_species(classifier, sample_image):
    """Test prediction returns top species with confidence."""
    result = classifier.predict(sample_image, top_k=3)

    assert "species" in result
    assert "confidence" in result
    assert "top_predictions" in result
    assert isinstance(result["species"], str)
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["top_predictions"]) == 3
    assert all("label" in pred and "confidence" in pred for pred in result["top_predictions"])


def test_top_k_parameter(classifier, sample_image):
    """Test top_k parameter controls number of predictions."""
    result = classifier.predict(sample_image, top_k=5)

    assert len(result["top_predictions"]) == 5


def test_predictions_sorted_descending(classifier, sample_image):
    """Test predictions are sorted by confidence descending."""
    result = classifier.predict(sample_image, top_k=5)

    confidences = [pred["confidence"] for pred in result["top_predictions"]]
    assert confidences == sorted(confidences, reverse=True)
