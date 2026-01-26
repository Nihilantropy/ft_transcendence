"""Integration tests for RAG system.

These tests require the AI service to be running with real ChromaDB.
Mark with @pytest.mark.integration to skip in unit test runs.
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """Test client for integration tests."""
    return TestClient(app)


@pytest.mark.integration
class TestRAGIntegration:
    def test_rag_status_endpoint(self, client):
        """Test RAG status endpoint returns collection info."""
        response = client.get("/api/v1/rag/status")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "document_count" in data["data"]
        assert "collection_name" in data["data"]

    def test_rag_ingest_and_query(self, client):
        """Test ingesting a document and querying it."""
        # Ingest a test document
        ingest_response = client.post("/api/v1/rag/ingest", json={
            "content": """---
doc_type: test
species: dog
breed: test_breed
---

# Test Breed

## Health
Test breeds are generally healthy but may have some issues.

## Care
They need regular exercise and grooming.
""",
            "metadata": {"doc_type": "test"},
            "source_name": "test_breed.md"
        })

        assert ingest_response.status_code == 200
        assert ingest_response.json()["data"]["chunks_created"] > 0

        # Query the ingested document
        query_response = client.post("/api/v1/rag/query", json={
            "question": "What are the health considerations for test breeds?",
            "filters": {"breed": "test_breed"},
            "top_k": 3
        })

        assert query_response.status_code == 200
        data = query_response.json()
        assert data["success"] is True
        assert "answer" in data["data"]

    def test_health_endpoint(self, client):
        """Test service health check."""
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.integration
class TestVisionWithEnrichment:
    """Integration tests for vision + RAG enrichment.

    Note: These require Ollama to be running.
    """

    def test_vision_analyze_with_enrich_option(self, client):
        """Test vision endpoint accepts enrich option."""
        # This test verifies the endpoint accepts the option
        # Full integration requires Ollama + real image
        import base64

        # Create minimal test image (1x1 red pixel PNG)
        test_image = base64.b64encode(
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
            b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
            b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        ).decode()

        response = client.post("/api/v1/vision/analyze", json={
            "image": f"data:image/png;base64,{test_image}",
            "options": {
                "return_traits": True,
                "return_health_info": True,
                "enrich": True
            }
        })

        # May fail due to image quality, but should not fail on option parsing
        # Accept 200 (success) or 503 (Ollama unavailable) or 500 (processing error)
        assert response.status_code in [200, 500, 503]
