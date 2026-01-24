from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from src.config import Settings
from src.routes import vision
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
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

    # Initialize services
    image_processor = ImageProcessor(settings)
    ollama_client = OllamaVisionClient(settings)

    # Inject into routes
    vision.image_processor = image_processor
    vision.ollama_client = ollama_client

    logger.info(f"Ollama URL: {settings.OLLAMA_BASE_URL}")
    logger.info(f"Model: {settings.OLLAMA_MODEL}")
    logger.info(f"{settings.SERVICE_NAME} started successfully")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}...")

# Create FastAPI app
app = FastAPI(
    title="SmartBreeds AI Service",
    description="AI-powered pet breed identification and analysis",
    version="1.0.0",
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
        "ollama_url": settings.OLLAMA_BASE_URL,
        "model": settings.OLLAMA_MODEL
    }

# Include routers
app.include_router(vision.router)
