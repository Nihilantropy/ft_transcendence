from pydantic import BaseModel, Field, validator

class VisionAnalysisOptions(BaseModel):
    """Options for vision analysis."""
    return_traits: bool = True
    return_health_info: bool = True

class VisionAnalysisRequest(BaseModel):
    """Request model for vision analysis endpoint."""
    image: str = Field(..., description="Base64-encoded image with data URI")
    options: VisionAnalysisOptions = Field(default_factory=VisionAnalysisOptions)

    @validator('image')
    def validate_image_format(cls, v):
        """Validate image is a data URI."""
        if not v.startswith('data:image/'):
            raise ValueError('Image must be a data URI')
        return v
