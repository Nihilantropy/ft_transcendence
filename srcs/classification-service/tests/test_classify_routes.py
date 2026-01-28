import pytest
from fastapi.testclient import TestClient
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
    """Create test client."""
    from src.main import app
    return TestClient(app)


def test_classify_content_endpoint(client, sample_image_base64):
    """Test POST /classify/content endpoint."""
    response = client.post(
        "/classify/content",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 200
    data = response.json()
    assert "is_safe" in data
    assert "nsfw_probability" in data
    assert "threshold" in data
    assert isinstance(data["is_safe"], bool)


def test_classify_species_endpoint(client, sample_image_base64):
    """Test POST /classify/species endpoint."""
    response = client.post(
        "/classify/species",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 200
    data = response.json()
    assert "species" in data
    assert "confidence" in data
    assert "top_predictions" in data
    assert len(data["top_predictions"]) == 3  # Default top_k


def test_classify_breed_endpoint_dog(client, sample_image_base64):
    """Test POST /classify/breed endpoint for dog."""
    response = client.post(
        "/classify/breed",
        json={
            "image": sample_image_base64,
            "species": "dog",
            "top_k": 5
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "breed_analysis" in data
    assert "primary_breed" in data["breed_analysis"]
    assert "confidence" in data["breed_analysis"]
    assert "is_likely_crossbreed" in data["breed_analysis"]
    assert len(data["breed_analysis"]["breed_probabilities"]) == 5


def test_classify_breed_invalid_species(client, sample_image_base64):
    """Test breed classification with invalid species."""
    response = client.post(
        "/classify/breed",
        json={
            "image": sample_image_base64,
            "species": "rabbit",
            "top_k": 5
        }
    )

    assert response.status_code == 422  # Validation error


def test_classify_content_invalid_image(client):
    """Test content classification with invalid base64."""
    response = client.post(
        "/classify/content",
        json={"image": "invalid_base64"}
    )

    assert response.status_code == 422
