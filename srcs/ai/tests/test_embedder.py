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
