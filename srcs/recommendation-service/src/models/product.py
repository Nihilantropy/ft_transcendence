from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean,
    CheckConstraint, Index, TIMESTAMP, ARRAY
)
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Product(Base):
    """Product catalog model for food recommendations."""

    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "target_species IN ('dog', 'cat')",
            name="check_target_species"
        ),
        CheckConstraint("min_age_months >= 0", name="check_min_age_positive"),
        CheckConstraint("max_age_months >= 0", name="check_max_age_positive"),
        CheckConstraint("min_weight_kg >= 0", name="check_min_weight_positive"),
        CheckConstraint("max_weight_kg >= 0", name="check_max_weight_positive"),
        CheckConstraint(
            "protein_percentage >= 0 AND protein_percentage <= 100",
            name="check_protein_range"
        ),
        CheckConstraint(
            "fat_percentage >= 0 AND fat_percentage <= 100",
            name="check_fat_range"
        ),
        CheckConstraint(
            "fiber_percentage >= 0 AND fiber_percentage <= 100",
            name="check_fiber_range"
        ),
        CheckConstraint("calories_per_100g > 0", name="check_calories_positive"),
        CheckConstraint(
            "(min_age_months IS NULL AND max_age_months IS NULL) OR "
            "(min_age_months IS NULL) OR "
            "(max_age_months IS NULL) OR "
            "(min_age_months <= max_age_months)",
            name="check_valid_age_range"
        ),
        CheckConstraint(
            "(min_weight_kg IS NULL AND max_weight_kg IS NULL) OR "
            "(min_weight_kg IS NULL) OR "
            "(max_weight_kg IS NULL) OR "
            "(min_weight_kg <= max_weight_kg)",
            name="check_valid_weight_range"
        ),
        Index("idx_products_species", "target_species"),
        Index("idx_products_active", "is_active"),
        Index("idx_products_brand", "brand"),
        Index("idx_products_suitable_breeds", "suitable_breeds", postgresql_using="gin"),
        {"schema": "recommendation_schema"}
    )

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Basic Information
    name = Column(String(255), nullable=False)
    brand = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    product_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)

    # Target Specifications
    target_species = Column(String(20), nullable=False)
    min_age_months = Column(Integer, nullable=True)
    max_age_months = Column(Integer, nullable=True)
    min_weight_kg = Column(Numeric(5, 2), nullable=True)
    max_weight_kg = Column(Numeric(5, 2), nullable=True)
    suitable_breeds = Column(ARRAY(Text), nullable=True)

    # Nutritional Profile
    protein_percentage = Column(Numeric(5, 2), nullable=True)
    fat_percentage = Column(Numeric(5, 2), nullable=True)
    fiber_percentage = Column(Numeric(5, 2), nullable=True)
    calories_per_100g = Column(Integer, nullable=True)

    # Ingredient Flags
    grain_free = Column(Boolean, nullable=False, default=False)
    organic = Column(Boolean, nullable=False, default=False)
    hypoallergenic = Column(Boolean, nullable=False, default=False)
    limited_ingredient = Column(Boolean, nullable=False, default=False)
    raw_food = Column(Boolean, nullable=False, default=False)

    # Health Condition Targeting
    for_sensitive_stomach = Column(Boolean, nullable=False, default=False)
    for_weight_management = Column(Boolean, nullable=False, default=False)
    for_joint_health = Column(Boolean, nullable=False, default=False)
    for_skin_allergies = Column(Boolean, nullable=False, default=False)
    for_dental_health = Column(Boolean, nullable=False, default=False)
    for_kidney_health = Column(Boolean, nullable=False, default=False)

    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    def __init__(self, **kwargs):
        """Initialize with defaults for boolean fields."""
        # Set defaults for boolean fields if not provided
        kwargs.setdefault('grain_free', False)
        kwargs.setdefault('organic', False)
        kwargs.setdefault('hypoallergenic', False)
        kwargs.setdefault('limited_ingredient', False)
        kwargs.setdefault('raw_food', False)
        kwargs.setdefault('for_sensitive_stomach', False)
        kwargs.setdefault('for_weight_management', False)
        kwargs.setdefault('for_joint_health', False)
        kwargs.setdefault('for_skin_allergies', False)
        kwargs.setdefault('for_dental_health', False)
        kwargs.setdefault('for_kidney_health', False)
        kwargs.setdefault('is_active', True)
        super().__init__(**kwargs)

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', brand='{self.brand}')>"
