"""Tests for RAG API routes."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import Request
from pathlib import Path

from src.main import app
from src.routes import rag
from src.config import Settings
from src.middleware.localhost import require_localhost


@pytest.fixture
def mock_rag_service():
    """Mock RAG service."""
    service = Mock()
    service.config = Settings()
    service.get_stats = Mock(return_value={
        "collection_name": "pet_knowledge",
        "document_count": 10
    })
    service.add_documents = Mock(return_value=5)
    return service


@pytest.fixture
def mock_document_processor():
    """Mock document processor."""
    processor = Mock()
    processor.process = Mock(return_value=[
        Mock(content="chunk1", metadata={"source": "test.md"}),
        Mock(content="chunk2", metadata={"source": "test.md"}),
    ])
    return processor


@pytest.fixture
def localhost_allowed():
    """Dependency override that allows localhost access."""
    async def _override():
        return True
    return _override


@pytest.fixture
def localhost_blocked():
    """Dependency override that blocks access."""
    from fastapi import HTTPException, status
    async def _override():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Access denied"}}
        )
    return _override


@pytest.fixture
def client(mock_rag_service, mock_document_processor):
    """Create test client with mocked services."""
    rag.rag_service = mock_rag_service
    rag.document_processor = mock_document_processor
    return TestClient(app)


@pytest.fixture
def client_localhost(client, localhost_allowed):
    """Create test client with localhost access allowed."""
    app.dependency_overrides[require_localhost] = localhost_allowed
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client_external(client, localhost_blocked):
    """Create test client simulating external access."""
    app.dependency_overrides[require_localhost] = localhost_blocked
    yield client
    app.dependency_overrides.clear()


class TestLocalhostOnlyAccess:
    """Test that admin endpoints are restricted to localhost."""

    def test_initialize_from_localhost_allowed(self, client_localhost, mock_rag_service, tmp_path):
        """Test that initialize endpoint accepts requests from localhost."""
        # Create mock knowledge base directory with test file
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()
        test_file = kb_dir / "test.md"
        test_file.write_text("# Test\nTest content")

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)

        # Simulate localhost request
        response = client_localhost.post("/api/v1/admin/rag/initialize")

        # Should not be forbidden
        assert response.status_code != 403

    def test_initialize_from_external_blocked(self, client_external, mock_rag_service, tmp_path):
        """Test that initialize endpoint blocks non-localhost requests."""
        # Create mock knowledge base directory with test file
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()
        test_file = kb_dir / "test.md"
        test_file.write_text("# Test\nTest content")

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)

        # Simulate external request
        response = client_external.post("/api/v1/admin/rag/initialize")

        # Should be blocked by localhost dependency
        assert response.status_code == 403

    def test_regular_endpoints_accessible_from_anywhere(self, client, mock_rag_service):
        """Test that regular RAG endpoints are not restricted."""
        # Query endpoint should be accessible from any host
        response = client.post(
            "/api/v1/rag/query",
            json={"question": "test question"},
            headers={"Host": "external.example.com"}
        )

        # Should not be blocked (may fail for other reasons, but not host check)
        assert response.status_code != 400


class TestInitializeEndpoint:
    """Test the knowledge base initialization endpoint."""

    def test_initialize_success(self, client_localhost, mock_rag_service, mock_document_processor, tmp_path):
        """Test successful bulk ingestion of knowledge base."""
        # Create mock knowledge base with multiple files
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()

        # Create test markdown files
        (kb_dir / "breeds").mkdir()
        (kb_dir / "breeds" / "golden_retriever.md").write_text(
            "---\nbreed: golden_retriever\n---\n# Golden Retriever\nFriendly dog."
        )
        (kb_dir / "breeds" / "poodle.md").write_text(
            "---\nbreed: poodle\n---\n# Poodle\nIntelligent dog."
        )
        (kb_dir / "health").mkdir()
        (kb_dir / "health" / "hip_dysplasia.md").write_text(
            "# Hip Dysplasia\nCommon in large breeds."
        )

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)

        # Mock add_documents to return different counts
        mock_rag_service.add_documents.side_effect = [5, 4, 3]

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert data["data"]["files_processed"] == 3
        assert data["data"]["total_chunks_created"] == 12  # 5 + 4 + 3
        assert data["data"]["files_skipped"] == 0
        assert len(data["data"]["errors"]) == 0

    def test_initialize_with_errors(self, client_localhost, mock_rag_service, mock_document_processor, tmp_path):
        """Test initialization handles errors gracefully."""
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()

        # Create valid and invalid files
        (kb_dir / "valid.md").write_text("# Valid\nContent")
        (kb_dir / "invalid.md").write_text("# Invalid\nContent")

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)

        # Mock processor to fail on second file
        mock_document_processor.process.side_effect = [
            [Mock(content="chunk1", metadata={})],  # Success
            ValueError("Invalid frontmatter")  # Error
        ]

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["files_processed"] == 1
        assert data["data"]["files_skipped"] == 1
        assert len(data["data"]["errors"]) == 1
        assert "invalid.md" in data["data"]["errors"][0]

    def test_initialize_directory_not_found(self, client_localhost, mock_rag_service):
        """Test initialization fails gracefully when directory doesn't exist."""
        mock_rag_service.config.KNOWLEDGE_BASE_DIR = "/nonexistent/path"

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 404
        data = response.json()
        # HTTPException wraps error_response in detail field
        assert "detail" in data
        detail = data["detail"]
        assert detail["success"] is False
        assert detail["error"]["code"] == "DIRECTORY_NOT_FOUND"

    def test_initialize_service_not_initialized(self, client_localhost):
        """Test initialization fails when services are not available."""
        # Set services to None
        rag.rag_service = None
        rag.document_processor = None

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 503
        data = response.json()
        # HTTPException wraps error_response in detail field
        assert "detail" in data
        detail = data["detail"]
        assert detail["success"] is False
        assert detail["error"]["code"] == "SERVICE_UNAVAILABLE"

    def test_initialize_recursive_subdirectories(self, client_localhost, mock_rag_service, mock_document_processor, tmp_path):
        """Test that initialization walks through all subdirectories."""
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()

        # Create nested directory structure
        (kb_dir / "level1").mkdir()
        (kb_dir / "level1" / "level2").mkdir()
        (kb_dir / "level1" / "level2" / "deep.md").write_text("# Deep\nNested content")
        (kb_dir / "root.md").write_text("# Root\nRoot content")

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)
        mock_rag_service.add_documents.return_value = 2

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 200
        data = response.json()

        # Should find both files in nested structure
        assert data["data"]["files_processed"] == 2

    def test_initialize_only_processes_markdown_files(self, client_localhost, mock_rag_service, mock_document_processor, tmp_path):
        """Test that only .md files are processed."""
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()

        # Create various file types
        (kb_dir / "doc.md").write_text("# Markdown\nContent")
        (kb_dir / "text.txt").write_text("Plain text")
        (kb_dir / "data.json").write_text('{"key": "value"}')
        (kb_dir / "README").write_text("Readme without extension")

        mock_rag_service.config.KNOWLEDGE_BASE_DIR = str(kb_dir)
        mock_rag_service.add_documents.return_value = 3

        response = client_localhost.post("/api/v1/admin/rag/initialize")

        assert response.status_code == 200
        data = response.json()

        # Should only process the .md file
        assert data["data"]["files_processed"] == 1
