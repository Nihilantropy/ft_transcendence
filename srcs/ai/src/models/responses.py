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
