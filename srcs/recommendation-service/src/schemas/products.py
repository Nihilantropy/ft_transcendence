"""Pydantic schemas for product admin endpoints."""
from typing import Optional, List
from pydantic import BaseModel, Field
from decimal import Decimal


class ProductCreate(BaseModel):
    """Schema for creating a new product."""
    name: str = Field(..., min_length=1, max_length=255)
    brand: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0)
    product_url: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)

    # Target specifications
    target_species: str = Field(..., pattern="^(dog|cat)$")
    min_age_months: Optional[int] = Field(None, ge=0)
    max_age_months: Optional[int] = Field(None, ge=0)
    min_weight_kg: Optional[Decimal] = Field(None, ge=0)
    max_weight_kg: Optional[Decimal] = Field(None, ge=0)
    suitable_breeds: Optional[List[str]] = None

    # Nutritional profile
    protein_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    fat_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    fiber_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    calories_per_100g: Optional[int] = Field(None, gt=0)

    # Ingredient flags
    grain_free: bool = False
    organic: bool = False
    hypoallergenic: bool = False
    limited_ingredient: bool = False
    raw_food: bool = False

    # Health condition targeting
    for_sensitive_stomach: bool = False
    for_weight_management: bool = False
    for_joint_health: bool = False
    for_skin_allergies: bool = False
    for_dental_health: bool = False
    for_kidney_health: bool = False


class ProductUpdate(BaseModel):
    """Schema for updating a product (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    brand: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0)
    product_url: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)

    target_species: Optional[str] = Field(None, pattern="^(dog|cat)$")
    min_age_months: Optional[int] = Field(None, ge=0)
    max_age_months: Optional[int] = Field(None, ge=0)
    min_weight_kg: Optional[Decimal] = Field(None, ge=0)
    max_weight_kg: Optional[Decimal] = Field(None, ge=0)
    suitable_breeds: Optional[List[str]] = None

    protein_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    fat_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    fiber_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    calories_per_100g: Optional[int] = Field(None, gt=0)

    grain_free: Optional[bool] = None
    organic: Optional[bool] = None
    hypoallergenic: Optional[bool] = None
    limited_ingredient: Optional[bool] = None
    raw_food: Optional[bool] = None

    for_sensitive_stomach: Optional[bool] = None
    for_weight_management: Optional[bool] = None
    for_joint_health: Optional[bool] = None
    for_skin_allergies: Optional[bool] = None
    for_dental_health: Optional[bool] = None
    for_kidney_health: Optional[bool] = None


class ProductResponse(BaseModel):
    """Schema for product response."""
    id: int
    name: str
    brand: str
    description: Optional[str] = None
    price: Optional[Decimal] = None
    product_url: Optional[str] = None
    image_url: Optional[str] = None

    # Target specifications
    target_species: str
    min_age_months: Optional[int] = None
    max_age_months: Optional[int] = None
    min_weight_kg: Optional[Decimal] = None
    max_weight_kg: Optional[Decimal] = None
    suitable_breeds: Optional[List[str]] = None

    # Nutritional profile
    protein_percentage: Optional[Decimal] = None
    fat_percentage: Optional[Decimal] = None
    fiber_percentage: Optional[Decimal] = None
    calories_per_100g: Optional[int] = None

    # Ingredient flags
    grain_free: bool = False
    organic: bool = False
    hypoallergenic: bool = False
    limited_ingredient: bool = False
    raw_food: bool = False

    # Health condition targeting
    for_sensitive_stomach: bool = False
    for_weight_management: bool = False
    for_joint_health: bool = False
    for_skin_allergies: bool = False
    for_dental_health: bool = False
    for_kidney_health: bool = False

    is_active: bool = True

    class Config:
        from_attributes = True
