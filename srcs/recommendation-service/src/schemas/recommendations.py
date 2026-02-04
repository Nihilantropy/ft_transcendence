"""Pydantic schemas for recommendation endpoints."""
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from decimal import Decimal


class PetProfile(BaseModel):
    """Pet profile included in recommendation response."""
    id: str  # UUID
    name: Optional[str] = None
    species: str
    breed: Optional[str] = None
    age_months: Optional[int] = None
    weight_kg: Optional[float] = None
    health_conditions: List[str] = Field(default_factory=list)

    class Config:
        extra = "allow"  # Allow additional fields from user service


class NutritionalHighlights(BaseModel):
    """Nutritional summary for a recommended product."""
    protein_percentage: Optional[Decimal] = None
    fat_percentage: Optional[Decimal] = None
    calories_per_100g: Optional[int] = None


class RecommendationItem(BaseModel):
    """Single recommendation item in response."""
    product_id: int
    name: str
    brand: str
    price: Optional[Decimal] = None
    product_url: Optional[str] = None
    image_url: Optional[str] = None
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    rank_position: int = Field(..., gt=0)
    match_reasons: List[str] = Field(default_factory=list)
    nutritional_highlights: NutritionalHighlights = Field(default_factory=NutritionalHighlights)


class RecommendationsResponse(BaseModel):
    """Response for GET /api/v1/recommendations/food endpoint."""
    pet: PetProfile
    recommendations: List[RecommendationItem]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    algorithm_version: str = "content-based-v1.0"
