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
