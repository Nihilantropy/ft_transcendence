from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from src.config import Settings
from src.routes import vision, rag
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.services.embedder import Embedder
from src.services.document_processor import DocumentProcessor
from src.services.rag_service import RAGService
from src.services.classification_client import ClassificationClient
from src.services.vision_orchestrator import VisionOrchestrator
from src.utils.logger import setup_logging

# Initialize settings
settings = Settings()

# Setup logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME}...")

    # Initialize core services
    image_processor = ImageProcessor(settings)
    ollama_client = OllamaVisionClient(settings)
    classification_client = ClassificationClient(settings)

    # Initialize RAG services
    logger.info("Initializing RAG services...")
    embedder = Embedder(settings)
    document_processor = DocumentProcessor(settings)
    rag_service = RAGService(settings, embedder, ollama_client)

    # Initialize orchestrator
    vision_orchestrator = VisionOrchestrator(
        classification_client,
        ollama_client,
        rag_service,
        settings
    )

    # Inject into routes
    vision.image_processor = image_processor
    vision.vision_orchestrator = vision_orchestrator

    rag.rag_service = rag_service
    rag.document_processor = document_processor

    logger.info(f"LLM proxy URL: {settings.LLM_BASE_URL}")
    logger.info(f"Vision model: {settings.LLM_VISION_MODEL} | Text model: {settings.LLM_TEXT_MODEL}")
    logger.info(f"Classification enabled: {settings.CLASSIFICATION_ENABLED}")
    logger.info(f"RAG Collection: {settings.CHROMA_COLLECTION_NAME}")
    logger.info(f"{settings.SERVICE_NAME} started successfully")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}...")

# Create FastAPI app
app = FastAPI(
    title="SmartBreeds AI Service",
    description="Multi-stage vision analysis pipeline for pet breed identification",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # API Gateway handles actual CORS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "llm_url": settings.LLM_BASE_URL,
        "vision_model": settings.LLM_VISION_MODEL,
        "text_model": settings.LLM_TEXT_MODEL,
        "classification_enabled": settings.CLASSIFICATION_ENABLED
    }

# Include routers
app.include_router(vision.router)
app.include_router(rag.router)
app.include_router(rag.admin_router)
