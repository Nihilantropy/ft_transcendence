"""Shared test fixtures for classification service."""
import pytest
from unittest.mock import Mock
from fastapi.testclient import TestClient
import base64
from io import BytesIO
from PIL import Image


@pytest.fixture
def sample_image_base64():
    """Create sample base64 image."""
    img = Image.new('RGB', (224, 224), color='red')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


@pytest.fixture
def mock_nsfw_detector():
    """Mock NSFW detector."""
    mock = Mock()
    mock.predict = Mock(return_value={
        "is_safe": True,
        "nsfw_probability": 0.05
    })
    return mock


@pytest.fixture
def mock_species_classifier():
    """Mock species classifier."""
    mock = Mock()
    mock.predict = Mock(return_value={
        "species": "dog",
        "confidence": 0.95,
        "top_predictions": [
            {"species": "dog", "confidence": 0.95},
            {"species": "cat", "confidence": 0.03},
            {"species": "other", "confidence": 0.02}
        ]
    })
    return mock


@pytest.fixture
def mock_dog_breed_classifier():
    """Mock dog breed classifier."""
    mock = Mock()
    mock.predict = Mock(return_value=[
        {"breed": "golden_retriever", "probability": 0.85},
        {"breed": "labrador_retriever", "probability": 0.10},
        {"breed": "poodle", "probability": 0.03},
        {"breed": "beagle", "probability": 0.01},
        {"breed": "bulldog", "probability": 0.01}
    ])
    return mock


@pytest.fixture
def mock_cat_breed_classifier():
    """Mock cat breed classifier."""
    mock = Mock()
    mock.predict = Mock(return_value=[
        {"breed": "persian", "probability": 0.80},
        {"breed": "siamese", "probability": 0.12},
        {"breed": "maine_coon", "probability": 0.05},
        {"breed": "british_shorthair", "probability": 0.02},
        {"breed": "bengal", "probability": 0.01}
    ])
    return mock


@pytest.fixture
def mock_crossbreed_detector():
    """Mock crossbreed detector."""
    mock = Mock()
    mock.process_breed_result = Mock(return_value={
        "primary_breed": "golden_retriever",
        "confidence": 0.85,
        "is_likely_crossbreed": False,
        "breed_probabilities": [
            {"breed": "golden_retriever", "probability": 0.85},
            {"breed": "labrador_retriever", "probability": 0.10},
            {"breed": "poodle", "probability": 0.03},
            {"breed": "beagle", "probability": 0.01},
            {"breed": "bulldog", "probability": 0.01}
        ],
        "crossbreed_analysis": None
    })
    return mock


@pytest.fixture
def client(
    mock_nsfw_detector,
    mock_species_classifier,
    mock_dog_breed_classifier,
    mock_cat_breed_classifier,
    mock_crossbreed_detector
):
    """Create test client with mocked classifiers."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from src.routes import classify
    from src.config import settings

    # Create app WITHOUT lifespan to prevent model loading
    app = FastAPI(
        title="SmartBreeds Classification Service",
        description="HuggingFace models for content safety, species, and breed classification",
        version="1.0.0"
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.SERVICE_NAME,
            "port": settings.SERVICE_PORT
        }

    # Inject mocks into route module (bypasses lifespan initialization)
    classify.nsfw_detector = mock_nsfw_detector
    classify.species_classifier = mock_species_classifier
    classify.dog_breed_classifier = mock_dog_breed_classifier
    classify.cat_breed_classifier = mock_cat_breed_classifier
    classify.crossbreed_detector = mock_crossbreed_detector

    # Include routers AFTER setting mocks
    app.include_router(classify.router)

    return TestClient(app)
