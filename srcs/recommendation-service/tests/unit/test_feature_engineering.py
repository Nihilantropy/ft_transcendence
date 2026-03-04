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


@pytest.mark.unit
def test_pet_senior_nutritional_features():
    """Senior pets (>84 months) need higher protein and moderate fat/calories."""
    pet_data = {"age_months": 90, "weight_kg": 30.0, "breed": "labrador"}
    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)
    assert features[11] == pytest.approx(0.8)
    assert features[12] == pytest.approx(0.6)
    assert features[13] == pytest.approx(0.7)


@pytest.mark.unit
def test_pet_puppy_nutritional_features():
    """Puppies (<12 months) have highest nutritional needs."""
    pet_data = {"age_months": 6, "weight_kg": 5.0, "breed": "labrador"}
    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)
    assert features[11] == pytest.approx(0.9)
    assert features[12] == pytest.approx(0.8)
    assert features[13] == pytest.approx(0.9)


@pytest.mark.unit
def test_pet_without_breed_uses_default_score():
    """Pet with no breed gets 0.5 breed score."""
    pet_data = {"age_months": 24, "weight_kg": 20.0}
    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)
    assert features[2] == pytest.approx(0.5)


@pytest.mark.unit
def test_pet_age_normalized_capped_at_one():
    """Age normalization is capped at 1.0 for very old pets."""
    pet_data = {"age_months": 400}
    extractor = PetFeatureExtractor()
    features = extractor.extract(pet_data)
    assert features[0] <= 1.0


@pytest.mark.unit
def test_product_both_min_max_age_uses_average():
    """Product with both min and max age uses their average."""
    product = Product(
        name="All Ages Food", brand="Test", target_species="dog",
        min_age_months=0, max_age_months=200
    )
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    # avg_age = (0 + 200) / 2 = 100, normalized = 100 / 200 = 0.5
    assert features[0] == pytest.approx(0.5)


@pytest.mark.unit
def test_product_max_age_only():
    """Product with only max_age_months uses it directly."""
    product = Product(
        name="Young Pet Food", brand="Test", target_species="dog",
        max_age_months=24
    )
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[0] == pytest.approx(24 / 200.0)


@pytest.mark.unit
def test_product_no_age_uses_default():
    """Product with no age info defaults to 0.5."""
    product = Product(name="Universal Food", brand="Test", target_species="dog")
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[0] == pytest.approx(0.5)


@pytest.mark.unit
def test_product_min_weight_only():
    """Product with only min_weight_kg uses it for both weight slots."""
    product = Product(
        name="Heavy Dog Food", brand="Test", target_species="dog",
        min_weight_kg=Decimal("30.0")
    )
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[1] == pytest.approx(0.3)
    assert features[3] == pytest.approx(0.3)


@pytest.mark.unit
def test_product_max_weight_only():
    """Product with only max_weight_kg uses it for both weight slots."""
    product = Product(
        name="Light Dog Food", brand="Test", target_species="dog",
        max_weight_kg=Decimal("10.0")
    )
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[1] == pytest.approx(0.1)
    assert features[3] == pytest.approx(0.1)


@pytest.mark.unit
def test_product_no_weight_uses_defaults():
    """Product with no weight info defaults both weight slots to 0.5."""
    product = Product(name="Universal Food", brand="Test", target_species="dog")
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[1] == pytest.approx(0.5)
    assert features[3] == pytest.approx(0.5)


@pytest.mark.unit
def test_product_grain_free_ingredient_score():
    """Grain-free adds 0.3 to ingredient score."""
    product = Product(name="Grain Free Food", brand="Test", target_species="dog", grain_free=True)
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[14] == pytest.approx(0.3)


@pytest.mark.unit
def test_product_organic_ingredient_score():
    """Organic adds 0.3 to ingredient score."""
    product = Product(name="Organic Food", brand="Test", target_species="dog", organic=True)
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[14] == pytest.approx(0.3)


@pytest.mark.unit
def test_product_hypoallergenic_ingredient_score():
    """Hypoallergenic adds 0.4 to ingredient score."""
    product = Product(name="Hypo Food", brand="Test", target_species="dog", hypoallergenic=True)
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[14] == pytest.approx(0.4)


@pytest.mark.unit
def test_product_all_ingredients_capped_at_one():
    """All ingredient features combined are capped at 1.0."""
    product = Product(
        name="Premium Food", brand="Test", target_species="dog",
        grain_free=True, organic=True, hypoallergenic=True
    )
    extractor = ProductFeatureExtractor()
    features = extractor.extract(product)
    assert features[14] == pytest.approx(1.0)
