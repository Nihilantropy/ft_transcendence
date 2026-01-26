"""RAG API endpoints."""

from fastapi import APIRouter, HTTPException, status
import logging

from src.models.requests import RAGQueryRequest, RAGIngestRequest
from src.models.responses import RAGQueryResponse, RAGSourceData, RAGIngestResponse, RAGStatusResponse
from src.services.rag_service import RAGService
from src.services.document_processor import DocumentProcessor
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

# Service instances (injected at startup)
rag_service: RAGService = None
document_processor: DocumentProcessor = None


@router.post("/query", response_model=dict)
async def query(request: RAGQueryRequest):
    """Query the knowledge base with RAG.

    Args:
        request: RAG query request with question and optional filters

    Returns:
        Standardized response with answer and sources
    """
    try:
        response = await rag_service.query(
            question=request.question,
            filters=request.filters,
            top_k=request.top_k
        )

        data = RAGQueryResponse(
            answer=response.answer,
            sources=[
                RAGSourceData(
                    content=s.content,
                    source_file=s.source_file,
                    relevance_score=s.relevance_score
                )
                for s in response.sources
            ],
            model=response.model
        )

        return success_response(data.model_dump())

    except ConnectionError as e:
        logger.error(f"RAG query failed - Ollama unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="RAG_SERVICE_UNAVAILABLE",
                message="RAG service temporarily unavailable"
            )
        )
    except Exception as e:
        logger.error(f"RAG query failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred"
            )
        )


@router.post("/ingest", response_model=dict)
async def ingest(request: RAGIngestRequest):
    """Ingest a document into the knowledge base.

    Args:
        request: Ingest request with content and metadata

    Returns:
        Standardized response with ingestion stats
    """
    try:
        # Process document into chunks
        chunks = document_processor.process(
            content=request.content,
            metadata={
                **request.metadata,
                "source_file": request.source_name
            }
        )

        # Add to vector store
        chunks_added = rag_service.add_documents(chunks)

        # Generate document ID from source name
        doc_id = request.source_name.replace("/", "_").replace(".", "_")

        data = RAGIngestResponse(
            chunks_created=chunks_added,
            document_id=doc_id
        )

        return success_response(data.model_dump())

    except ValueError as e:
        logger.warning(f"Ingest validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(
                code="INVALID_DOCUMENT",
                message=str(e)
            )
        )
    except Exception as e:
        logger.error(f"Document ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="Failed to ingest document"
            )
        )


@router.get("/status", response_model=dict)
async def status_check():
    """Get RAG system status.

    Returns:
        Standardized response with collection stats
    """
    try:
        stats = rag_service.get_stats()

        data = RAGStatusResponse(
            collection_name=stats["collection_name"],
            document_count=stats["document_count"],
            embedding_model=rag_service.config.EMBEDDING_MODEL
        )

        return success_response(data.model_dump())

    except Exception as e:
        logger.error(f"Status check failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="Failed to get RAG status"
            )
        )
