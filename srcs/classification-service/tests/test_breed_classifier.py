import pytest
from PIL import Image
from src.models.breed_classifier import DogBreedClassifier, CatBreedClassifier
from src.config import settings


@pytest.fixture
def dog_classifier():
    """Create dog breed classifier (CPU for testing)."""
    return DogBreedClassifier(device="cpu", model_id=settings.DOG_BREED_MODEL)


@pytest.fixture
def cat_classifier():
    """Create cat breed classifier (CPU for testing)."""
    return CatBreedClassifier(device="cpu", model_id=settings.CAT_BREED_MODEL)


@pytest.fixture
def sample_image():
    """Create a sample image."""
    return Image.new('RGB', (224, 224), color='brown')


def test_dog_classifier_initialization(dog_classifier):
    """Test dog breed classifier initializes correctly."""
    assert dog_classifier.device == "cpu"
    assert dog_classifier.model is not None
    assert dog_classifier.processor is not None


def test_cat_classifier_initialization(cat_classifier):
    """Test cat breed classifier initializes correctly."""
    assert cat_classifier.device == "cpu"
    assert cat_classifier.model is not None


def test_dog_predict_returns_top_k(dog_classifier, sample_image):
    """Test dog classifier returns top-K breed predictions."""
    result = dog_classifier.predict(sample_image, top_k=5)

    assert len(result) == 5
    assert all("breed" in pred and "probability" in pred for pred in result)
    assert all(0.0 <= pred["probability"] <= 1.0 for pred in result)


def test_cat_predict_returns_top_k(cat_classifier, sample_image):
    """Test cat classifier returns top-K breed predictions."""
    result = cat_classifier.predict(sample_image, top_k=5)

    assert len(result) == 5
    assert all("breed" in pred and "probability" in pred for pred in result)


def test_predictions_sorted_descending(dog_classifier, sample_image):
    """Test predictions are sorted by probability descending."""
    result = dog_classifier.predict(sample_image, top_k=5)

    probabilities = [pred["probability"] for pred in result]
    assert probabilities == sorted(probabilities, reverse=True)


def test_probabilities_sum_to_one(dog_classifier, sample_image):
    """Test all probabilities sum to approximately 1.0."""
    # Get all predictions
    result = dog_classifier.predict(sample_image, top_k=120)  # All breeds

    total_prob = sum(pred["probability"] for pred in result)
    assert 0.99 <= total_prob <= 1.01  # Allow small floating point error
