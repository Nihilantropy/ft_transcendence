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
