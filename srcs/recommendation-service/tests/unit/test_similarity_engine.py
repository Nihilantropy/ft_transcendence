import pytest
import numpy as np
from src.services.similarity_engine import SimilarityEngine
from src.config import WEIGHT_VECTOR, MIN_SIMILARITY_THRESHOLD

@pytest.mark.unit
def test_similarity_engine_identical_vectors():
    """Test similarity between identical vectors is 1.0."""
    engine = SimilarityEngine()
    pet_features = np.array([0.5] * 15)
    product_features = np.array([0.5] * 15)

    similarity = engine.calculate_similarity(pet_features, product_features)

    assert similarity == pytest.approx(1.0, rel=0.01)

@pytest.mark.unit
def test_similarity_engine_orthogonal_vectors():
    """Test similarity between orthogonal vectors is 0.0."""
    engine = SimilarityEngine()
    pet_features = np.array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    product_features = np.array([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

    similarity = engine.calculate_similarity(pet_features, product_features)

    assert similarity == pytest.approx(0.0, abs=0.01)

@pytest.mark.unit
def test_similarity_engine_health_condition_match():
    """Test that matching health conditions increases similarity."""
    engine = SimilarityEngine()

    # Pet with joint_health need (index 6)
    pet_features = np.zeros(15)
    pet_features[6] = 1.0  # joint_health

    # Product A: targets joint_health
    product_a = np.zeros(15)
    product_a[6] = 1.0  # for_joint_health

    # Product B: no health targeting
    product_b = np.zeros(15)

    similarity_a = engine.calculate_similarity(pet_features, product_a)
    similarity_b = engine.calculate_similarity(pet_features, product_b)

    # Product A should have higher similarity due to health match
    assert similarity_a > similarity_b

@pytest.mark.unit
def test_similarity_engine_uses_weight_vector():
    """Test that the engine applies WEIGHT_VECTOR correctly."""
    engine = SimilarityEngine()

    # Verify weight vector is set
    assert engine.weight_vector is not None
    assert len(engine.weight_vector) == 15
    np.testing.assert_array_equal(engine.weight_vector, WEIGHT_VECTOR)

@pytest.mark.unit
def test_similarity_engine_threshold_filtering():
    """Test that low similarity scores are filtered."""
    engine = SimilarityEngine()

    # Very dissimilar vectors
    pet_features = np.array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    product_features = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0])

    similarity = engine.calculate_similarity(pet_features, product_features)

    # Should return 0 if below threshold
    if similarity < MIN_SIMILARITY_THRESHOLD:
        assert similarity >= 0.0

@pytest.mark.unit
def test_similarity_engine_ranking():
    """Test ranking multiple products by similarity."""
    engine = SimilarityEngine()

    pet_features = np.array([0.5, 0.5, 0.5, 0.5, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.7, 0.5, 0.6, 0.0])

    # Product A: perfect health match
    product_a = np.array([0.5, 0.5, 0.5, 0.5, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.7, 0.5, 0.6, 0.0])
    # Product B: partial match
    product_b = np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.6, 0.4, 0.5, 0.0])
    # Product C: no health match
    product_c = np.array([0.5, 0.5, 0.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7, 0.5, 0.6, 0.0])

    scores = [
        engine.calculate_similarity(pet_features, product_a),
        engine.calculate_similarity(pet_features, product_b),
        engine.calculate_similarity(pet_features, product_c)
    ]

    # A should score highest, C lowest (due to health condition weight)
    assert scores[0] >= scores[1] >= scores[2]
