import pytest
import numpy as np
from src.config import Settings, WEIGHT_VECTOR

@pytest.mark.unit
def test_settings_loads_from_env(monkeypatch):
    """Test Settings loads configuration from environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@localhost/test")
    monkeypatch.setenv("USER_SERVICE_URL", "http://user-service:3002")
    monkeypatch.setenv("MIN_SIMILARITY_THRESHOLD", "0.35")

    settings = Settings()

    assert settings.DATABASE_URL == "postgresql://test:test@localhost/test"
    assert settings.USER_SERVICE_URL == "http://user-service:3002"
    assert settings.MIN_SIMILARITY_THRESHOLD == 0.35

@pytest.mark.unit
def test_weight_vector_length():
    """Test WEIGHT_VECTOR has correct length (15)."""
    assert len(WEIGHT_VECTOR) == 15

@pytest.mark.unit
def test_weight_vector_health_conditions_highest():
    """Test health condition weights are highest."""
    health_weights = WEIGHT_VECTOR[4:11]
    other_weights = np.concatenate([WEIGHT_VECTOR[0:4], WEIGHT_VECTOR[11:15]])
    assert np.all(health_weights >= 0.40)
    assert np.all(other_weights < 0.40)
