from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any


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
