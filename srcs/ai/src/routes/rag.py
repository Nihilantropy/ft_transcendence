"""RAG API endpoints."""

from fastapi import APIRouter, HTTPException, status, Depends
import logging
from pathlib import Path

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
    """Initialize knowledge base by ingesting all files from knowledge_base directory.

    This endpoint walks through the knowledge base directory, reads all .md files,
    processes them into chunks, and adds them to ChromaDB.

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
        # Get knowledge base directory from config
        kb_dir = Path(rag_service.config.KNOWLEDGE_BASE_DIR)

        if not kb_dir.exists():
            logger.error(f"Knowledge base directory not found: {kb_dir}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response(
                    code="DIRECTORY_NOT_FOUND",
                    message=f"Knowledge base directory not found: {kb_dir}"
                )
            )

        files_processed = 0
        files_skipped = 0
        total_chunks = 0
        errors = []

        # Walk through all subdirectories and find .md files
        for md_file in kb_dir.rglob("*.md"):
            try:
                # Read file content
                content = md_file.read_text(encoding="utf-8")

                # Get relative path for source tracking
                relative_path = md_file.relative_to(kb_dir)

                # Process document into chunks
                chunks = document_processor.process(
                    content=content,
                    metadata={
                        "source_file": str(relative_path),
                        "source_type": "knowledge_base"
                    }
                )

                # Add to vector store
                chunks_added = rag_service.add_documents(chunks)

                files_processed += 1
                total_chunks += chunks_added

                logger.info(f"Ingested {relative_path}: {chunks_added} chunks")

            except Exception as e:
                files_skipped += 1
                error_msg = f"{md_file.name}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Failed to ingest {md_file}: {e}", exc_info=True)

        # Build response
        data = RAGBulkIngestResponse(
            files_processed=files_processed,
            total_chunks_created=total_chunks,
            files_skipped=files_skipped,
            errors=errors
        )

        logger.info(f"Bulk ingestion complete: {files_processed} files, {total_chunks} chunks")

        return success_response(data.model_dump())

    except HTTPException:
        raise
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
