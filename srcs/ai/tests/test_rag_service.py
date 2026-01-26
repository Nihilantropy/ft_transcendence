import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from src.services.rag_service import RAGService, RAGResponse, Source
from src.config import Settings


@pytest.fixture
def settings():
    """Test settings."""
    return Settings()


@pytest.fixture
def mock_embedder():
    """Mock embedder service."""
    embedder = Mock()
    embedder.embed.return_value = [0.1] * 384
    embedder.embed_batch.return_value = [[0.1] * 384, [0.2] * 384]
    return embedder


@pytest.fixture
def mock_collection():
    """Mock ChromaDB collection."""
    collection = Mock()
    collection.query.return_value = {
        "ids": [["chunk_1", "chunk_2"]],
        "documents": [["Golden Retrievers are prone to hip dysplasia.", "Regular exercise is important."]],
        "metadatas": [[
            {"source_file": "breeds/golden_retriever.md", "doc_type": "breed"},
            {"source_file": "care/exercise.md", "doc_type": "care_guide"}
        ]],
        "distances": [[0.15, 0.25]]
    }
    collection.count.return_value = 100
    return collection


@pytest.fixture
def mock_ollama_client():
    """Mock Ollama client for text generation."""
    client = Mock()
    client.generate = AsyncMock(return_value="Golden Retrievers need regular vet checkups for hip health.")
    return client


@pytest.fixture
def rag_service(settings, mock_embedder, mock_collection, mock_ollama_client):
    """RAG service with mocked dependencies."""
    with patch('src.services.rag_service.chromadb') as mock_chroma:
        mock_client = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chroma.PersistentClient.return_value = mock_client

        service = RAGService(
            config=settings,
            embedder=mock_embedder,
            ollama_client=mock_ollama_client
        )
        service._collection = mock_collection
        return service


class TestRAGService:
    def test_init_creates_collection(self, settings, mock_embedder, mock_ollama_client):
        """Test RAG service creates ChromaDB collection on init."""
        with patch('src.services.rag_service.chromadb') as mock_chroma:
            mock_client = Mock()
            mock_client.get_or_create_collection.return_value = Mock()
            mock_chroma.PersistentClient.return_value = mock_client

            service = RAGService(settings, mock_embedder, mock_ollama_client)

            mock_chroma.PersistentClient.assert_called_once()
            mock_client.get_or_create_collection.assert_called_once_with(
                name=settings.CHROMA_COLLECTION_NAME
            )

    @pytest.mark.asyncio
    async def test_query_returns_rag_response(self, rag_service):
        """Test query returns structured RAGResponse."""
        response = await rag_service.query(
            question="What health issues affect Golden Retrievers?",
            filters={"breed": "golden_retriever"},
            top_k=5
        )

        assert isinstance(response, RAGResponse)
        assert response.answer is not None
        assert len(response.sources) > 0

    @pytest.mark.asyncio
    async def test_query_embeds_question(self, rag_service, mock_embedder):
        """Test query embeds the question for search."""
        await rag_service.query(
            question="What health issues affect Golden Retrievers?",
            filters={},
            top_k=5
        )

        mock_embedder.embed.assert_called_once_with(
            "What health issues affect Golden Retrievers?"
        )

    @pytest.mark.asyncio
    async def test_query_searches_collection(self, rag_service, mock_collection):
        """Test query searches ChromaDB collection."""
        await rag_service.query(
            question="Health issues",
            filters={"species": "dog"},
            top_k=3
        )

        mock_collection.query.assert_called_once()
        call_kwargs = mock_collection.query.call_args[1]
        assert call_kwargs["n_results"] == 3
        assert call_kwargs["where"] == {"species": "dog"}

    @pytest.mark.asyncio
    async def test_query_without_filters(self, rag_service, mock_collection):
        """Test query without filters searches all documents."""
        await rag_service.query(
            question="General pet care",
            filters=None,
            top_k=5
        )

        call_kwargs = mock_collection.query.call_args[1]
        assert "where" not in call_kwargs or call_kwargs["where"] is None

    @pytest.mark.asyncio
    async def test_query_sources_include_metadata(self, rag_service):
        """Test response sources include metadata and relevance scores."""
        response = await rag_service.query(
            question="Health issues",
            filters={},
            top_k=5
        )

        assert len(response.sources) > 0
        source = response.sources[0]
        assert isinstance(source, Source)
        assert source.content is not None
        assert source.source_file is not None
        assert source.relevance_score is not None

    def test_add_documents_to_collection(self, rag_service, mock_embedder, mock_collection):
        """Test adding documents to the collection."""
        from src.services.document_processor import Chunk

        chunks = [
            Chunk(content="Content one", metadata={"source_file": "doc1.md"}),
            Chunk(content="Content two", metadata={"source_file": "doc2.md"})
        ]

        rag_service.add_documents(chunks)

        mock_embedder.embed_batch.assert_called_once()
        mock_collection.add.assert_called_once()

    def test_get_collection_stats(self, rag_service, mock_collection):
        """Test getting collection statistics."""
        stats = rag_service.get_stats()

        assert stats["document_count"] == 100
        assert stats["collection_name"] == "pet_knowledge"


class TestRAGResponseModel:
    def test_rag_response_structure(self):
        """Test RAGResponse dataclass structure."""
        source = Source(
            content="Test content",
            source_file="test.md",
            relevance_score=0.85
        )
        response = RAGResponse(
            answer="Test answer",
            sources=[source],
            model="qwen3-vl:8b"
        )

        assert response.answer == "Test answer"
        assert len(response.sources) == 1
        assert response.model == "qwen3-vl:8b"
