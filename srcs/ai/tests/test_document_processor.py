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
