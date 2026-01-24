import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import base64
from PIL import Image
import io

# Import will fail initially - that's expected
from src.main import app

client = TestClient(app)

@pytest.fixture
def valid_image_base64():
    """Generate valid test image."""
    img = Image.new('RGB', (512, 512), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def mock_ollama_response():
    """Mock successful Ollama response."""
    return {
        "breed": "Golden Retriever",
        "confidence": 0.92,
        "traits": {
            "size": "large",
            "energy_level": "high",
            "temperament": "friendly"
        },
        "health_considerations": ["Hip dysplasia"]
    }

class TestVisionEndpoint:
    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_successful_analysis(self, mock_processor, mock_client,
                                 valid_image_base64, mock_ollama_response):
        """Test successful vision analysis."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(return_value=mock_ollama_response)

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64,
            "options": {"return_traits": True, "return_health_info": True}
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["breed"] == "Golden Retriever"
        assert data["data"]["confidence"] == 0.92
        assert "timestamp" in data

    def test_invalid_image_format(self):
        """Test invalid image format returns 422."""
        response = client.post("/api/v1/vision/analyze", json={
            "image": "not-a-valid-image"
        })

        assert response.status_code == 422

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_image_validation_error(self, mock_processor, mock_client, valid_image_base64):
        """Test image validation error returns 422."""
        mock_processor.process_image.side_effect = ValueError("Image too large")

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 422
        data = response.json()
        assert "INVALID_IMAGE" in str(data)

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_ollama_failure_returns_503(self, mock_processor, mock_client, valid_image_base64):
        """Test Ollama connection failure returns 503."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(side_effect=ConnectionError("Ollama unreachable"))

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 503
        data = response.json()
        assert "VISION_SERVICE_UNAVAILABLE" in str(data)

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_unexpected_error_returns_500(self, mock_processor, mock_client, valid_image_base64):
        """Test unexpected error returns 500."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(side_effect=Exception("Unexpected error"))

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 500
        data = response.json()
        assert "INTERNAL_ERROR" in str(data)
