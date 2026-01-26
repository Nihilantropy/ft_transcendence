import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from src.routes import rag
from src.services.rag_service import RAGResponse, Source


@pytest.fixture
def mock_rag_service():
    """Mock RAG service."""
    service = Mock()
    service.query = AsyncMock(return_value=RAGResponse(
        answer="Golden Retrievers are prone to hip dysplasia.",
        sources=[
            Source(content="Hip dysplasia info...", source_file="breeds/golden.md", relevance_score=0.92)
        ],
        model="qwen3-vl:8b"
    ))
    service.add_documents = Mock(return_value=3)
    service.get_stats = Mock(return_value={
        "collection_name": "pet_knowledge",
        "document_count": 150
    })
    service.config = Mock()
    service.config.EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    return service


@pytest.fixture
def mock_document_processor():
    """Mock document processor."""
    from src.services.document_processor import Chunk
    processor = Mock()
    processor.process = Mock(return_value=[
        Chunk(content="Chunk 1", metadata={"source_file": "test.md"}),
        Chunk(content="Chunk 2", metadata={"source_file": "test.md"})
    ])
    return processor


@pytest.fixture
def app(mock_rag_service, mock_document_processor):
    """FastAPI test app with mocked services."""
    app = FastAPI()
    app.include_router(rag.router)

    # Inject mocks
    rag.rag_service = mock_rag_service
    rag.document_processor = mock_document_processor

    return app


@pytest.fixture
def client(app):
    """Test client."""
    return TestClient(app)


class TestRAGQueryEndpoint:
    def test_query_success(self, client, mock_rag_service):
        """Test successful RAG query."""
        response = client.post("/api/v1/rag/query", json={
            "question": "What health issues affect Golden Retrievers?"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "answer" in data["data"]
        assert "sources" in data["data"]

    def test_query_with_filters(self, client, mock_rag_service):
        """Test RAG query with metadata filters."""
        response = client.post("/api/v1/rag/query", json={
            "question": "Health issues",
            "filters": {"species": "dog", "breed": "golden_retriever"},
            "top_k": 3
        })

        assert response.status_code == 200
        mock_rag_service.query.assert_called_once()
        call_kwargs = mock_rag_service.query.call_args[1]
        assert call_kwargs["filters"] == {"species": "dog", "breed": "golden_retriever"}

    def test_query_empty_question_fails(self, client):
        """Test empty question returns 422."""
        response = client.post("/api/v1/rag/query", json={
            "question": ""
        })

        assert response.status_code == 422


class TestRAGIngestEndpoint:
    def test_ingest_success(self, client, mock_rag_service, mock_document_processor):
        """Test successful document ingestion."""
        response = client.post("/api/v1/rag/ingest", json={
            "content": "# Golden Retriever\n\nFriendly dogs...",
            "metadata": {"doc_type": "breed", "species": "dog"},
            "source_name": "golden_retriever.md"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "chunks_created" in data["data"]

    def test_ingest_empty_content_fails(self, client):
        """Test ingesting empty content returns 422."""
        response = client.post("/api/v1/rag/ingest", json={
            "content": "",
            "metadata": {},
            "source_name": "test.md"
        })

        assert response.status_code == 422


class TestRAGStatusEndpoint:
    def test_status_success(self, client, mock_rag_service):
        """Test RAG status endpoint."""
        response = client.get("/api/v1/rag/status")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["document_count"] == 150
