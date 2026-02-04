"""Recommendation API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from src.schemas.recommendations import RecommendationsResponse, RecommendationItem, NutritionalHighlights
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
    pet_id: str = Query(..., description="Pet ID to get recommendations for (UUID)"),
    limit: int = Query(DEFAULT_RECOMMENDATION_LIMIT, ge=1, le=MAX_RECOMMENDATION_LIMIT),
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum similarity score threshold"),
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

    user_id = x_user_id  # UUID string from API Gateway

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

    # Map user-service field names to recommendation-service conventions
    # user-service: age (int), weight (float) — no unit suffix in model
    pet_data["age_months"] = pet_data.get("age")
    pet_data["weight_kg"] = pet_data.get("weight")

    # Step 2: Get active products (filter by species if available)
    product_service = ProductService(db)
    species = pet_data.get("species")
    products = await product_service.get_active_products(species=species)

    if not products:
        from src.schemas.recommendations import PetProfile

        pet_profile = PetProfile(
            id=pet_data.get("id", pet_id),
            name=pet_data.get("name"),
            species=pet_data.get("species", "unknown"),
            breed=pet_data.get("breed"),
            age_months=pet_data.get("age_months"),
            weight_kg=pet_data.get("weight_kg"),
            health_conditions=pet_data.get("health_conditions", [])
        )

        return success_response(
            RecommendationsResponse(
                pet=pet_profile,
                recommendations=[],
                metadata={
                    "message": "No products available for this species",
                    "total_products_evaluated": 0,
                    "products_above_threshold": 0
                }
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

    # Step 5: Build response (top N recommendations, filtered by min_score)
    recommendations = []
    rank = 0
    for product_idx, score in ranked:
        if score < min_score:
            break  # ranked is sorted descending; all remaining scores are lower
        rank += 1
        if rank > limit:
            break

        product = products[product_idx]

        # Generate match reasons
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
                match_reasons=match_reasons,
                nutritional_highlights=NutritionalHighlights(
                    protein_percentage=product.protein_percentage,
                    fat_percentage=product.fat_percentage,
                    calories_per_100g=product.calories_per_100g
                )
            )
        )

    # Build response with full pet profile
    from src.schemas.recommendations import PetProfile

    pet_profile = PetProfile(
        id=pet_data.get("id", pet_id),
        name=pet_data.get("name"),
        species=pet_data.get("species", "unknown"),
        breed=pet_data.get("breed"),
        age_months=pet_data.get("age_months"),
        weight_kg=pet_data.get("weight_kg"),
        health_conditions=pet_data.get("health_conditions", [])
    )

    response_data = RecommendationsResponse(
        pet=pet_profile,
        recommendations=recommendations,
        metadata={
            "total_products_evaluated": len(products),
            "products_above_threshold": len(recommendations),
            "recommendations_returned": len(recommendations),
        }
    )

    return success_response(response_data.dict())
