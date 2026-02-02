"""Pydantic schemas for recommendation endpoints."""
from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal


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


class RecommendationsResponse(BaseModel):
    """Response for GET /api/v1/recommendations/food endpoint."""
    pet_id: int
    pet_name: Optional[str] = None
    recommendations: List[RecommendationItem]
    total_products_evaluated: int
    algorithm_version: str = "content-based-v1.0"
