from typing import Optional, List
from pydantic import BaseModel, Field

class BreedTraits(BaseModel):
    """Breed characteristic traits."""
    size: str = Field(..., description="small/medium/large")
    energy_level: str = Field(..., description="low/medium/high")
    temperament: str = Field(..., description="Brief temperament description")

class VisionAnalysisData(BaseModel):
    """Vision analysis result data."""
    breed: str
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    traits: BreedTraits
    health_considerations: List[str]
    note: Optional[str] = None

class VisionAnalysisResponse(BaseModel):
    """Standardized vision analysis response."""
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str
