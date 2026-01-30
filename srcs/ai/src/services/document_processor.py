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

    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize metadata for ChromaDB compatibility.

        ChromaDB only accepts primitive types (str, int, float, bool, None).
        Lists are converted to comma-separated strings.

        Args:
            metadata: Raw metadata dictionary

        Returns:
            Sanitized metadata dictionary
        """
        sanitized = {}
        for key, value in metadata.items():
            if isinstance(value, list):
                # Convert list to comma-separated string
                sanitized[key] = ", ".join(str(v) for v in value)
            elif isinstance(value, (str, int, float, bool, type(None))):
                # Pass through primitive types
                sanitized[key] = value
            else:
                # Skip unsupported types
                logger.warning(f"Skipping metadata key '{key}' with unsupported type {type(value)}")
        return sanitized

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
        merged_metadata = self._sanitize_metadata({**doc_metadata, **metadata})

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
