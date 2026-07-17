"""Tests for Embedder service."""
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from src.services.embedder import Embedder


@pytest.fixture
def config():
    cfg = MagicMock()
    cfg.EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    cfg.EMBEDDING_DIMENSION = 384
    return cfg


@pytest.fixture
def embedder(config):
    with patch('src.services.embedder.SentenceTransformer') as mock_st:
        mock_model = MagicMock()
        mock_st.return_value = mock_model
        emb = Embedder(config)
        yield emb


def test_init_stores_config(config):
    with patch('src.services.embedder.SentenceTransformer'):
        emb = Embedder(config)
        assert emb.model_name == "all-MiniLM-L6-v2"
        assert emb.dimension == 384


def test_embed_valid_text(embedder):
    embedder._model.encode.return_value = np.array([0.1] * 384)
    result = embedder.embed("golden retriever breed info")
    assert isinstance(result, list)
    assert len(result) == 384
    embedder._model.encode.assert_called_once_with("golden retriever breed info")


def test_embed_empty_string_raises(embedder):
    with pytest.raises(ValueError, match="empty text"):
        embedder.embed("")


def test_embed_whitespace_only_raises(embedder):
    with pytest.raises(ValueError, match="empty text"):
        embedder.embed("   ")


def test_embed_batch_valid(embedder):
    embedder._model.encode.return_value = np.array([[0.1] * 384, [0.2] * 384])
    result = embedder.embed_batch(["text one", "text two"])
    assert isinstance(result, list)
    assert len(result) == 2
    embedder._model.encode.assert_called_once_with(["text one", "text two"])


def test_embed_batch_empty_list_raises(embedder):
    with pytest.raises(ValueError, match="empty list"):
        embedder.embed_batch([])
