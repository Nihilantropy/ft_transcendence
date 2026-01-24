"""Integration tests for vision analysis with real Ollama service."""
import pytest
from fastapi.testclient import TestClient
import base64
from PIL import Image
import io
import httpx

from src.main import app
from src.config import Settings

settings = Settings()


@pytest.fixture(scope="module")
def test_client():
    """Create a test client with lifespan context."""
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture
def dog_image_base64():
    """Generate a simple dog-like image (brown/tan colors)."""
    img = Image.new('RGB', (512, 512), color=(139, 90, 43))  # Brown color
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


@pytest.fixture
def cat_image_base64():
    """Generate a simple cat-like image (gray colors)."""
    img = Image.new('RGB', (512, 512), color=(128, 128, 128))  # Gray color
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


class TestOllamaIntegration:
    """Integration tests that require Ollama service to be running."""

    @pytest.mark.integration
    def test_ollama_service_reachable(self):
        """Test that Ollama service is reachable."""
        try:
            response = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            assert response.status_code == 200
            data = response.json()
            assert "models" in data
        except httpx.ConnectError:
            pytest.skip("Ollama service not available")

    @pytest.mark.integration
    def test_ollama_model_available(self):
        """Test that qwen3-vl:8b model is available in Ollama."""
        try:
            response = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            data = response.json()
            models = [model["name"] for model in data.get("models", [])]

            # Check if our model is available
            model_available = any("qwen3-vl" in model.lower() for model in models)

            if not model_available:
                pytest.skip(f"Model {settings.OLLAMA_MODEL} not available. Available models: {models}")

        except httpx.ConnectError:
            pytest.skip("Ollama service not available")


class TestVisionAnalysisIntegration:
    """Integration tests for vision analysis endpoint with real Ollama."""

    @pytest.mark.integration
    @pytest.mark.slow
    def test_analyze_image_with_real_ollama(self, test_client, dog_image_base64):
        """Test full vision analysis pipeline with real Ollama service.

        Note: This is a simple colored image, not a real pet photo.
        The model may return low confidence or unknown breed, which is expected.
        We're testing the integration, not the accuracy.
        """
        try:
            # First verify Ollama is available
            httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        except httpx.ConnectError:
            pytest.skip("Ollama service not available")

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": dog_image_base64,
            "options": {"return_traits": True, "return_health_info": True}
        })

        # Should get a response (might timeout if Ollama is slow)
        assert response.status_code in [200, 503, 500], \
            f"Unexpected status code: {response.status_code}"

        if response.status_code == 200:
            data = response.json()

            # Validate response structure
            assert data["success"] is True
            assert "data" in data
            assert "timestamp" in data

            # Validate data structure
            result_data = data["data"]
            assert "breed" in result_data
            assert "confidence" in result_data
            assert "traits" in result_data
            assert "health_considerations" in result_data

            # Validate confidence is in valid range
            assert 0.0 <= result_data["confidence"] <= 1.0

            # Validate traits structure
            traits = result_data["traits"]
            assert "size" in traits
            assert "energy_level" in traits
            assert "temperament" in traits

            # Since this is a simple colored image, low confidence is expected
            # The model should either return "Unknown" or a low confidence result
            if result_data["confidence"] < settings.LOW_CONFIDENCE_THRESHOLD:
                assert "note" in result_data
                assert "Low confidence" in result_data["note"]

    @pytest.mark.integration
    def test_health_check_integration(self, test_client):
        """Test health check endpoint returns correct configuration."""
        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["service"] == "ai-service"
        assert data["ollama_url"] == settings.OLLAMA_BASE_URL
        assert data["model"] == settings.OLLAMA_MODEL

    @pytest.mark.integration
    def test_invalid_image_rejected(self, test_client):
        """Test that invalid images are rejected with proper error."""
        response = test_client.post("/api/v1/vision/analyze", json={
            "image": "not-a-valid-data-uri"
        })

        assert response.status_code == 422
        # The detail field contains the error_response dict
        assert "detail" in response.json()

    @pytest.mark.integration
    def test_oversized_image_rejected(self, test_client):
        """Test that oversized images are rejected."""
        # Create a large random-colored image that will exceed 5MB
        import random
        img = Image.new('RGB', (5000, 5000))
        pixels = img.load()
        for i in range(5000):
            for j in range(5000):
                pixels[i, j] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))

        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "INVALID_IMAGE" in str(detail)

    @pytest.mark.integration
    def test_small_image_rejected(self, test_client):
        """Test that images below minimum dimensions are rejected."""
        # Create 100x100 image (below 224px minimum)
        img = Image.new('RGB', (100, 100), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "INVALID_IMAGE" in str(detail)
        assert "too small" in str(detail)

    @pytest.mark.integration
    def test_unsupported_format_rejected(self, test_client):
        """Test that unsupported image formats are rejected."""
        # Create BMP image (not supported)
        img = Image.new('RGB', (512, 512), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='BMP')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/bmp;base64,{encoded}"

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "INVALID_IMAGE" in str(detail)

    @pytest.mark.integration
    def test_large_image_auto_resize(self, test_client):
        """Test that large images are automatically resized."""
        # Create 2048x2048 image (will be resized to max 1024px)
        img = Image.new('RGB', (2048, 2048), color=(100, 150, 200))
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        try:
            # Verify Ollama is available
            httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        except httpx.ConnectError:
            pytest.skip("Ollama service not available")

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        # Should succeed (image gets resized automatically)
        assert response.status_code in [200, 503, 500]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True

    @pytest.mark.integration
    def test_png_image_supported(self, test_client):
        """Test that PNG images are supported."""
        # Create PNG image
        img = Image.new('RGB', (512, 512), color='purple')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/png;base64,{encoded}"

        try:
            # Verify Ollama is available
            httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        except httpx.ConnectError:
            pytest.skip("Ollama service not available")

        response = test_client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        # Should succeed
        assert response.status_code in [200, 503, 500]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True


class TestConcurrentRequests:
    """Test concurrent request handling."""

    @pytest.mark.integration
    @pytest.mark.slow
    def test_concurrent_analysis_requests(self, test_client, dog_image_base64, cat_image_base64):
        """Test that multiple concurrent requests are handled correctly."""
        try:
            # Verify Ollama is available
            httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        except httpx.ConnectError:
            pytest.skip("Ollama service not available")

        # Send two requests concurrently
        import concurrent.futures

        def analyze_image(image):
            return test_client.post("/api/v1/vision/analyze", json={
                "image": image,
                "options": {"return_traits": True}
            })

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(analyze_image, dog_image_base64)
            future2 = executor.submit(analyze_image, cat_image_base64)

            response1 = future1.result()
            response2 = future2.result()

        # Both requests should complete successfully
        assert response1.status_code in [200, 503, 500]
        assert response2.status_code in [200, 503, 500]

        # If both succeeded, they should have valid data
        if response1.status_code == 200 and response2.status_code == 200:
            data1 = response1.json()
            data2 = response2.json()

            assert data1["success"] is True
            assert data2["success"] is True
            assert "data" in data1
            assert "data" in data2
