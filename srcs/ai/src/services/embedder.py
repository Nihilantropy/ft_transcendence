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
        # Text only: the vision and audio encoders of a multimodal model (EmbeddingGemma 2)
        # are not loaded. A text-only model ignores these keys.
        self._model = SentenceTransformer(
            self.model_name, config_kwargs={"vision_config": None, "audio_config": None}
        )
        # Retrieval models are trained with a different instruction for the question and
        # for the passage; models without these prompts are encoded as plain text.
        self._query_prompt = "SearchQuery" if "SearchQuery" in self._model.prompts else None
        self._document_prompt = "Document" if "Document" in self._model.prompts else None
        logger.info(f"Initialized embedder with model: {self.model_name}")

    def embed(self, text: str) -> List[float]:
        """Generate the embedding of a search query.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector

        Raises:
            ValueError: If text is empty
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        embedding = self._model.encode(text, prompt_name=self._query_prompt, normalize_embeddings=True)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate the embeddings of documents to index.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors

        Raises:
            ValueError: If texts list is empty
        """
        if not texts:
            raise ValueError("Cannot embed empty list of texts")

        embeddings = self._model.encode(texts, prompt_name=self._document_prompt, normalize_embeddings=True)
        return embeddings.tolist()
