import hashlib

import pytest
from unittest.mock import Mock, AsyncMock, patch

from src.services.rag_service import RAGService, Source
from src.services.document_processor import Chunk
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


@pytest.mark.asyncio
async def test_get_breed_context_extracts_source_file_from_metadata(rag_service):
    """Test that source_file metadata is correctly extracted (not 'source')."""
    # This is the ACTUAL metadata format from document_processor
    mock_results = {
        "documents": [
            ["Golden Retrievers are friendly and intelligent."],
            ["They need regular exercise and grooming."],
            ["Common health issues include hip dysplasia."]
        ],
        "metadatas": [
            [{"source_file": "breeds/dogs/golden_retriever.md", "source_type": "knowledge_base"}],
            [{"source_file": "care/exercise.md", "source_type": "knowledge_base"}],
            [{"source_file": "health/hip_dysplasia.md", "source_type": "knowledge_base"}]
        ],
        "distances": [[0.2], [0.3], [0.4]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_breed_context("golden_retriever")

    # Should extract source_file, not fall back to "unknown"
    assert "breeds/dogs/golden_retriever.md" in result["sources"]
    assert "care/exercise.md" in result["sources"]
    assert "health/hip_dysplasia.md" in result["sources"]
    assert "unknown" not in result["sources"]


@pytest.mark.asyncio
async def test_get_crossbreed_context_extracts_source_file_from_metadata(rag_service):
    """Test crossbreed source extraction uses correct metadata key."""
    mock_results = {
        "documents": [
            ["Golden Retrievers are friendly."],
            ["Poodles are intelligent and hypoallergenic."]
        ],
        "metadatas": [
            [{"source_file": "breeds/dogs/golden_retriever.md", "chunk_index": 0}],
            [{"source_file": "breeds/dogs/poodle.md", "chunk_index": 0}]
        ],
        "distances": [[0.2], [0.3]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_crossbreed_context(["Golden Retriever", "Poodle"])

    # Should extract source_file correctly
    assert "breeds/dogs/golden_retriever.md" in result["sources"]
    assert "breeds/dogs/poodle.md" in result["sources"]
    assert "unknown" not in result["sources"]


# --- query ---

@pytest.mark.asyncio
async def test_query_returns_rag_response(rag_service, mock_embedder, mock_ollama):
    mock_embedder.embed = Mock(return_value=[0.1] * 384)
    mock_ollama.generate = AsyncMock(return_value="Golden retrievers are friendly dogs.")
    rag_service._collection.query = Mock(return_value={
        "ids": [["chunk_1", "chunk_2"]],
        "documents": [["Golden retrievers are friendly.", "They need exercise."]],
        "metadatas": [[{"source_file": "golden.md"}, {"source_file": "care.md"}]],
        "distances": [[0.1, 0.3]]
    })

    response = await rag_service.query("Tell me about golden retrievers")

    assert response.answer == "Golden retrievers are friendly dogs."
    assert len(response.sources) == 2
    assert response.sources[0].source_file == "golden.md"


@pytest.mark.asyncio
async def test_query_with_metadata_filters(rag_service, mock_embedder, mock_ollama):
    mock_embedder.embed = Mock(return_value=[0.1] * 384)
    mock_ollama.generate = AsyncMock(return_value="Answer.")
    rag_service._collection.query = Mock(return_value={
        "ids": [["chunk_1"]],
        "documents": [["breed info"]],
        "metadatas": [[{"source_file": "test.md"}]],
        "distances": [[0.2]]
    })

    await rag_service.query("breed question", filters={"breed": "golden_retriever"})

    call_kwargs = rag_service._collection.query.call_args[1]
    assert "where" in call_kwargs
    assert call_kwargs["where"] == {"breed": "golden_retriever"}


@pytest.mark.asyncio
async def test_query_uses_top_k_from_config(rag_service, mock_embedder, mock_ollama):
    mock_embedder.embed = Mock(return_value=[0.1] * 384)
    mock_ollama.generate = AsyncMock(return_value="")
    rag_service._collection.query = Mock(return_value={
        "ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]
    })

    await rag_service.query("question", top_k=7)

    call_kwargs = rag_service._collection.query.call_args[1]
    assert call_kwargs["n_results"] == 7


# --- _build_sources ---

def test_build_sources_with_results(rag_service):
    results = {
        "ids": [["id_1", "id_2"]],
        "documents": [["doc 1 content", "doc 2 content"]],
        "metadatas": [[{"source_file": "file1.md"}, {"source_file": "file2.md"}]],
        "distances": [[0.1, 0.5]]
    }
    sources = rag_service._build_sources(results)
    assert len(sources) == 2
    assert sources[0].content == "doc 1 content"
    assert sources[0].source_file == "file1.md"
    assert sources[0].relevance_score == pytest.approx(0.9, rel=0.01)


def test_build_sources_empty_results(rag_service):
    results = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}
    sources = rag_service._build_sources(results)
    assert sources == []


def test_build_sources_no_ids(rag_service):
    results = {"ids": [], "documents": [], "metadatas": [], "distances": []}
    sources = rag_service._build_sources(results)
    assert sources == []


# --- _format_context ---

def test_format_context_with_sources(rag_service):
    sources = [
        Source(content="First chunk", source_file="file1.md", relevance_score=0.9),
        Source(content="Second chunk", source_file="file2.md", relevance_score=0.8),
    ]
    context = rag_service._format_context(sources)
    assert "[1] First chunk" in context
    assert "[2] Second chunk" in context


def test_format_context_empty_sources(rag_service):
    context = rag_service._format_context([])
    assert "No relevant information found" in context


# --- add_documents ---

def test_add_documents_with_chunks(rag_service, mock_embedder):
    mock_embedder.embed_batch = Mock(return_value=[[0.1] * 384, [0.2] * 384])
    chunks = [
        Chunk(content="First chunk", metadata={"source_file": "file1.md"}),
        Chunk(content="Second chunk", metadata={"source_file": "file2.md"}),
    ]
    count = rag_service.add_documents(chunks)
    assert count == 2
    rag_service._collection.upsert.assert_called_once()
    rag_service._collection.add.assert_not_called()


def test_add_documents_empty_list_returns_zero(rag_service):
    count = rag_service.add_documents([])
    assert count == 0
    rag_service._collection.upsert.assert_not_called()


def test_add_documents_ids_are_source_file_and_index(rag_service, mock_embedder):
    """IDs must be reproducible across processes: no salted hash() in them."""
    mock_embedder.embed_batch = Mock(return_value=[[0.1] * 384, [0.2] * 384])
    chunks = [
        Chunk(content="First chunk", metadata={"source_file": "dogs/beagle.md"}),
        Chunk(content="Second chunk", metadata={"source_file": "dogs/beagle.md"}),
    ]
    rag_service.add_documents(chunks)
    ids = rag_service._collection.upsert.call_args.kwargs["ids"]
    assert ids == ["dogs/beagle.md::0", "dogs/beagle.md::1"]


def test_add_documents_ids_without_source_file_use_content_digest(rag_service, mock_embedder):
    mock_embedder.embed_batch = Mock(return_value=[[0.1] * 384, [0.2] * 384])
    chunks = [Chunk(content="same", metadata={}), Chunk(content="same", metadata={})]
    rag_service.add_documents(chunks)
    ids = rag_service._collection.upsert.call_args.kwargs["ids"]
    digest = hashlib.sha256(b"same").hexdigest()[:16]
    assert ids == [f"{digest}::0", f"{digest}::1"]


# --- real ChromaDB on tmp_path: re-ingest, index listing, delete ---

@pytest.fixture
def chroma_rag_service(tmp_path, mock_ollama):
    """RAG service on a real, throwaway ChromaDB with a fake embedder."""
    settings = Settings(CHROMA_PERSIST_DIR=str(tmp_path / "chroma"))
    embedder = Mock()
    embedder.embed_batch = Mock(side_effect=lambda texts: [[0.1] * 384 for _ in texts])
    return RAGService(settings, embedder, mock_ollama)


def _kb_chunks(source_file, content_hash, n):
    return [
        Chunk(
            content=f"{source_file} chunk {i}",
            metadata={
                "source_file": source_file,
                "source_type": "knowledge_base",
                "content_hash": content_hash,
                "chunk_index": i,
            },
        )
        for i in range(n)
    ]


def test_reingesting_same_chunks_does_not_duplicate(chroma_rag_service):
    chroma_rag_service.add_documents(_kb_chunks("a.md", "h1", 3))
    chroma_rag_service.add_documents(_kb_chunks("a.md", "h1", 3))
    assert chroma_rag_service.get_stats()["document_count"] == 3


def test_get_indexed_files_maps_source_file_to_hash(chroma_rag_service):
    chroma_rag_service.add_documents(_kb_chunks("a.md", "h1", 2))
    chroma_rag_service.add_documents(_kb_chunks("dogs/b.md", "h2", 1))
    assert chroma_rag_service.get_indexed_files() == {"a.md": "h1", "dogs/b.md": "h2"}


def test_get_indexed_files_empty_collection(chroma_rag_service):
    assert chroma_rag_service.get_indexed_files() == {}


def test_get_indexed_files_ignores_other_source_types(chroma_rag_service):
    chroma_rag_service.add_documents(
        [Chunk(content="manual", metadata={"source_file": "manual.md", "source_type": "document"})]
    )
    assert chroma_rag_service.get_indexed_files() == {}


def test_get_indexed_files_reports_chunks_without_hash_as_empty(chroma_rag_service):
    """Chunks ingested before content_hash existed must look 'changed'."""
    chroma_rag_service.add_documents(
        [Chunk(content="old", metadata={"source_file": "old.md", "source_type": "knowledge_base"})]
    )
    assert chroma_rag_service.get_indexed_files() == {"old.md": ""}


def test_delete_document_removes_only_that_file(chroma_rag_service):
    chroma_rag_service.add_documents(_kb_chunks("a.md", "h1", 3))
    chroma_rag_service.add_documents(_kb_chunks("b.md", "h2", 2))
    chroma_rag_service.delete_document("a.md")
    assert chroma_rag_service.get_stats()["document_count"] == 2
    assert chroma_rag_service.get_indexed_files() == {"b.md": "h2"}


# --- get_stats ---

def test_get_stats_returns_collection_info(rag_service):
    rag_service._collection.count = Mock(return_value=42)
    stats = rag_service.get_stats()
    assert stats["document_count"] == 42
    assert "collection_name" in stats
