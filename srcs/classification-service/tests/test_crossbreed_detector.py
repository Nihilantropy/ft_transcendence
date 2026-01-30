import pytest
from src.services.crossbreed_detector import CrossbreedDetector
from src.config import Settings


@pytest.fixture
def detector():
    """Create CrossbreedDetector with default settings."""
    settings = Settings()
    return CrossbreedDetector(settings)


def test_detect_crossbreed_high_second_probability(detector):
    """Test crossbreed detection when second breed probability > 0.35."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.47},
        {"breed": "poodle", "probability": 0.36},
        {"breed": "labrador_retriever", "probability": 0.10},
        {"breed": "cocker_spaniel", "probability": 0.05},
        {"breed": "beagle", "probability": 0.02}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["primary_breed"] == "goldendoodle"
    assert result["confidence"] == 0.41  # (0.47 + 0.36) / 2 = 0.415 → rounds to 0.41
    assert result["is_likely_crossbreed"] is True
    assert result["crossbreed_analysis"]["common_name"] == "Goldendoodle"
    assert "Golden Retriever" in result["crossbreed_analysis"]["detected_breeds"]
    assert "Poodle" in result["crossbreed_analysis"]["detected_breeds"]


def test_detect_purebred_high_confidence(detector):
    """Test purebred detection when top breed has high confidence."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.89},
        {"breed": "labrador_retriever", "probability": 0.06},
        {"breed": "flat_coated_retriever", "probability": 0.03},
        {"breed": "english_setter", "probability": 0.01},
        {"breed": "irish_setter", "probability": 0.01}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["primary_breed"] == "golden_retriever"
    assert result["confidence"] == 0.89
    assert result["is_likely_crossbreed"] is False
    assert result["crossbreed_analysis"] is None


def test_detect_crossbreed_low_confidence_small_gap(detector):
    """Test crossbreed when top breed < 0.75 AND gap < 0.30."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.55},
        {"breed": "labrador_retriever", "probability": 0.30},
        {"breed": "flat_coated_retriever", "probability": 0.10},
        {"breed": "english_setter", "probability": 0.03},
        {"breed": "irish_setter", "probability": 0.02}
    ]

    result = detector.process_breed_result(probabilities)

    # Gap = 0.55 - 0.30 = 0.25 < 0.30, so crossbreed
    assert result["is_likely_crossbreed"] is True
    assert result["confidence"] == 0.43  # (0.55 + 0.30) / 2 = 0.425 → rounds to 0.43


def test_identify_common_crossbreed_name(detector):
    """Test common crossbreed name identification."""
    assert detector.identify_common_name(["Golden Retriever", "Poodle"]) == "Goldendoodle"
    assert detector.identify_common_name(["Poodle", "Golden Retriever"]) == "Goldendoodle"  # Reversed
    assert detector.identify_common_name(["Labrador Retriever", "Poodle"]) == "Labradoodle"
    assert detector.identify_common_name(["Pug", "Beagle"]) == "Puggle"
    assert detector.identify_common_name(["Chihuahua", "Dachshund"]) == "Chiweenie"
    assert detector.identify_common_name(["Husky", "Chihuahua"]) is None  # Unknown


def test_empty_probabilities(detector):
    """Test handling of empty probabilities list."""
    result = detector.process_breed_result([])

    assert result["primary_breed"] == "unknown"
    assert result["confidence"] == 0.0
    assert result["is_likely_crossbreed"] is False
    assert result["breed_probabilities"] == []


def test_reject_crossbreed_when_second_breed_is_noise(detector):
    """Test that low confidence with negligible second breed is NOT crossbreed.

    Bug reproduction: Golden Retriever at 26%, Labrador at 2%
    - Top < 75%: YES
    - Gap (24%) < 30%: YES
    - Second breed (2%) is just noise: Should NOT be crossbreed
    """
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.26},
        {"breed": "labrador_retriever", "probability": 0.02},
        {"breed": "great_pyrenees", "probability": 0.01},
        {"breed": "tibetan_mastiff", "probability": 0.01},
        {"breed": "newfoundland", "probability": 0.01}
    ]

    result = detector.process_breed_result(probabilities)

    # Should be purebred (uncertain, but not a crossbreed)
    assert result["primary_breed"] == "golden_retriever"
    assert result["confidence"] == 0.26
    assert result["is_likely_crossbreed"] is False
    assert result["crossbreed_analysis"] is None
