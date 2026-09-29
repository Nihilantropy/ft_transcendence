"""Tests for the vision route's request contract (photo required, optional user_context)."""

import pytest
from unittest.mock import AsyncMock, Mock
from fastapi.testclient import TestClient

from src.main import app
from src.routes import vision

IMAGE = "data:image/jpeg;base64,/9j/test123"
RESULT = {
    "species": "dog",
    "breed_analysis": {
        "primary_breed": "golden_retriever", "confidence": 0.89,
        "is_likely_crossbreed": False, "breed_probabilities": [],
    },
    "description": "A dog",
    "traits": {"size": "large", "energy_level": "medium", "temperament": "calm"},
    "health_observations": [],
    "enriched_info": None,
}


@pytest.fixture
def orchestrator(monkeypatch):
    """Inject mocks the way the lifespan does, without starting it (no model loading)."""
    processor = Mock()
    processor.process_image = Mock(side_effect=lambda image: image)
    orch = Mock()
    orch.analyze_image = AsyncMock(return_value=RESULT)
    monkeypatch.setattr(vision, "image_processor", processor)
    monkeypatch.setattr(vision, "vision_orchestrator", orch)
    return orch


@pytest.fixture
def client():
    return TestClient(app)  # no `with`: the lifespan (real services) never runs


def test_user_context_is_forwarded(client, orchestrator):
    r = client.post("/api/v1/vision/analyze",
                    json={"image": IMAGE, "language": "it", "user_context": "  Ha 12 anni  "})
    assert r.status_code == 200
    orchestrator.analyze_image.assert_awaited_once_with(IMAGE, "it", "Ha 12 anni")


def test_user_context_is_optional(client, orchestrator):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE})
    assert r.status_code == 200
    orchestrator.analyze_image.assert_awaited_once_with(IMAGE, "en", None)


@pytest.mark.parametrize("blank", ["", "   ", "\n\t"])
def test_blank_user_context_becomes_none(client, orchestrator, blank):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE, "user_context": blank})
    assert r.status_code == 200
    assert orchestrator.analyze_image.call_args[0][2] is None


def test_user_context_too_long_is_rejected(client, orchestrator):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE, "user_context": "x" * 1001})
    assert r.status_code == 422
    orchestrator.analyze_image.assert_not_called()


def test_user_context_at_the_limit_is_accepted(client, orchestrator):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE, "user_context": "x" * 1000})
    assert r.status_code == 200


def test_text_without_photo_is_rejected(client, orchestrator):
    """No text-only chat: the photo is mandatory."""
    r = client.post("/api/v1/vision/analyze", json={"user_context": "Is my dog healthy?"})
    assert r.status_code == 422
    orchestrator.analyze_image.assert_not_called()


@pytest.mark.parametrize("language", ["en", "it", "es", "de", "ja"])
def test_supported_languages(client, orchestrator, language):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE, "language": language})
    assert r.status_code == 200
    assert orchestrator.analyze_image.call_args[0][1] == language


def test_unsupported_language_is_rejected(client, orchestrator):
    r = client.post("/api/v1/vision/analyze", json={"image": IMAGE, "language": "fr"})
    assert r.status_code == 422
    orchestrator.analyze_image.assert_not_called()
