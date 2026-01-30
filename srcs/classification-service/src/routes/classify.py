from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Literal
import logging

from src.services.image_utils import ImageUtils

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classify", tags=["classification"])


# Request models
class ContentCheckRequest(BaseModel):
    """Request for content safety check."""
    image: str = Field(..., description="Base64-encoded image")


class SpeciesDetectRequest(BaseModel):
    """Request for species detection."""
    image: str = Field(..., description="Base64-encoded image")
    top_k: int = Field(3, ge=1, le=10, description="Number of top predictions")


class BreedDetectRequest(BaseModel):
    """Request for breed classification."""
    image: str = Field(..., description="Base64-encoded image")
    species: Literal["dog", "cat"] = Field(..., description="Species (dog or cat)")
    top_k: int = Field(5, ge=1, le=10, description="Number of top predictions")


# Service instances (injected at startup)
nsfw_detector = None
species_classifier = None
dog_breed_classifier = None
cat_breed_classifier = None
crossbreed_detector = None


@router.post("/content")
async def check_content(request: ContentCheckRequest):
    """Check image content safety (NSFW detection).

    Returns:
        Dict with is_safe, nsfw_probability, threshold
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Run NSFW detection
        result = nsfw_detector.predict(pil_image)

        # Add threshold to response
        from src.config import settings
        result["threshold"] = settings.NSFW_REJECTION_THRESHOLD

        return result

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Content check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Content check failed"}
        )


@router.post("/species")
async def detect_species(request: SpeciesDetectRequest):
    """Detect animal species from image.

    Returns:
        Dict with species, confidence, top_predictions
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Run species classification
        result = species_classifier.predict(pil_image, top_k=request.top_k)

        return result

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Species detection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Species detection failed"}
        )


@router.post("/breed")
async def detect_breed(request: BreedDetectRequest):
    """Detect breed from image (dog or cat).

    Returns:
        Dict with breed_analysis including crossbreed detection
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Select appropriate classifier
        if request.species == "dog":
            classifier = dog_breed_classifier
        else:  # cat
            classifier = cat_breed_classifier

        # Run breed classification
        breed_probabilities = classifier.predict(pil_image, top_k=request.top_k)

        # Process with crossbreed detector
        breed_analysis = crossbreed_detector.process_breed_result(breed_probabilities)

        return {"breed_analysis": breed_analysis}

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Breed detection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Breed detection failed"}
        )
