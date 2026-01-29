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
    data = response.json()["detail"]  # FastAPI wraps in "detail"
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
    data = response.json()["detail"]  # FastAPI wraps in "detail"
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
    data = response.json()["detail"]  # FastAPI wraps in "detail"
    assert data["error"]["code"] == "VISION_SERVICE_UNAVAILABLE"


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/api/v1/vision/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
