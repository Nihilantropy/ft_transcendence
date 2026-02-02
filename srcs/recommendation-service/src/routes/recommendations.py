"""Recommendation API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from src.schemas.recommendations import RecommendationsResponse, RecommendationItem
from src.services.user_service_client import UserServiceClient
from src.services.product_service import ProductService
from src.services.feature_engineering import PetFeatureExtractor, ProductFeatureExtractor
from src.services.similarity_engine import SimilarityEngine
from src.utils.database import get_db
from src.utils.responses import success_response, error_response
from src.config import DEFAULT_RECOMMENDATION_LIMIT, MAX_RECOMMENDATION_LIMIT

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("/food")
async def get_food_recommendations(
    pet_id: int = Query(..., description="Pet ID to get recommendations for"),
    limit: int = Query(DEFAULT_RECOMMENDATION_LIMIT, ge=1, le=MAX_RECOMMENDATION_LIMIT),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get personalized food recommendations for a pet.

    Args:
        pet_id: Pet ID to recommend for
        limit: Number of recommendations to return (default 10, max 50)
        x_user_id: User ID from API Gateway authentication
        db: Database session

    Returns:
        RecommendationsResponse with ranked product recommendations
    """
    # Validate user ID
    if not x_user_id:
        return error_response(
            "UNAUTHORIZED",
            "User ID required (X-User-ID header missing)",
            {"pet_id": pet_id}
        )

    user_id = int(x_user_id)

    # Step 1: Fetch pet profile from user-service
    user_client = UserServiceClient()
    pet_data = await user_client.get_pet_profile(pet_id=pet_id, user_id=user_id)

    if not pet_data:
        raise HTTPException(
            status_code=404,
            detail=error_response(
                "PET_NOT_FOUND",
                f"Pet with ID {pet_id} not found or access denied",
                {"pet_id": pet_id, "user_id": user_id}
            )
        )

    # Step 2: Get active products (filter by species if available)
    product_service = ProductService(db)
    species = pet_data.get("species")
    products = await product_service.get_active_products(species=species)

    if not products:
        return success_response(
            RecommendationsResponse(
                pet_id=pet_id,
                pet_name=pet_data.get("name"),
                recommendations=[],
                total_products_evaluated=0
            ).dict()
        )

    # Step 3: Extract features
    pet_extractor = PetFeatureExtractor()
    product_extractor = ProductFeatureExtractor()

    pet_features = pet_extractor.extract(pet_data)
    product_features_list = [product_extractor.extract(p) for p in products]

    # Step 4: Calculate similarities and rank
    similarity_engine = SimilarityEngine()
    ranked = similarity_engine.rank_products(pet_features, product_features_list)

    # Step 5: Build response (top N recommendations)
    recommendations = []
    for rank, (product_idx, score) in enumerate(ranked[:limit], start=1):
        product = products[product_idx]

        # Generate match reasons (simplified for now)
        match_reasons = []
        if product.for_joint_health and "joint_health" in pet_data.get("health_conditions", []):
            match_reasons.append("Targets joint health")
        if product.for_sensitive_stomach and "sensitive_stomach" in pet_data.get("health_conditions", []):
            match_reasons.append("Good for sensitive stomach")
        if not match_reasons:
            match_reasons.append("Nutritionally compatible")

        recommendations.append(
            RecommendationItem(
                product_id=product.id,
                name=product.name,
                brand=product.brand,
                price=product.price,
                product_url=product.product_url,
                image_url=product.image_url,
                similarity_score=score,
                rank_position=rank,
                match_reasons=match_reasons
            )
        )

    response_data = RecommendationsResponse(
        pet_id=pet_id,
        pet_name=pet_data.get("name"),
        recommendations=recommendations,
        total_products_evaluated=len(products)
    )

    return success_response(response_data.dict())
