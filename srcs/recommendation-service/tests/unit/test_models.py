import pytest
from decimal import Decimal
from datetime import datetime
from src.models.product import Product
from src.models.recommendation import Recommendation
from src.models.user_feedback import UserFeedback

@pytest.mark.unit
def test_product_model_creation():
    """Test Product model can be instantiated with required fields."""
    product = Product(
        name="Royal Canin Golden Retriever Adult",
        brand="Royal Canin",
        target_species="dog",
        protein_percentage=Decimal("28.0"),
        fat_percentage=Decimal("15.0"),
        calories_per_100g=380,
        price=Decimal("89.99")
    )

    assert product.name == "Royal Canin Golden Retriever Adult"
    assert product.brand == "Royal Canin"
    assert product.target_species == "dog"
    assert product.protein_percentage == Decimal("28.0")
    assert product.is_active is True  # Default value

@pytest.mark.unit
def test_product_health_flags_default_false():
    """Test health condition flags default to False."""
    product = Product(
        name="Test Food",
        brand="Test Brand",
        target_species="dog",
        price=Decimal("50.0")
    )

    assert product.for_sensitive_stomach is False
    assert product.for_joint_health is False
    assert product.for_skin_allergies is False

@pytest.mark.unit
def test_product_nullable_age_range():
    """Test products can have NULL age ranges (all ages)."""
    product = Product(
        name="All Ages Food",
        brand="Brand",
        target_species="dog",
        min_age_months=None,
        max_age_months=None,
        price=Decimal("60.0")
    )

    assert product.min_age_months is None
    assert product.max_age_months is None

@pytest.mark.unit
def test_recommendation_model_creation():
    """Test Recommendation model tracks recommendation history."""
    recommendation = Recommendation(
        user_id=123,
        pet_id=456,
        product_id=789,
        similarity_score=Decimal("0.8745"),
        rank_position=1
    )

    assert recommendation.user_id == 123
    assert recommendation.pet_id == 456
    assert recommendation.product_id == 789
    assert recommendation.similarity_score == Decimal("0.8745")
    assert recommendation.rank_position == 1
