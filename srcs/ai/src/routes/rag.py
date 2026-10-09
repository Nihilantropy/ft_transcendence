"""RAG API endpoints."""

from fastapi import APIRouter, HTTPException, status, Depends
import asyncio
import logging

from src.models.requests import RAGQueryRequest, RAGIngestRequest
from src.models.responses import (
    RAGQueryResponse,
    RAGSourceData,
    RAGIngestResponse,
    RAGStatusResponse,
    RAGBulkIngestResponse
)
from src.services.rag_service import RAGService
from src.services.document_processor import DocumentProcessor
from src.services.knowledge_sync import SyncInProgress, sync_knowledge_base
from src.utils.responses import success_response, error_response
from src.middleware.localhost import require_localhost

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/rag", tags=["rag"])
admin_router = APIRouter(prefix="/api/v1/admin/rag", tags=["admin_rag"])

# Service instances (injected at startup)
rag_service: RAGService = None
document_processor: DocumentProcessor = None

@admin_router.post("/initialize", response_model=dict)
async def initialize_knowledge_base(_: bool = Depends(require_localhost)):
    """Synchronise the knowledge base with the files in the knowledge_base directory.

    New .md files are ingested, modified ones replaced, deleted ones removed and
    unchanged ones skipped, so the endpoint is safe to call repeatedly at runtime.
    The periodic task started at startup runs the same function.

    SECURITY: This endpoint is restricted to localhost access only via require_localhost dependency.

    Returns:
        Standardized response with bulk ingestion stats
    """
    if document_processor is None or rag_service is None:
        logger.error("RAG services not initialized")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="SERVICE_UNAVAILABLE",
                message="RAG services are not initialized. Please restart the service."
            )
        )

    try:
        # Chunking, embedding and ChromaDB writes are blocking: keep them off the
        # event loop so this worker still answers other requests meanwhile.
        result = await asyncio.to_thread(sync_knowledge_base, rag_service, document_processor)

        data = RAGBulkIngestResponse(
            files_processed=result.files_processed,
            total_chunks_created=result.total_chunks_created,
            files_skipped=result.files_skipped,
            files_unchanged=result.files_unchanged,
            files_removed=result.files_removed,
            errors=result.errors
        )

        return success_response(data.model_dump())

    except SyncInProgress:
        logger.info("Knowledge base ingestion already in progress")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_response(
                code="INGESTION_IN_PROGRESS",
                message="A knowledge base ingestion is already running. Retry shortly."
            )
        )
    except FileNotFoundError as e:
        logger.error(str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="DIRECTORY_NOT_FOUND",
                message=str(e)
            )
        )
    except Exception as e:
        logger.error(f"Bulk ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="Failed to initialize knowledge base"
            )
        )


@router.post("/query", response_model=dict)
async def query(request: RAGQueryRequest):
    """Query the knowledge base with RAG.

    Args:
        request: RAG query request with question and optional filters

    Returns:
        Standardized response with answer and sources
    """
    if rag_service is None:
        logger.error("RAG service not initialized")
        return error_response(
            "SERVICE_UNAVAILABLE",
            "RAG service is not initialized. Please restart the service.",
            status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
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
    if document_processor is None or rag_service is None:
        logger.error("RAG services not initialized")
        return error_response(
            "SERVICE_UNAVAILABLE",
            "RAG services are not initialized. Please restart the service.",
            status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
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
    if rag_service is None:
        logger.error("RAG service not initialized")
        return error_response(
            "SERVICE_UNAVAILABLE",
            "RAG service is not initialized. Please restart the service.",
            status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
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
