from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
import torch

from src.config import settings
from src.routes import classify
from src.models.nsfw_detector import NSFWDetector
from src.models.species_classifier import SpeciesClassifier
from src.models.breed_classifier import DogBreedClassifier, CatBreedClassifier
from src.services.crossbreed_detector import CrossbreedDetector

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info(f"Starting {settings.SERVICE_NAME}...")

    # Detect GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")

    # Load models (can take 60-90 seconds on first run)
    logger.info("Loading classification models...")
    nsfw = NSFWDetector(device=device, model_id=settings.NSFW_MODEL)
    species = SpeciesClassifier(device=device, model_id=settings.SPECIES_MODEL)
    dog_breed = DogBreedClassifier(device=device, model_id=settings.DOG_BREED_MODEL)
    cat_breed = CatBreedClassifier(device=device, model_id=settings.CAT_BREED_MODEL)
    crossbreed = CrossbreedDetector(settings)

    # Inject into routes
    classify.nsfw_detector = nsfw
    classify.species_classifier = species
    classify.dog_breed_classifier = dog_breed
    classify.cat_breed_classifier = cat_breed
    classify.crossbreed_detector = crossbreed

    logger.info("All models loaded successfully")
    logger.info(f"{settings.SERVICE_NAME} started successfully on port {settings.SERVICE_PORT}")

    yield

    logger.info(f"Shutting down {settings.SERVICE_NAME}...")


# Create FastAPI app
app = FastAPI(
    title="SmartBreeds Classification Service",
    description="HuggingFace models for content safety, species, and breed classification",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "port": settings.SERVICE_PORT
    }


# Include routers
app.include_router(classify.router)
