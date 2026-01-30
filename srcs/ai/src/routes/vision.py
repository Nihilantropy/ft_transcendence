from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from src.models.responses import VisionAnalysisResponse, VisionAnalysisData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/vision", tags=["vision"])


# Request model
class VisionAnalysisRequest(BaseModel):
    """Request for vision analysis."""
    image: str = Field(..., description="Base64-encoded image (with or without data URI prefix)")


# Service instances (injected at startup)
image_processor = None
vision_orchestrator = None  # Changed from ollama_client


@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image with multi-stage pipeline.

    Pipeline stages:
    1. Image processing and validation
    2. Content safety check (NSFW)
    3. Species detection (dog/cat)
    4. Breed classification (with crossbreed detection)
    5. RAG enrichment (graceful failure)
    6. Contextual Ollama visual analysis

    Returns:
        VisionAnalysisResponse with species, breed_analysis, description,
        traits, health_observations, and enriched_info
    """
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)

        # Run orchestrated pipeline
        result = await vision_orchestrator.analyze_image(processed_image)

        # Build response
        data = VisionAnalysisData(**result)
        return VisionAnalysisResponse(
            success=True,
            data=data,
            error=None,
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as e:
        # Classification rejection errors (422)
        error_code = str(e)
        error_map = {
            "CONTENT_POLICY_VIOLATION": "Image does not meet content policy requirements",
            "UNSUPPORTED_SPECIES": "Only dog and cat images are supported",
            "SPECIES_DETECTION_FAILED": "Unable to identify species with sufficient confidence",
            "BREED_DETECTION_FAILED": "Unable to identify breed with sufficient confidence",
            "INVALID_IMAGE_FORMAT": "Invalid image format or corrupted image",
            "IMAGE_TOO_LARGE": "Image size exceeds maximum allowed size",
            "IMAGE_TOO_SMALL": "Image dimensions are too small for analysis"
        }

        logger.warning(f"Validation error: {error_code}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": error_code,
                    "message": error_map.get(error_code, "Validation failed")
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    except ConnectionError as e:
        # Service unavailability (503)
        logger.error(f"Service connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "VISION_SERVICE_UNAVAILABLE",
                    "message": "Vision analysis temporarily unavailable, please try again"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        # Unexpected errors (500)
        logger.error(f"Unexpected error during vision analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred during analysis"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health")
async def health_check():
    """Vision service health check."""
    return {
        "status": "healthy",
        "service": "vision-analysis",
        "pipeline": "multi-stage"
    }
