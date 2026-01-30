"""Tests for document processor metadata sanitization."""

import pytest
from src.services.document_processor import DocumentProcessor
from src.config import Settings


@pytest.fixture
def config():
    """Create test configuration."""
    return Settings(
        CHUNK_SIZE=512,
        CHUNK_OVERLAP=50,
        EMBEDDING_MODEL="test-model",
        KNOWLEDGE_BASE_DIR="/tmp/kb"
    )


@pytest.fixture
def processor(config):
    """Create document processor instance."""
    return DocumentProcessor(config)


class TestMetadataSanitization:
    """Test metadata sanitization for ChromaDB compatibility."""

    def test_sanitize_list_to_comma_separated_string(self, processor):
        """Lists should be converted to comma-separated strings."""
        content = """---
tags: [health, temperament, care]
---
# Test Document
Content here."""

        chunks = processor.process(content, metadata={"source_file": "test.md"})

        # Should convert list to comma-separated string
        assert chunks[0].metadata["tags"] == "health, temperament, care"
        assert chunks[0].metadata["source_file"] == "test.md"

    def test_sanitize_nested_list_with_underscores(self, processor):
        """Lists with underscored values should maintain underscores."""
        content = """---
parent_breeds: [golden_retriever, poodle]
---
# Goldendoodle
Crossbreed info."""

        chunks = processor.process(content, metadata={"source_file": "goldendoodle.md"})

        assert chunks[0].metadata["parent_breeds"] == "golden_retriever, poodle"

    def test_sanitize_preserves_primitives(self, processor):
        """String, int, float, bool, None values should pass through unchanged."""
        content = """---
title: Test
age: 5
weight: 12.5
active: true
optional: null
---
# Content"""

        chunks = processor.process(content, metadata={})

        assert chunks[0].metadata["title"] == "Test"
        assert chunks[0].metadata["age"] == 5
        assert chunks[0].metadata["weight"] == 12.5
        assert chunks[0].metadata["active"] is True
        assert chunks[0].metadata["optional"] is None

    def test_sanitize_mixed_metadata(self, processor):
        """Mix of lists and primitives should be handled correctly."""
        content = """---
name: Labrador
tags: [health, nutrition]
popularity_rank: 1
---
# Labrador"""

        chunks = processor.process(content, metadata={"source_type": "breed"})

        assert chunks[0].metadata["name"] == "Labrador"
        assert chunks[0].metadata["tags"] == "health, nutrition"
        assert chunks[0].metadata["popularity_rank"] == 1
        assert chunks[0].metadata["source_type"] == "breed"

    def test_sanitize_empty_list(self, processor):
        """Empty lists should become empty strings."""
        content = """---
tags: []
---
# Content"""

        chunks = processor.process(content, metadata={})

        assert chunks[0].metadata["tags"] == ""

    def test_sanitize_list_with_numbers(self, processor):
        """Lists containing numbers should be converted to strings."""
        content = """---
years: [2020, 2021, 2022]
---
# Timeline"""

        chunks = processor.process(content, metadata={})

        assert chunks[0].metadata["years"] == "2020, 2021, 2022"

    def test_metadata_from_parameter_overrides_frontmatter(self, processor):
        """Metadata parameter should override frontmatter after sanitization."""
        content = """---
source_file: original.md
tags: [foo, bar]
---
# Content"""

        chunks = processor.process(
            content,
            metadata={"source_file": "override.md", "tags": ["new", "tags"]}
        )

        # Parameter should override frontmatter
        assert chunks[0].metadata["source_file"] == "override.md"
        assert chunks[0].metadata["tags"] == "new, tags"
