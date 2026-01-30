from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# Breed Analysis Models
class BreedProbability(BaseModel):
    """Individual breed probability."""
    breed: str
    probability: float = Field(..., ge=0.0, le=1.0)


class CrossbreedAnalysis(BaseModel):
    """Crossbreed detection details."""
    detected_breeds: List[str]
    common_name: Optional[str] = None
    confidence_reasoning: str


class BreedAnalysis(BaseModel):
    """Complete breed analysis with crossbreed detection."""
    primary_breed: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_likely_crossbreed: bool
    breed_probabilities: List[BreedProbability]
    crossbreed_analysis: Optional[CrossbreedAnalysis] = None


# Vision Analysis Models
class BreedTraits(BaseModel):
    """Visual trait observations."""
    size: str = Field(..., description="small/medium/large")
    energy_level: str = Field(..., description="low/medium/high")
    temperament: str = Field(..., description="Brief temperament description")


class EnrichedInfo(BaseModel):
    """RAG-enriched breed information."""
    breed: Optional[str] = None  # Single breed
    parent_breeds: Optional[List[str]] = None  # Crossbreed parents
    description: str
    care_summary: str
    health_info: str
    sources: List[str]


class VisionAnalysisData(BaseModel):
    """Vision analysis result data with multi-stage classification."""
    species: str = Field(..., description="Detected species (dog/cat)")
    breed_analysis: BreedAnalysis
    description: str = Field(..., description="Visual description of this specific animal")
    traits: Dict[str, Any] = Field(..., description="Observed traits from image")
    health_observations: List[str] = Field(..., description="Visible health indicators")
    enriched_info: Optional[EnrichedInfo] = None


class VisionAnalysisResponse(BaseModel):
    """Standardized vision analysis response."""
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str


# RAG Models (keep existing)
class RAGSourceData(BaseModel):
    """A retrieved source in RAG response."""
    content: str
    source_file: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)


class RAGQueryResponse(BaseModel):
    """RAG query response data."""
    answer: str
    sources: List[RAGSourceData]
    model: str


class RAGIngestResponse(BaseModel):
    """RAG ingest response data."""
    chunks_created: int
    document_id: str


class RAGStatusResponse(BaseModel):
    """RAG status response data."""
    collection_name: str
    document_count: int
    embedding_model: str


class RAGBulkIngestResponse(BaseModel):
    """RAG bulk ingest response data."""
    files_processed: int
    total_chunks_created: int
    files_skipped: int
    errors: List[str]
