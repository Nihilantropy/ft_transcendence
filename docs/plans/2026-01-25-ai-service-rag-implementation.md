# AI Service RAG System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a RAG (Retrieval-Augmented Generation) system for pet health Q&A, breed enrichment, and knowledge retrieval.

**Architecture:** ChromaDB for vector storage, sentence-transformers for embeddings (all-MiniLM-L6-v2, 384 dimensions), existing qwen3-vl:8b model for generation. Documents chunked at 500 tokens with 50 token overlap.

**Tech Stack:** FastAPI, ChromaDB, sentence-transformers, PyYAML, tiktoken, existing Ollama integration.

**Reference Design:** `docs/plans/2026-01-25-ai-service-rag-design.md`

---

## Phase 2a: Core RAG Infrastructure

### Task 1: Add RAG Dependencies

**Files:**
- Modify: `srcs/ai/requirements.txt`

**Step 1: Update requirements.txt**

Add after existing dependencies:

```
# RAG - Vector Store
chromadb==0.5.23

# RAG - Embeddings
sentence-transformers==3.3.1

# RAG - Document Processing
pyyaml==6.0.2
tiktoken==0.8.0
```

**Step 2: Rebuild Docker image**

Run: `docker compose build ai-service`
Expected: Build completes successfully with new dependencies installed

**Step 3: Verify dependencies installed**

Run: `docker compose run --rm ai-service python -c "import chromadb; import sentence_transformers; import yaml; import tiktoken; print('All RAG dependencies OK')"`
Expected: "All RAG dependencies OK"

**Step 4: Commit**

```bash
git add srcs/ai/requirements.txt
git commit -m "feat(ai): add RAG dependencies (chromadb, sentence-transformers)"
```

---

### Task 2: Add RAG Configuration Settings

**Files:**
- Modify: `srcs/ai/src/config.py`
- Test: `srcs/ai/tests/test_config.py`

**Step 1: Write the failing test**

Add to `srcs/ai/tests/test_config.py`:

