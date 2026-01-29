import pytest
from unittest.mock import Mock, AsyncMock, patch

from src.services.rag_service import RAGService
from src.config import Settings


@pytest.fixture
def mock_embedder():
    """Mock embedder."""
    embedder = Mock()
    embedder.embed_text = Mock(return_value=[0.1] * 384)
    return embedder


@pytest.fixture
def mock_ollama():
    """Mock Ollama client."""
    return Mock()


@pytest.fixture
def rag_service(mock_embedder, mock_ollama):
    """Create RAG service with mocks."""
    settings = Settings()
    with patch('chromadb.PersistentClient'):
        service = RAGService(settings, mock_embedder, mock_ollama)
        return service


@pytest.mark.asyncio
async def test_get_breed_context_purebred(rag_service):
    """Test retrieving context for single breed."""
    # Mock ChromaDB query
    mock_results = {
        "documents": [
            ["Golden Retrievers are large sporting dogs known for friendly temperament."],
            ["They require daily exercise and regular grooming."],
            ["Common health issues include hip dysplasia and cancer."]
        ],
        "metadatas": [
            [{"source": "akc_golden_retriever.md"}],
            [{"source": "care_guide.md"}],
            [{"source": "health_guide.md"}]
        ],
        "distances": [[0.2], [0.3], [0.4]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_breed_context("golden_retriever")

    assert result["breed"] == "Golden Retriever"
    assert result["parent_breeds"] is None
    assert "sporting dogs" in result["description"].lower()
    assert "daily exercise" in result["care_summary"].lower()
    assert "hip dysplasia" in result["health_info"].lower()
    assert len(result["sources"]) > 0


@pytest.mark.asyncio
async def test_get_crossbreed_context(rag_service):
    """Test retrieving context for crossbreed (multiple parent breeds)."""
    # Mock ChromaDB query (called twice, once per breed)
    mock_results = {
        "documents": [
            ["Golden Retrievers are large friendly dogs."],
            ["Poodles are intelligent and hypoallergenic."]
        ],
        "metadatas": [
            [{"source": "golden.md"}],
            [{"source": "poodle.md"}]
        ],
        "distances": [[0.2], [0.3]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_crossbreed_context(["Golden Retriever", "Poodle"])

    assert result["breed"] is None
    assert result["parent_breeds"] == ["Golden Retriever", "Poodle"]
    assert "friendly" in result["description"].lower() or "intelligent" in result["description"].lower()
    assert len(result["sources"]) > 0


@pytest.mark.asyncio
async def test_get_breed_context_normalizes_name(rag_service):
    """Test breed name normalization (snake_case to Title Case)."""
    mock_results = {
        "documents": [["Golden Retriever info"]],
        "metadatas": [[{"source": "test.md"}]],
        "distances": [[0.2]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_breed_context("golden_retriever")

    # Verify breed name was normalized to Title Case
    assert result["breed"] == "Golden Retriever"

    # Verify query was called
    assert rag_service._collection.query.called
