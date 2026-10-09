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


# --- breed context: vector search restricted by metadata ---
# The embedder is mocked to one constant vector, so the ranking cannot tell chunks apart:
# what these tests pin down is what the metadata filter lets through.

def _kb(source_file, texts, **metadata):
    return [
        Chunk(
            content=text,
            metadata={"source_file": source_file, "source_type": "knowledge_base", "chunk_index": i, **metadata},
        )
        for i, text in enumerate(texts)
    ]


@pytest.fixture
def kb_service(chroma_rag_service):
    """Golden retriever, labrador, a goldendoodle mix, and health documents for both species."""
    add = chroma_rag_service.add_documents
    add(list(reversed(_kb(
        "dogs/golden_retriever.md",
        ["# Golden Retriever", "## Overview\nFriendly.", "## Coat Colour\nA fact in the last section."],
        doc_type="breed", species="dog", breed="golden_retriever",
    ))))
    add(_kb("dogs/labrador.md", ["# Labrador"], doc_type="breed", species="dog", breed="labrador_retriever"))
    add(_kb("dogs/poodle.md", ["# Poodle"], doc_type="breed", species="dog", breed="poodle"))
    add(_kb("dogs/goldendoodle.md", ["# Goldendoodle"], doc_type="crossbreed", species="dog",
            parent_breeds="golden_retriever, poodle"))
    add(_kb("dogs/health/hip_dysplasia.md", ["# Hip Dysplasia in Dogs", "## Symptoms\nLimping."],
            doc_type="health", species="dog"))
    add(_kb("cats/health/hcm.md", ["# HCM in Cats"], doc_type="health", species="cat"))
    return chroma_rag_service


@pytest.mark.asyncio
async def test_get_breed_context_keeps_to_the_breed_and_the_species(kb_service):
    result = await kb_service.get_breed_context("golden_retriever", "dog")

    assert result["breed"] == "Golden Retriever"
    assert result["parent_breeds"] is None
    # Every chunk of the breed's document, back in file order; no other breed.
    assert result["description"] == (
        "# Golden Retriever\n\n## Overview\nFriendly.\n\n## Coat Colour\nA fact in the last section."
    )
    # Health documents of the same species only.
    assert result["health_info"] == "# Hip Dysplasia in Dogs\n\n## Symptoms\nLimping."
    assert set(result["sources"]) == {"dogs/golden_retriever.md", "dogs/health/hip_dysplasia.md"}
    assert [m["source"] for m in result["matches"]] == result["sources"]
    assert all(0 <= m["relevance"] <= 1 for m in result["matches"])


@pytest.mark.asyncio
async def test_get_breed_context_without_a_breed_document_still_retrieves_health(kb_service):
    """Most classifier breeds have no document: they get the health documents, never another breed's text."""
    result = await kb_service.get_breed_context("cocker_spaniel", "dog")

    assert result["description"] == ""
    assert result["sources"] == ["dogs/health/hip_dysplasia.md"]


@pytest.mark.asyncio
async def test_get_breed_context_nothing_retrieved_is_none(chroma_rag_service):
    assert await chroma_rag_service.get_breed_context("golden_retriever", "dog") is None


@pytest.mark.asyncio
async def test_owner_notes_are_searched_among_the_health_documents(kb_service):
    await kb_service.get_breed_context("golden_retriever", "dog", "He limps after walks")

    queries = [call.args[0] for call in kb_service.embedder.embed.call_args_list]
    assert queries == [
        "Golden Retriever breed characteristics, health and care",
        "Golden Retriever common health problems",
        "He limps after walks",
    ]


@pytest.mark.asyncio
async def test_health_documents_are_capped(kb_service):
    kb_service.config.RAG_HEALTH_TOP_K = 1
    kb_service.add_documents(_kb("dogs/health/ivdd.md", ["# IVDD in Dogs"], doc_type="health", species="dog"))

    result = await kb_service.get_breed_context("golden_retriever", "dog")

    assert len([s for s in result["sources"] if "/health/" in s]) == 1


@pytest.mark.asyncio
async def test_breed_documents_share_the_budget(kb_service):
    """A long document cannot push a second document of the same breed out of the context."""
    kb_service.config.RAG_CONTEXT_MAX_CHARS = 20
    kb_service.add_documents(_kb("dogs/zz.md", ["Z" * 50], doc_type="breed", species="dog", breed="golden_retriever"))

    description = (await kb_service.get_breed_context("golden_retriever", "dog"))["description"]

    assert sorted(description.split("\n\n")) == sorted(["# Golden R", "Z" * 10])


@pytest.mark.asyncio
async def test_get_crossbreed_context_returns_the_mix_and_its_parents(kb_service):
    # Parents in the opposite order to the document's frontmatter.
    result = await kb_service.get_crossbreed_context(["Poodle", "Golden Retriever"], "dog")

    assert result["breed"] is None
    assert result["parent_breeds"] == ["Poodle", "Golden Retriever"]
    assert set(result["sources"]) == {
        "dogs/goldendoodle.md", "dogs/golden_retriever.md", "dogs/poodle.md", "dogs/health/hip_dysplasia.md"
    }
    assert "# Labrador" not in result["description"]


def test_collection_built_with_another_embedding_model_is_rebuilt(tmp_path, mock_ollama):
    """Vectors of two models cannot be compared; the knowledge base sync refills the collection."""
    def service(model):
        settings = Settings(CHROMA_PERSIST_DIR=str(tmp_path / "chroma"), EMBEDDING_MODEL=model)
        embedder = Mock()
        embedder.embed_batch = Mock(side_effect=lambda texts: [[0.1] * 8 for _ in texts])
        return RAGService(settings, embedder, mock_ollama)

    service("model-a").add_documents(_kb("a.md", ["one", "two"]))
    assert service("model-a").get_stats()["document_count"] == 2
    assert service("model-b").get_stats()["document_count"] == 0


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
    embedder.embed = Mock(return_value=[0.1] * 384)
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