```python
def test_rag_settings_defaults():
    """Test RAG configuration has expected defaults."""
    settings = Settings()

    # ChromaDB settings
    assert settings.CHROMA_PERSIST_DIR == "./data/chroma"
    assert settings.CHROMA_COLLECTION_NAME == "pet_knowledge"

    # Embeddings settings
    assert settings.EMBEDDING_MODEL == "all-MiniLM-L6-v2"
    assert settings.EMBEDDING_DIMENSION == 384

    # Document processing settings
    assert settings.CHUNK_SIZE == 500
    assert settings.CHUNK_OVERLAP == 50

    # RAG query settings
    assert settings.RAG_TOP_K == 5
    assert settings.RAG_MIN_RELEVANCE == 0.3

    # Knowledge base path
    assert settings.KNOWLEDGE_BASE_DIR == "./data/knowledge_base"
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_config.py::test_rag_settings_defaults -v`
Expected: FAIL with AttributeError (settings don't exist yet)

**Step 3: Write minimal implementation**

Add to `srcs/ai/src/config.py` inside the `Settings` class (after Vision Analysis section):

```python
    # RAG - ChromaDB
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "pet_knowledge"

    # RAG - Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG - Document Processing
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # RAG - Query
    RAG_TOP_K: int = 5
    RAG_MIN_RELEVANCE: float = 0.3

    # RAG - Knowledge Base
    KNOWLEDGE_BASE_DIR: str = "./data/knowledge_base"
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_config.py::test_rag_settings_defaults -v`
Expected: PASS

**Step 5: Commit**

```bash
git add srcs/ai/src/config.py srcs/ai/tests/test_config.py
git commit -m "feat(ai): add RAG configuration settings"
```

---

### Task 3: Implement Embedder Service

**Files:**
- Create: `srcs/ai/src/services/embedder.py`
- Test: `srcs/ai/tests/test_embedder.py`

**Step 1: Write the failing tests**

Create `srcs/ai/tests/test_embedder.py`:

```python
import pytest
from unittest.mock import Mock, patch
import numpy as np

from src.services.embedder import Embedder
from src.config import Settings


@pytest.fixture
def settings():
    """Test settings."""
    return Settings()


@pytest.fixture
def embedder(settings):
    """Embedder instance with mocked model."""
    with patch('src.services.embedder.SentenceTransformer') as mock_st:
        # Mock the model to return predictable embeddings
        mock_model = Mock()
        mock_model.encode.return_value = np.zeros((384,))
        mock_st.return_value = mock_model
        emb = Embedder(settings)
        emb._model = mock_model  # Ensure mock is used
        return emb


class TestEmbedder:
    def test_init_loads_model(self, settings):
        """Test embedder initializes with correct model."""
        with patch('src.services.embedder.SentenceTransformer') as mock_st:
            mock_st.return_value = Mock()
            embedder = Embedder(settings)

            mock_st.assert_called_once_with(settings.EMBEDDING_MODEL)

    def test_embed_single_text(self, embedder):
        """Test embedding a single text returns correct dimensions."""
        embedder._model.encode.return_value = np.random.rand(384)

        result = embedder.embed("Golden Retrievers are friendly dogs")

        assert isinstance(result, list)
        assert len(result) == 384
        embedder._model.encode.assert_called_once()

    def test_embed_batch_texts(self, embedder):
        """Test embedding multiple texts returns correct shape."""
        texts = ["Text one", "Text two", "Text three"]
        embedder._model.encode.return_value = np.random.rand(3, 384)

        result = embedder.embed_batch(texts)

        assert isinstance(result, list)
        assert len(result) == 3
        assert all(len(emb) == 384 for emb in result)

    def test_embed_empty_text_raises_error(self, embedder):
        """Test embedding empty text raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            embedder.embed("")

    def test_embed_batch_empty_list_raises_error(self, embedder):
        """Test embedding empty list raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            embedder.embed_batch([])
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_embedder.py -v`
Expected: FAIL with ModuleNotFoundError (embedder.py doesn't exist)

**Step 3: Write minimal implementation**

Create `srcs/ai/src/services/embedder.py`:

```python
"""Embedder service for generating text embeddings."""

import logging
from typing import List

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class Embedder:
    """Generates text embeddings using sentence-transformers."""

    def __init__(self, config):
        """Initialize embedder with configuration.

        Args:
            config: Settings instance with embedding configuration
        """
        self.model_name = config.EMBEDDING_MODEL
        self.dimension = config.EMBEDDING_DIMENSION
        self._model = SentenceTransformer(self.model_name)
        logger.info(f"Initialized embedder with model: {self.model_name}")

    def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector

        Raises:
            ValueError: If text is empty
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        embedding = self._model.encode(text)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors

        Raises:
            ValueError: If texts list is empty
        """
        if not texts:
            raise ValueError("Cannot embed empty list of texts")

        embeddings = self._model.encode(texts)
        return embeddings.tolist()
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_embedder.py -v`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add srcs/ai/src/services/embedder.py srcs/ai/tests/test_embedder.py
git commit -m "feat(ai): implement embedder service with sentence-transformers"
```

---

### Task 4: Implement Document Processor

**Files:**
- Create: `srcs/ai/src/services/document_processor.py`
- Test: `srcs/ai/tests/test_document_processor.py`

**Step 1: Write the failing tests**

Create `srcs/ai/tests/test_document_processor.py`:

```python
import pytest
from src.services.document_processor import DocumentProcessor, Chunk
from src.config import Settings


@pytest.fixture
def settings():
    """Test settings."""
    return Settings()


@pytest.fixture
def processor(settings):
    """Document processor instance."""
    return DocumentProcessor(settings)


@pytest.fixture
def sample_markdown_with_frontmatter():
    """Sample markdown document with YAML frontmatter."""
    return '''---
doc_type: breed
species: dog
breed: golden_retriever
topics: [health, temperament, care]
---

# Golden Retriever

## Overview
Golden Retrievers are friendly, intelligent dogs known for their golden coat.

## Health Considerations
- **Hip Dysplasia**: Common in large breeds
- **Cancer**: Higher risk than average

## Care Requirements
Regular exercise and grooming needed.
'''


@pytest.fixture
def sample_plain_text():
    """Sample plain text without frontmatter."""
    return """Golden Retrievers are one of the most popular dog breeds.
They are known for being friendly, reliable, and great family pets.
These dogs require regular exercise and mental stimulation."""


class TestDocumentProcessor:
    def test_parse_frontmatter_extracts_metadata(self, processor, sample_markdown_with_frontmatter):
        """Test frontmatter parsing extracts YAML metadata."""
        metadata, body = processor.parse_frontmatter(sample_markdown_with_frontmatter)

        assert metadata["doc_type"] == "breed"
        assert metadata["species"] == "dog"
        assert metadata["breed"] == "golden_retriever"
        assert "health" in metadata["topics"]
        assert "# Golden Retriever" in body

    def test_parse_frontmatter_no_frontmatter(self, processor, sample_plain_text):
        """Test parsing document without frontmatter returns empty metadata."""
        metadata, body = processor.parse_frontmatter(sample_plain_text)

        assert metadata == {}
        assert body == sample_plain_text

    def test_split_by_headers(self, processor, sample_markdown_with_frontmatter):
        """Test splitting document by markdown headers."""
        _, body = processor.parse_frontmatter(sample_markdown_with_frontmatter)
        sections = processor.split_by_headers(body)

        assert len(sections) >= 3  # Overview, Health, Care sections
        assert any("Overview" in s for s in sections)
        assert any("Health" in s for s in sections)

    def test_chunk_text_respects_size_limit(self, processor):
        """Test chunking respects configured chunk size."""
        # Create text longer than chunk size
        long_text = "word " * 600  # ~600 tokens worth

        chunks = processor.chunk_text(long_text, max_tokens=100, overlap=20)

        assert len(chunks) > 1
        # Each chunk should be roughly within limits

    def test_chunk_text_with_overlap(self, processor):
        """Test chunks have overlap for context continuity."""
        text = "sentence one. sentence two. sentence three. sentence four. sentence five."

        chunks = processor.chunk_text(text, max_tokens=10, overlap=3)

        # With overlap, some content should appear in multiple chunks
        assert len(chunks) >= 2

    def test_process_document_returns_chunks(self, processor, sample_markdown_with_frontmatter):
        """Test full document processing returns Chunk objects."""
        chunks = processor.process(
            content=sample_markdown_with_frontmatter,
            metadata={"source_file": "breeds/golden_retriever.md"}
        )

        assert len(chunks) > 0
        assert all(isinstance(c, Chunk) for c in chunks)
        # Metadata should be merged
        assert all(c.metadata.get("source_file") == "breeds/golden_retriever.md" for c in chunks)
        assert all(c.metadata.get("breed") == "golden_retriever" for c in chunks)

    def test_process_empty_document_raises_error(self, processor):
        """Test processing empty document raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            processor.process(content="", metadata={})

    def test_chunk_has_required_fields(self, processor, sample_markdown_with_frontmatter):
        """Test Chunk dataclass has required fields."""
        chunks = processor.process(
            content=sample_markdown_with_frontmatter,
            metadata={"source_file": "test.md"}
        )

        chunk = chunks[0]
        assert hasattr(chunk, 'content')
        assert hasattr(chunk, 'metadata')
        assert isinstance(chunk.content, str)
        assert isinstance(chunk.metadata, dict)
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_document_processor.py -v`
Expected: FAIL with ModuleNotFoundError

**Step 3: Write minimal implementation**

Create `srcs/ai/src/services/document_processor.py`:

```python
"""Document processor for chunking and metadata extraction."""

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple, Any

import yaml
import tiktoken

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A document chunk with content and metadata."""
    content: str
    metadata: Dict[str, Any]


class DocumentProcessor:
    """Processes documents into chunks for vector storage."""

    FRONTMATTER_PATTERN = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
    HEADER_PATTERN = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)

    def __init__(self, config):
        """Initialize processor with configuration.

        Args:
            config: Settings instance with chunking configuration
        """
        self.chunk_size = config.CHUNK_SIZE
        self.chunk_overlap = config.CHUNK_OVERLAP
        self._tokenizer = tiktoken.get_encoding("cl100k_base")
        logger.info(f"Initialized document processor: chunk_size={self.chunk_size}, overlap={self.chunk_overlap}")

    def parse_frontmatter(self, content: str) -> Tuple[Dict[str, Any], str]:
        """Extract YAML frontmatter from document.

        Args:
            content: Document content with optional frontmatter

        Returns:
            Tuple of (metadata dict, body without frontmatter)
        """
        match = self.FRONTMATTER_PATTERN.match(content)
        if match:
            try:
                metadata = yaml.safe_load(match.group(1)) or {}
                body = content[match.end():]
                return metadata, body
            except yaml.YAMLError as e:
                logger.warning(f"Failed to parse frontmatter: {e}")
                return {}, content
        return {}, content

    def split_by_headers(self, content: str) -> List[str]:
        """Split document by markdown headers.

        Args:
            content: Markdown content

        Returns:
            List of sections (each starting with a header or intro text)
        """
        # Find all header positions
        headers = list(self.HEADER_PATTERN.finditer(content))

        if not headers:
            return [content.strip()] if content.strip() else []

        sections = []

        # Content before first header
        if headers[0].start() > 0:
            intro = content[:headers[0].start()].strip()
            if intro:
                sections.append(intro)

        # Each header and its content
        for i, match in enumerate(headers):
            start = match.start()
            end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
            section = content[start:end].strip()
            if section:
                sections.append(section)

        return sections

    def chunk_text(self, text: str, max_tokens: int = None, overlap: int = None) -> List[str]:
        """Split text into chunks with token limit and overlap.

        Args:
            text: Text to chunk
            max_tokens: Maximum tokens per chunk (default: config value)
            overlap: Token overlap between chunks (default: config value)

        Returns:
            List of text chunks
        """
        max_tokens = max_tokens or self.chunk_size
        overlap = overlap or self.chunk_overlap

        tokens = self._tokenizer.encode(text)

        if len(tokens) <= max_tokens:
            return [text]

        chunks = []
        start = 0

        while start < len(tokens):
            end = min(start + max_tokens, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = self._tokenizer.decode(chunk_tokens)
            chunks.append(chunk_text)

            # Move start with overlap
            start = end - overlap if end < len(tokens) else len(tokens)

        return chunks

    def process(self, content: str, metadata: Dict[str, Any]) -> List[Chunk]:
        """Process document into chunks with metadata.

        Args:
            content: Document content (markdown or plain text)
            metadata: Additional metadata to merge with frontmatter

        Returns:
            List of Chunk objects

        Raises:
            ValueError: If content is empty
        """
        if not content or not content.strip():
            raise ValueError("Cannot process empty document")

        # Extract frontmatter
        doc_metadata, body = self.parse_frontmatter(content)
        merged_metadata = {**doc_metadata, **metadata}

        # Split by headers first
        sections = self.split_by_headers(body)

        # Chunk each section
        chunks = []
        chunk_index = 0

        for section in sections:
            section_chunks = self.chunk_text(section)
            for chunk_text in section_chunks:
                chunk_metadata = {
                    **merged_metadata,
                    "chunk_index": chunk_index
                }
                chunks.append(Chunk(content=chunk_text, metadata=chunk_metadata))
                chunk_index += 1

        logger.info(f"Processed document into {len(chunks)} chunks")
        return chunks
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_document_processor.py -v`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add srcs/ai/src/services/document_processor.py srcs/ai/tests/test_document_processor.py
git commit -m "feat(ai): implement document processor with chunking and frontmatter parsing"
```

---

### Task 5: Implement RAG Service Core

**Files:**
- Create: `srcs/ai/src/services/rag_service.py`
- Test: `srcs/ai/tests/test_rag_service.py`

**Step 1: Write the failing tests**

Create `srcs/ai/tests/test_rag_service.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_service.py -v`
Expected: FAIL with ModuleNotFoundError

**Step 3: Write minimal implementation**

Create `srcs/ai/src/services/rag_service.py`:

```python
"""RAG service for retrieval-augmented generation."""

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

import chromadb

from src.services.document_processor import Chunk

logger = logging.getLogger(__name__)


@dataclass
class Source:
    """A retrieved source document."""
    content: str
    source_file: str
    relevance_score: float


@dataclass
class RAGResponse:
    """Response from RAG query."""
    answer: str
    sources: List[Source]
    model: str


class RAGService:
    """Orchestrates RAG queries with ChromaDB and Ollama."""

    def __init__(self, config, embedder, ollama_client):
        """Initialize RAG service.

        Args:
            config: Settings instance
            embedder: Embedder service for generating embeddings
            ollama_client: Ollama client for text generation
        """
        self.config = config
        self.embedder = embedder
        self.ollama = ollama_client

        # Initialize ChromaDB
        self._chroma_client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
        self._collection = self._chroma_client.get_or_create_collection(
            name=config.CHROMA_COLLECTION_NAME
        )

        logger.info(f"Initialized RAG service with collection: {config.CHROMA_COLLECTION_NAME}")

    async def query(
        self,
        question: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = None
    ) -> RAGResponse:
        """Query the knowledge base and generate an answer.

        Args:
            question: User's question
            filters: Optional metadata filters (e.g., {"breed": "golden_retriever"})
            top_k: Number of chunks to retrieve (default: config value)

        Returns:
            RAGResponse with answer and sources
        """
        top_k = top_k or self.config.RAG_TOP_K

        # 1. Embed the question
        query_embedding = self.embedder.embed(question)

        # 2. Search ChromaDB
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": top_k
        }
        if filters:
            query_params["where"] = filters

        results = self._collection.query(**query_params)

        # 3. Build context from retrieved chunks
        sources = self._build_sources(results)
        context = self._format_context(sources)

        # 4. Generate answer with Ollama
        prompt = self._build_prompt(question, context)
        answer = await self.ollama.generate(prompt)

        return RAGResponse(
            answer=answer,
            sources=sources,
            model=self.config.OLLAMA_MODEL
        )

    def _build_sources(self, results: Dict) -> List[Source]:
        """Build Source objects from ChromaDB results.

        Args:
            results: ChromaDB query results

        Returns:
            List of Source objects
        """
        sources = []
        if not results["ids"] or not results["ids"][0]:
            return sources

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            # Convert distance to relevance (1 - normalized_distance)
            relevance = max(0, 1 - dist)
            sources.append(Source(
                content=doc,
                source_file=meta.get("source_file", "unknown"),
                relevance_score=round(relevance, 3)
            ))

        return sources

    def _format_context(self, sources: List[Source]) -> str:
        """Format sources into context string for LLM.

        Args:
            sources: List of Source objects

        Returns:
            Formatted context string
        """
        if not sources:
            return "No relevant information found."

        context_parts = []
        for i, source in enumerate(sources, 1):
            context_parts.append(f"[{i}] {source.content}")

        return "\n\n".join(context_parts)

    def _build_prompt(self, question: str, context: str) -> str:
        """Build prompt for LLM generation.

        Args:
            question: User's question
            context: Retrieved context

        Returns:
            Formatted prompt string
        """
        return f"""Answer the question based on the following context. If the context doesn't contain enough information, say so.

Context:
{context}

Question: {question}

Answer concisely and cite sources by number when applicable."""

    def add_documents(self, chunks: List[Chunk]) -> int:
        """Add document chunks to the collection.

        Args:
            chunks: List of Chunk objects to add

        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0

        # Generate embeddings
        texts = [c.content for c in chunks]
        embeddings = self.embedder.embed_batch(texts)

        # Generate IDs
        ids = [f"chunk_{i}_{hash(c.content) % 10000}" for i, c in enumerate(chunks)]

        # Add to collection
        self._collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=[c.metadata for c in chunks]
        )

        logger.info(f"Added {len(chunks)} chunks to collection")
        return len(chunks)

    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics.

        Returns:
            Dict with collection stats
        """
        return {
            "collection_name": self.config.CHROMA_COLLECTION_NAME,
            "document_count": self._collection.count()
        }
```

**Step 4: Add generate method to OllamaClient**

We need to add a text-only generation method to the Ollama client. Add to `srcs/ai/src/services/ollama_client.py`:

```python
    async def generate(self, prompt: str) -> str:
        """Generate text response from prompt (no image).

        Args:
            prompt: Text prompt for generation

        Returns:
            Generated text response

        Raises:
            ConnectionError: If Ollama is unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "options": {"temperature": self.temperature}
                    }
                )
                response.raise_for_status()
                response_data = response.json()

            return response_data.get("message", {}).get("content", "")

        except httpx.HTTPError as e:
            logger.error(f"Ollama generation failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
```

**Step 5: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_service.py -v`
Expected: PASS (9 tests)

**Step 6: Commit**

```bash
git add srcs/ai/src/services/rag_service.py srcs/ai/src/services/ollama_client.py srcs/ai/tests/test_rag_service.py
git commit -m "feat(ai): implement RAG service with ChromaDB integration"
```

---

## Phase 2b: RAG API Endpoints

### Task 6: Add RAG Request/Response Models

**Files:**
- Modify: `srcs/ai/src/models/requests.py`
- Modify: `srcs/ai/src/models/responses.py`
- Test: `srcs/ai/tests/test_models.py`

**Step 1: Write the failing tests**

Add to `srcs/ai/tests/test_models.py`:

```python
# Add these imports at the top
from src.models.requests import RAGQueryRequest, RAGIngestRequest
from src.models.responses import RAGQueryResponse, RAGSourceData, RAGIngestResponse, RAGStatusResponse


class TestRAGModels:
    def test_rag_query_request_valid(self):
        """Test valid RAG query request."""
        request = RAGQueryRequest(
            question="What health issues affect Golden Retrievers?",
            filters={"species": "dog", "breed": "golden_retriever"},
            top_k=5
        )
        assert request.question == "What health issues affect Golden Retrievers?"
        assert request.filters["breed"] == "golden_retriever"
        assert request.top_k == 5

    def test_rag_query_request_defaults(self):
        """Test RAG query request has sensible defaults."""
        request = RAGQueryRequest(question="General question")
        assert request.filters is None
        assert request.top_k == 5

    def test_rag_query_request_empty_question_fails(self):
        """Test empty question raises validation error."""
        with pytest.raises(ValueError):
            RAGQueryRequest(question="")

    def test_rag_ingest_request_valid(self):
        """Test valid RAG ingest request."""
        request = RAGIngestRequest(
            content="# Golden Retriever\n\nFriendly dogs...",
            metadata={"doc_type": "breed", "species": "dog"},
            source_name="golden_retriever.md"
        )
        assert "Golden Retriever" in request.content
        assert request.metadata["doc_type"] == "breed"

    def test_rag_source_data_structure(self):
        """Test RAGSourceData has required fields."""
        source = RAGSourceData(
            content="Some content",
            source_file="breeds/dog.md",
            relevance_score=0.89
        )
        assert source.content == "Some content"
        assert source.relevance_score == 0.89

    def test_rag_query_response_structure(self):
        """Test RAGQueryResponse structure."""
        source = RAGSourceData(
            content="Test",
            source_file="test.md",
            relevance_score=0.9
        )
        data = RAGQueryResponse(
            answer="The answer is...",
            sources=[source],
            model="qwen3-vl:8b"
        )
        assert data.answer == "The answer is..."
        assert len(data.sources) == 1
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py::TestRAGModels -v`
Expected: FAIL with ImportError

**Step 3: Update request models**

Add to `srcs/ai/src/models/requests.py`:

```python
from pydantic import BaseModel, Field, validator, field_validator
from typing import Optional, Dict, Any


class RAGQueryRequest(BaseModel):
    """Request model for RAG query endpoint."""
    question: str = Field(..., min_length=1, description="Question to answer")
    filters: Optional[Dict[str, Any]] = Field(None, description="Metadata filters")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")

    @field_validator('question')
    @classmethod
    def question_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Question cannot be empty')
        return v.strip()


class RAGIngestRequest(BaseModel):
    """Request model for RAG document ingestion."""
    content: str = Field(..., min_length=1, description="Document content (markdown)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    source_name: str = Field(..., min_length=1, description="Source file name for tracking")
```

**Step 4: Update response models**

Add to `srcs/ai/src/models/responses.py`:

```python
class RAGSourceData(BaseModel):
    """A retrieved source in RAG response."""
    content: str
    source_file: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)


class RAGQueryResponse(BaseModel):
    """RAG query response data."""
    answer: str
    sources: List[RAGSourceData]
    model: str


class RAGIngestResponse(BaseModel):
    """RAG ingest response data."""
    chunks_created: int
    document_id: str


class RAGStatusResponse(BaseModel):
    """RAG status response data."""
    collection_name: str
    document_count: int
    embedding_model: str
```

**Step 5: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py::TestRAGModels -v`
Expected: PASS (6 tests)

**Step 6: Commit**

```bash
git add srcs/ai/src/models/requests.py srcs/ai/src/models/responses.py srcs/ai/tests/test_models.py
git commit -m "feat(ai): add RAG request and response models"
```

---

### Task 7: Implement RAG Route Endpoints

**Files:**
- Create: `srcs/ai/src/routes/rag.py`
- Test: `srcs/ai/tests/test_rag_route.py`
- Modify: `srcs/ai/src/main.py`

**Step 1: Write the failing tests**

Create `srcs/ai/tests/test_rag_route.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_route.py -v`
Expected: FAIL with ModuleNotFoundError

**Step 3: Write minimal implementation**

Create `srcs/ai/src/routes/rag.py`:

```python
"""RAG API endpoints."""

from fastapi import APIRouter, HTTPException, status
import logging

from src.models.requests import RAGQueryRequest, RAGIngestRequest
from src.models.responses import RAGQueryResponse, RAGSourceData, RAGIngestResponse, RAGStatusResponse
from src.services.rag_service import RAGService
from src.services.document_processor import DocumentProcessor
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

# Service instances (injected at startup)
rag_service: RAGService = None
document_processor: DocumentProcessor = None


@router.post("/query", response_model=dict)
async def query(request: RAGQueryRequest):
    """Query the knowledge base with RAG.

    Args:
        request: RAG query request with question and optional filters

    Returns:
        Standardized response with answer and sources
    """
    try:
        response = await rag_service.query(
            question=request.question,
            filters=request.filters,
            top_k=request.top_k
        )

        data = RAGQueryResponse(
            answer=response.answer,
            sources=[
                RAGSourceData(
                    content=s.content,
                    source_file=s.source_file,
                    relevance_score=s.relevance_score
                )
                for s in response.sources
            ],
            model=response.model
        )

        return success_response(data.model_dump())

    except ConnectionError as e:
        logger.error(f"RAG query failed - Ollama unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="RAG_SERVICE_UNAVAILABLE",
                message="RAG service temporarily unavailable"
            )
        )
    except Exception as e:
        logger.error(f"RAG query failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred"
            )
        )


@router.post("/ingest", response_model=dict)
async def ingest(request: RAGIngestRequest):
    """Ingest a document into the knowledge base.

    Args:
        request: Ingest request with content and metadata

    Returns:
        Standardized response with ingestion stats
    """
    try:
        # Process document into chunks
        chunks = document_processor.process(
            content=request.content,
            metadata={
                **request.metadata,
                "source_file": request.source_name
            }
        )

        # Add to vector store
        chunks_added = rag_service.add_documents(chunks)

        # Generate document ID from source name
        doc_id = request.source_name.replace("/", "_").replace(".", "_")

        data = RAGIngestResponse(
            chunks_created=chunks_added,
            document_id=doc_id
        )

        return success_response(data.model_dump())

    except ValueError as e:
        logger.warning(f"Ingest validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(
                code="INVALID_DOCUMENT",
                message=str(e)
            )
        )
    except Exception as e:
        logger.error(f"Document ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="Failed to ingest document"
            )
        )


@router.get("/status", response_model=dict)
async def status_check():
    """Get RAG system status.

    Returns:
        Standardized response with collection stats
    """
    try:
        stats = rag_service.get_stats()

        data = RAGStatusResponse(
            collection_name=stats["collection_name"],
            document_count=stats["document_count"],
            embedding_model=rag_service.config.EMBEDDING_MODEL
        )

        return success_response(data.model_dump())

    except Exception as e:
        logger.error(f"Status check failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="Failed to get RAG status"
            )
        )
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_route.py -v`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add srcs/ai/src/routes/rag.py srcs/ai/tests/test_rag_route.py
git commit -m "feat(ai): implement RAG API endpoints (query, ingest, status)"
```

---

### Task 8: Wire Up RAG Services in Main App

**Files:**
- Modify: `srcs/ai/src/main.py`
- Create: `srcs/ai/src/routes/__init__.py` (update)

**Step 1: Update main.py lifespan**

Modify `srcs/ai/src/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from src.config import Settings
from src.routes import vision, rag
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.services.embedder import Embedder
from src.services.document_processor import DocumentProcessor
from src.services.rag_service import RAGService
from src.utils.logger import setup_logging

# Initialize settings
settings = Settings()

# Setup logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME}...")

    # Initialize core services
    image_processor = ImageProcessor(settings)
    ollama_client = OllamaVisionClient(settings)

    # Initialize RAG services
    logger.info("Initializing RAG services...")
    embedder = Embedder(settings)
    document_processor = DocumentProcessor(settings)
    rag_service = RAGService(settings, embedder, ollama_client)

    # Inject into routes
    vision.image_processor = image_processor
    vision.ollama_client = ollama_client

    rag.rag_service = rag_service
    rag.document_processor = document_processor

    logger.info(f"Ollama URL: {settings.OLLAMA_BASE_URL}")
    logger.info(f"Model: {settings.OLLAMA_MODEL}")
    logger.info(f"RAG Collection: {settings.CHROMA_COLLECTION_NAME}")
    logger.info(f"{settings.SERVICE_NAME} started successfully")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}...")

# Create FastAPI app
app = FastAPI(
    title="SmartBreeds AI Service",
    description="AI-powered pet breed identification and analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # API Gateway handles actual CORS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "ollama_url": settings.OLLAMA_BASE_URL,
        "model": settings.OLLAMA_MODEL
    }

# Include routers
app.include_router(vision.router)
app.include_router(rag.router)
```

**Step 2: Run existing tests to verify no regressions**

Run: `docker compose run --rm ai-service python -m pytest tests/ -v --ignore=tests/test_integration_vision.py`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add srcs/ai/src/main.py
git commit -m "feat(ai): wire up RAG services in main application"
```

---

## Phase 2c: Vision Enrichment Integration

### Task 9: Add Enrich Option to Vision Request

**Files:**
- Modify: `srcs/ai/src/models/requests.py`
- Modify: `srcs/ai/src/models/responses.py`
- Modify: `srcs/ai/tests/test_models.py`

**Step 1: Write the failing test**

Add to `srcs/ai/tests/test_models.py`:

```python
class TestVisionEnrichment:
    def test_vision_options_has_enrich_field(self):
        """Test VisionAnalysisOptions includes enrich field."""
        from src.models.requests import VisionAnalysisOptions
        options = VisionAnalysisOptions(enrich=True)
        assert options.enrich is True

    def test_vision_options_enrich_default_false(self):
        """Test enrich defaults to False."""
        from src.models.requests import VisionAnalysisOptions
        options = VisionAnalysisOptions()
        assert options.enrich is False

    def test_enriched_info_structure(self):
        """Test EnrichedInfo model structure."""
        from src.models.responses import EnrichedInfo
        info = EnrichedInfo(
            description="Golden Retrievers are friendly...",
            care_summary="Regular exercise needed...",
            sources=["breeds/golden_retriever.md"]
        )
        assert info.description is not None
        assert len(info.sources) == 1
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py::TestVisionEnrichment -v`
Expected: FAIL

**Step 3: Update models**

Add `enrich` to `VisionAnalysisOptions` in `srcs/ai/src/models/requests.py`:

```python
class VisionAnalysisOptions(BaseModel):
    """Options for vision analysis."""
    return_traits: bool = True
    return_health_info: bool = True
    enrich: bool = False  # NEW: fetch RAG context for breed
```

Add `EnrichedInfo` to `srcs/ai/src/models/responses.py`:

```python
class EnrichedInfo(BaseModel):
    """RAG-enriched breed information."""
    description: str
    care_summary: str
    sources: List[str]


class VisionAnalysisData(BaseModel):
    """Vision analysis result data."""
    breed: str
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    traits: BreedTraits
    health_considerations: List[str]
    note: Optional[str] = None
    enriched_info: Optional[EnrichedInfo] = None  # NEW: RAG-enriched details
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py::TestVisionEnrichment -v`
Expected: PASS

**Step 5: Commit**

```bash
git add srcs/ai/src/models/requests.py srcs/ai/src/models/responses.py srcs/ai/tests/test_models.py
git commit -m "feat(ai): add enrich option to vision analysis models"
```

---

### Task 10: Implement enrich_breed in RAG Service

**Files:**
- Modify: `srcs/ai/src/services/rag_service.py`
- Modify: `srcs/ai/tests/test_rag_service.py`

**Step 1: Write the failing test**

Add to `srcs/ai/tests/test_rag_service.py`:

```python
class TestEnrichBreed:
    @pytest.mark.asyncio
    async def test_enrich_breed_returns_structured_info(self, rag_service):
        """Test enrich_breed returns description and care summary."""
        result = await rag_service.enrich_breed("Golden Retriever")

        assert "description" in result
        assert "care_summary" in result
        assert "sources" in result

    @pytest.mark.asyncio
    async def test_enrich_breed_filters_by_breed(self, rag_service, mock_collection):
        """Test enrich_breed filters by breed name."""
        await rag_service.enrich_breed("Golden Retriever")

        call_kwargs = mock_collection.query.call_args[1]
        assert call_kwargs["where"]["breed"] == "golden_retriever"

    @pytest.mark.asyncio
    async def test_enrich_breed_handles_unknown(self, rag_service, mock_collection):
        """Test enrich_breed handles breeds not in knowledge base."""
        mock_collection.query.return_value = {
            "ids": [[]],
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]]
        }

        result = await rag_service.enrich_breed("Unknown Breed")

        assert result["description"] == "No detailed information available for this breed."
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_service.py::TestEnrichBreed -v`
Expected: FAIL (method doesn't exist)

**Step 3: Implement enrich_breed**

Add to `srcs/ai/src/services/rag_service.py`:

```python
    async def enrich_breed(self, breed: str) -> Dict[str, Any]:
        """Get enriched information for a specific breed.

        Args:
            breed: Breed name (e.g., "Golden Retriever")

        Returns:
            Dict with description, care_summary, and sources
        """
        # Normalize breed name for filter
        breed_key = breed.lower().replace(" ", "_")

        # Query for breed-specific information
        response = await self.query(
            question=f"Summarize key facts, temperament, and care requirements for {breed}",
            filters={"breed": breed_key},
            top_k=3
        )

        # Handle no results
        if not response.sources:
            return {
                "description": "No detailed information available for this breed.",
                "care_summary": "Consult a veterinarian for breed-specific care advice.",
                "sources": []
            }

        # Extract care-related query
        care_response = await self.query(
            question=f"What are the care requirements and health considerations for {breed}?",
            filters={"breed": breed_key},
            top_k=2
        )

        return {
            "description": response.answer,
            "care_summary": care_response.answer,
            "sources": list(set(s.source_file for s in response.sources + care_response.sources))
        }
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_rag_service.py::TestEnrichBreed -v`
Expected: PASS

**Step 5: Commit**

```bash
git add srcs/ai/src/services/rag_service.py srcs/ai/tests/test_rag_service.py
git commit -m "feat(ai): implement enrich_breed method for vision enrichment"
```

---

### Task 11: Update Vision Route with Enrichment

**Files:**
- Modify: `srcs/ai/src/routes/vision.py`
- Modify: `srcs/ai/tests/test_vision_route.py`

**Step 1: Write the failing test**

Add to `srcs/ai/tests/test_vision_route.py`:

```python
class TestVisionEnrichment:
    @pytest.mark.asyncio
    async def test_analyze_with_enrich_returns_enriched_info(self):
        """Test vision analysis with enrich=True returns enriched_info."""
        # Setup mocks
        with patch('src.routes.vision.image_processor') as mock_processor, \
             patch('src.routes.vision.ollama_client') as mock_ollama, \
             patch('src.routes.vision.rag_service') as mock_rag:

            mock_processor.process_image.return_value = "base64data"
            mock_ollama.analyze_breed = AsyncMock(return_value={
                "breed": "Golden Retriever",
                "confidence": 0.92,
                "traits": {"size": "large", "energy_level": "high", "temperament": "friendly"},
                "health_considerations": ["Hip dysplasia"]
            })
            mock_rag.enrich_breed = AsyncMock(return_value={
                "description": "Golden Retrievers are friendly dogs...",
                "care_summary": "Regular exercise needed...",
                "sources": ["breeds/golden_retriever.md"]
            })

            from src.routes.vision import analyze_image
            from src.models.requests import VisionAnalysisRequest, VisionAnalysisOptions

            request = VisionAnalysisRequest(
                image="data:image/jpeg;base64,/9j/test",
                options=VisionAnalysisOptions(enrich=True)
            )

            response = await analyze_image(request)

            assert response["success"] is True
            assert response["data"]["enriched_info"] is not None
            assert "description" in response["data"]["enriched_info"]
            mock_rag.enrich_breed.assert_called_once_with("Golden Retriever")

    @pytest.mark.asyncio
    async def test_analyze_without_enrich_no_enriched_info(self):
        """Test vision analysis with enrich=False has no enriched_info."""
        with patch('src.routes.vision.image_processor') as mock_processor, \
             patch('src.routes.vision.ollama_client') as mock_ollama:

            mock_processor.process_image.return_value = "base64data"
            mock_ollama.analyze_breed = AsyncMock(return_value={
                "breed": "Golden Retriever",
                "confidence": 0.92,
                "traits": {"size": "large", "energy_level": "high", "temperament": "friendly"},
                "health_considerations": ["Hip dysplasia"]
            })

            from src.routes.vision import analyze_image
            from src.models.requests import VisionAnalysisRequest, VisionAnalysisOptions

            request = VisionAnalysisRequest(
                image="data:image/jpeg;base64,/9j/test",
                options=VisionAnalysisOptions(enrich=False)
            )

            response = await analyze_image(request)

            assert response["success"] is True
            assert response["data"].get("enriched_info") is None
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_vision_route.py::TestVisionEnrichment -v`
Expected: FAIL

**Step 3: Update vision route**

Modify `srcs/ai/src/routes/vision.py`:

```python
from fastapi import APIRouter, HTTPException, status
import logging

from src.models.requests import VisionAnalysisRequest
from src.models.responses import VisionAnalysisData, BreedTraits, EnrichedInfo
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.services.rag_service import RAGService
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/vision", tags=["vision"])

# Service instances (injected at startup)
image_processor: ImageProcessor = None
ollama_client: OllamaVisionClient = None
rag_service: RAGService = None  # NEW


@router.post("/analyze", response_model=dict)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image to identify breed and characteristics.

    Args:
        request: Vision analysis request with image and options

    Returns:
        Standardized response with breed data and optional enrichment
    """
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)
        logger.info("Image processed successfully")

        # Analyze with Ollama
        result = await ollama_client.analyze_breed(processed_image)
        logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

        # Build base response
        data = VisionAnalysisData(
            breed=result["breed"],
            confidence=result["confidence"],
            traits=BreedTraits(**result["traits"]),
            health_considerations=result["health_considerations"],
            note=result.get("note")
        )

        # Enrich with RAG if requested
        if request.options.enrich and rag_service is not None:
            logger.info(f"Enriching breed info for: {result['breed']}")
            enriched = await rag_service.enrich_breed(result["breed"])
            data.enriched_info = EnrichedInfo(
                description=enriched["description"],
                care_summary=enriched["care_summary"],
                sources=enriched["sources"]
            )

        return success_response(data.model_dump())

    except ValueError as e:
        logger.warning(f"Image validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(
                code="INVALID_IMAGE",
                message=str(e)
            )
        )

    except ConnectionError as e:
        logger.error(f"Ollama connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="VISION_SERVICE_UNAVAILABLE",
                message="Vision analysis temporarily unavailable, please try again"
            )
        )

    except Exception as e:
        logger.error(f"Unexpected error in vision analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred during analysis"
            )
        )
```

**Step 4: Update main.py to inject rag_service into vision route**

Add to `srcs/ai/src/main.py` lifespan (after rag.document_processor line):

```python
    vision.rag_service = rag_service
```

**Step 5: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_vision_route.py::TestVisionEnrichment -v`
Expected: PASS

**Step 6: Commit**

```bash
git add srcs/ai/src/routes/vision.py srcs/ai/src/main.py srcs/ai/tests/test_vision_route.py
git commit -m "feat(ai): integrate RAG enrichment into vision analysis endpoint"
```

---

### Task 12: Create Sample Knowledge Base Documents

**Files:**
- Create: `srcs/ai/data/knowledge_base/breeds/dogs/golden_retriever.md`
- Create: `srcs/ai/data/knowledge_base/breeds/dogs/labrador_retriever.md`
- Create: `srcs/ai/data/knowledge_base/health/hip_dysplasia.md`

**Step 1: Create directory structure**

Run: `mkdir -p srcs/ai/data/knowledge_base/breeds/dogs srcs/ai/data/knowledge_base/health`

**Step 2: Create golden_retriever.md**

```markdown
---
doc_type: breed
species: dog
breed: golden_retriever
topics: [health, temperament, care, nutrition]
---

# Golden Retriever

## Overview
Golden Retrievers are friendly, intelligent, and devoted dogs. Originally bred in Scotland as hunting dogs, they are now one of the most popular family pets worldwide.

## Temperament
- **Friendly**: Exceptionally good with children and other pets
- **Intelligent**: Highly trainable and eager to please
- **Active**: Requires regular exercise and mental stimulation
- **Patient**: Known for their gentle and tolerant nature

## Health Considerations
- **Hip Dysplasia**: Common in large breeds, regular vet checkups recommended
- **Elbow Dysplasia**: Monitor for limping or stiffness
- **Cancer**: Higher risk than average, especially hemangiosarcoma and lymphoma
- **Eye Conditions**: Prone to cataracts and progressive retinal atrophy

## Care Requirements
- **Exercise**: 1-2 hours daily of moderate to vigorous activity
- **Grooming**: Regular brushing (2-3 times weekly), more during shedding season
- **Diet**: High-quality dog food, watch for obesity
- **Training**: Early socialization and obedience training highly recommended
```

**Step 3: Create labrador_retriever.md**

```markdown
---
doc_type: breed
species: dog
breed: labrador_retriever
topics: [health, temperament, care, nutrition]
---

# Labrador Retriever

## Overview
Labrador Retrievers are outgoing, high-spirited companions who have more than enough affection to go around. They are among America's most popular breeds.

## Temperament
- **Friendly**: Gets along well with everyone
- **Active**: High energy, loves outdoor activities
- **Loyal**: Strong bond with family members
- **Playful**: Retains puppy-like enthusiasm into adulthood

## Health Considerations
- **Obesity**: Prone to weight gain, requires portion control
- **Hip Dysplasia**: Common in the breed
- **Exercise-Induced Collapse (EIC)**: Genetic condition causing weakness
- **Ear Infections**: Floppy ears require regular cleaning

## Care Requirements
- **Exercise**: At least 1 hour of vigorous exercise daily
- **Grooming**: Weekly brushing, more during shedding periods
- **Diet**: Measured meals, avoid free-feeding
- **Swimming**: Natural swimmers, great form of exercise
```

**Step 4: Create hip_dysplasia.md**

```markdown
---
doc_type: health
species: dog
topics: [joints, genetics, large_breeds]
---

# Hip Dysplasia in Dogs

## Overview
Hip dysplasia is a genetic condition where the hip joint doesn't develop properly, leading to arthritis and pain. It's common in large and giant breed dogs.

## Symptoms
- Decreased activity or reluctance to exercise
- Difficulty rising from sitting or lying position
- Bunny-hopping gait when running
- Limping or lameness in hind legs
- Loss of muscle mass in thighs

## Risk Factors
- **Genetics**: Primary cause, can be inherited
- **Rapid Growth**: Fast growth in puppies increases risk
- **Obesity**: Extra weight stresses joints
- **Improper Nutrition**: Overfeeding or incorrect calcium levels

## Prevention
- Choose breeders who test for hip dysplasia
- Maintain healthy weight throughout life
- Provide joint supplements (glucosamine, chondroitin)
- Avoid excessive exercise in puppies

## Treatment Options
- Weight management
- Physical therapy
- Anti-inflammatory medications
- Joint supplements
- Surgery (in severe cases)

## Breeds Commonly Affected
- Golden Retriever
- Labrador Retriever
- German Shepherd
- Rottweiler
- Great Dane
```

**Step 5: Add .gitkeep for chroma directory**

Run: `touch srcs/ai/data/chroma/.gitkeep`

**Step 6: Update .gitignore**

Add to root `.gitignore` (if not present):
```
# ChromaDB data (generated at runtime)
srcs/ai/data/chroma/*
!srcs/ai/data/chroma/.gitkeep
```

**Step 7: Commit**

```bash
git add srcs/ai/data/knowledge_base/ srcs/ai/data/chroma/.gitkeep
git commit -m "feat(ai): add sample knowledge base documents for breeds and health"
```

---

### Task 13: Add Integration Tests for RAG

**Files:**
- Create: `srcs/ai/tests/test_integration_rag.py`

**Step 1: Create integration test file**

Create `srcs/ai/tests/test_integration_rag.py`:

```python
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
```

**Step 2: Run integration tests (requires services running)**

Run: `./scripts/run-ai-tests.sh --integration`
Expected: Tests pass if Ollama is available

**Step 3: Commit**

```bash
git add srcs/ai/tests/test_integration_rag.py
git commit -m "test(ai): add RAG integration tests"
```

---

### Task 14: Update Docker Volume for ChromaDB Persistence

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add ChromaDB volume mount**

Add to `ai-service` section in `docker-compose.yml`:

```yaml
  ai-service:
    # ... existing config ...
    volumes:
      - ./srcs/ai/src:/app/src
      - ./srcs/ai/tests:/app/tests
      - ./srcs/ai/data/knowledge_base:/app/data/knowledge_base:ro
      - ai-chroma-data:/app/data/chroma

# Add to volumes section at bottom
volumes:
  # ... existing volumes ...
  ai-chroma-data:
```

**Step 2: Rebuild and verify**

Run: `docker compose build ai-service && docker compose up ai-service -d`

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add ChromaDB persistent volume for AI service"
```

---

### Task 15: Run Full Test Suite and Final Verification

**Step 1: Run all unit tests**

Run: `./scripts/run-ai-tests.sh --unit`
Expected: All tests pass (should be ~45+ tests now)

**Step 2: Run integration tests (if Ollama available)**

Run: `./scripts/run-ai-tests.sh --integration`
Expected: Integration tests pass

**Step 3: Manual API verification**

```bash
# Start services
docker compose up ai-service -d

# Test RAG status
curl -s http://localhost:8001/api/v1/rag/status | jq

# Test RAG query (after seeding knowledge base)
curl -s -X POST http://localhost:8001/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What health issues affect Golden Retrievers?"}' | jq
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ai): complete RAG system implementation (Phase 2)"
```

---

## Summary

**Phase 2a - Core RAG (Tasks 1-5):**
- RAG dependencies added
- Configuration settings
- Embedder service (sentence-transformers)
- Document processor (chunking, frontmatter)
- RAG service core (ChromaDB integration)

**Phase 2b - RAG Endpoints (Tasks 6-8):**
- Request/response models
- `/api/v1/rag/query` - Knowledge Q&A
- `/api/v1/rag/ingest` - Document ingestion
- `/api/v1/rag/status` - Health check
- Main app wiring

**Phase 2c - Vision Enrichment (Tasks 9-14):**
- `enrich` option in vision request
- `enrich_breed()` method in RAG service
- Vision route integration
- Sample knowledge base documents
- Integration tests
- Docker volume persistence

**Test Coverage:** ~50 unit tests + integration tests

---

Plan complete and saved to `docs/plans/2026-01-25-ai-service-rag-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
