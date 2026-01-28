import pytest
from PIL import Image
from src.models.nsfw_detector import NSFWDetector
from src.config import settings


@pytest.fixture
def detector():
    """Create NSFW detector (CPU for testing)."""
    return NSFWDetector(device="cpu", model_id=settings.NSFW_MODEL)


@pytest.fixture
def safe_image():
    """Create a simple safe image (solid color)."""
    return Image.new('RGB', (224, 224), color='blue')


def test_nsfw_detector_initialization(detector):
    """Test NSFW detector initializes correctly."""
    assert detector.device == "cpu"
    assert detector.model is not None
    assert detector.processor is not None


def test_predict_safe_image(detector, safe_image):
    """Test predicting on a safe image."""
    result = detector.predict(safe_image)

    assert "is_safe" in result
    assert "nsfw_probability" in result
    assert isinstance(result["is_safe"], bool)
    assert 0.0 <= result["nsfw_probability"] <= 1.0


def test_predict_returns_low_nsfw_for_solid_color(detector, safe_image):
    """Test that solid color image has low NSFW probability."""
    result = detector.predict(safe_image)

    # Solid color should be very safe
    assert result["is_safe"] is True
    assert result["nsfw_probability"] < 0.5
