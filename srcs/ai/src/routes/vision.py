from fastapi import APIRouter, HTTPException, status
import logging

from src.models.requests import VisionAnalysisRequest
from src.models.responses import VisionAnalysisResponse, VisionAnalysisData, BreedTraits
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/vision", tags=["vision"])

# Service instances (injected at startup)
image_processor: ImageProcessor = None
ollama_client: OllamaVisionClient = None

@router.post("/analyze", response_model=dict)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image to identify breed and characteristics.

    Args:
        request: Vision analysis request with image and options

    Returns:
        Standardized response with breed data

    Raises:
        HTTPException: For validation errors (422), service unavailable (503), or internal errors (500)
    """
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)
        logger.info("Image processed successfully")

        # Analyze with Ollama
        result = await ollama_client.analyze_breed(processed_image)
        logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

        # Build response
        data = VisionAnalysisData(
            breed=result["breed"],
            confidence=result["confidence"],
            traits=BreedTraits(**result["traits"]),
            health_considerations=result["health_considerations"],
            note=result.get("note")
        )

        return success_response(data.dict())

    except ValueError as e:
        # Image validation errors
        logger.warning(f"Image validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(
                code="INVALID_IMAGE",
                message=str(e)
            )
        )

    except ConnectionError as e:
        # Ollama connection failures
        logger.error(f"Ollama connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="VISION_SERVICE_UNAVAILABLE",
                message="Vision analysis temporarily unavailable, please try again"
            )
        )

    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error in vision analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred during analysis"
            )
        )
