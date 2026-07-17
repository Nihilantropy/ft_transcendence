from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any


class VisionAnalysisOptions(BaseModel):
    """Options for vision analysis."""
    return_traits: bool = True
    return_health_info: bool = True
    enrich: bool = False  # Fetch RAG context for breed


class VisionAnalysisRequest(BaseModel):
    """Request model for vision analysis endpoint."""
    image: str = Field(..., description="Base64-encoded image with data URI")
    options: VisionAnalysisOptions = Field(default_factory=VisionAnalysisOptions)

    @field_validator('image')
    @classmethod
    def validate_image_format(cls, v):
        """Validate image is a data URI."""
        if not v.startswith('data:image/'):
            raise ValueError('Image must be a data URI')
        return v


class RAGQueryRequest(BaseModel):
    """Request model for RAG query endpoint."""
    question: str = Field(..., min_length=1, description="Question to answer")
    filters: Optional[Dict[str, Any]] = Field(None, description="Metadata filters")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")

    @field_validator('question')
    @classmethod
    def question_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Question cannot be empty')
        return v.strip()


class RAGIngestRequest(BaseModel):
    """Request model for RAG document ingestion."""
    content: str = Field(..., min_length=1, description="Document content (markdown)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    source_name: str = Field(..., min_length=1, description="Source file name for tracking")
