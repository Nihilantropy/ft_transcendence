import pytest
import numpy as np
from decimal import Decimal
from src.services.feature_engineering import PetFeatureExtractor, ProductFeatureExtractor
from src.models.product import Product

@pytest.mark.unit
def test_pet_feature_extractor_basic():
    """Test pet feature extraction with basic attributes."""
    pet_data = {
        "species": "dog",
        "age_months": 24,
        "weight_kg": 30.0,
        "breed": "golden_retriever",
        "health_conditions": ["joint_health", "sensitive_stomach"]
    }

    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)

    # Should return 15 features matching WEIGHT_VECTOR length
    assert len(features) == 15
    assert isinstance(features, np.ndarray)

@pytest.mark.unit
def test_pet_feature_health_conditions():
    """Test health condition encoding."""
    pet_data = {
        "species": "dog",
        "age_months": 24,
        "weight_kg": 30.0,
        "breed": "golden_retriever",
        "health_conditions": ["joint_health"]
    }

    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)

    # Health conditions are at indices 4-10
    # joint_health should be encoded
    health_features = features[4:11]
    assert np.any(health_features > 0)  # At least one health condition active

@pytest.mark.unit
def test_product_feature_extractor_basic():
    """Test product feature extraction."""
    product = Product(
        name="Senior Joint Care",
        brand="Test Brand",
        target_species="dog",
        min_age_months=84,
        max_age_months=None,
        min_weight_kg=Decimal("20.0"),
        max_weight_kg=Decimal("40.0"),
        protein_percentage=Decimal("28.0"),
        fat_percentage=Decimal("15.0"),
        calories_per_100g=380,
        for_joint_health=True,
        for_sensitive_stomach=False
    )

    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)

    # Should return 15 features
    assert len(features) == 15
    assert isinstance(features, np.ndarray)

@pytest.mark.unit
def test_product_feature_health_flags():
    """Test product health condition flags are extracted."""
    product = Product(
        name="Joint Support Food",
        brand="Test",
        target_species="dog",
        for_joint_health=True,
        for_skin_allergies=True
    )

    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)

    # Health flags at indices 4-10
    health_features = features[4:11]
    assert np.any(health_features > 0)  # At least one flag set
