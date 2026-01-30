# Multi-Stage Vision Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a multi-stage vision analysis pipeline with dedicated classification service for improved breed detection accuracy and focused Ollama visual analysis.

**Architecture:** Creates new classification-service microservice with 4 HuggingFace models (NSFW, species, dog breeds, cat breeds). AI service orchestrates sequential pipeline: classification → RAG enrichment → contextual Ollama analysis. VisionOrchestrator coordinates stages with early rejection.

**Tech Stack:** FastAPI, PyTorch 2.5+, HuggingFace Transformers 4.46+, ChromaDB, Ollama qwen3-vl:8b, Docker GPU runtime

---

## Phase 1: Classification Service Foundation

### Task 1: Create Classification Service Directory Structure

**Files:**
- Create: `srcs/classification-service/Dockerfile`
- Create: `srcs/classification-service/requirements.txt`
- Create: `srcs/classification-service/.env`
- Create: `srcs/classification-service/src/__init__.py`
- Create: `srcs/classification-service/src/main.py`
- Create: `srcs/classification-service/src/config.py`
- Create: `srcs/classification-service/tests/__init__.py`

**Step 1: Create directory structure**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs
mkdir -p classification-service/src/models
mkdir -p classification-service/src/services
mkdir -p classification-service/src/routes
mkdir -p classification-service/tests
touch classification-service/src/__init__.py
touch classification-service/src/models/__init__.py
touch classification-service/src/services/__init__.py
touch classification-service/src/routes/__init__.py
touch classification-service/tests/__init__.py
```

**Step 2: Write requirements.txt**

File: `srcs/classification-service/requirements.txt`
```txt
fastapi==0.115.0
uvicorn[standard]==0.32.0
torch==2.5.1
torchvision==0.20.1
transformers==4.46.3
pillow==11.0.0
pydantic==2.10.3
pydantic-settings==2.6.1
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0
```

**Step 3: Write Dockerfile**

File: `srcs/classification-service/Dockerfile`
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/

# Create non-root user
RUN useradd -m -u 1000 classifier && \
    mkdir -p /app/.cache/huggingface && \
    chown -R classifier:classifier /app
USER classifier

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:3004/health || exit 1

EXPOSE 3004

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3004"]
```

**Step 4: Write .env configuration**

File: `srcs/classification-service/.env`
```bash
# Service
SERVICE_NAME=classification-service
SERVICE_PORT=3004
LOG_LEVEL=INFO

# Models (HuggingFace model IDs)
NSFW_MODEL=Falconsai/nsfw_image_detection
SPECIES_MODEL=dima806/animal_151_types_image_detection
DOG_BREED_MODEL=wesleyacheng/dog-breeds-multiclass-image-classification-with-vit
CAT_BREED_MODEL=dima806/cat_breed_image_detection

# Thresholds
NSFW_REJECTION_THRESHOLD=0.70
SPECIES_MIN_CONFIDENCE=0.60
BREED_MIN_CONFIDENCE=0.40

# Crossbreed Detection
CROSSBREED_PROBABILITY_THRESHOLD=0.35
PUREBRED_CONFIDENCE_THRESHOLD=0.75
PUREBRED_GAP_THRESHOLD=0.30

# HuggingFace Cache
TRANSFORMERS_CACHE=/app/.cache/huggingface
HF_HOME=/app/.cache/huggingface
```

**Step 5: Write config.py**

File: `srcs/classification-service/src/config.py`
```python
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Classification service configuration."""

    # Service
    SERVICE_NAME: str = "classification-service"
    SERVICE_PORT: int = 3004
    LOG_LEVEL: str = "INFO"

    # HuggingFace Models
    NSFW_MODEL: str = "Falconsai/nsfw_image_detection"
    SPECIES_MODEL: str = "dima806/animal_151_types_image_detection"
    DOG_BREED_MODEL: str = "wesleyacheng/dog-breeds-multiclass-image-classification-with-vit"
    CAT_BREED_MODEL: str = "dima806/cat_breed_image_detection"

    # Classification Thresholds
    NSFW_REJECTION_THRESHOLD: float = 0.70
    SPECIES_MIN_CONFIDENCE: float = 0.60
    BREED_MIN_CONFIDENCE: float = 0.40

    # Crossbreed Detection Thresholds
    CROSSBREED_PROBABILITY_THRESHOLD: float = 0.35
    PUREBRED_CONFIDENCE_THRESHOLD: float = 0.75
    PUREBRED_GAP_THRESHOLD: float = 0.30

    # HuggingFace
    TRANSFORMERS_CACHE: str = "/app/.cache/huggingface"
    HF_HOME: str = "/app/.cache/huggingface"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
```

**Step 6: Write minimal main.py (health check only)**

File: `srcs/classification-service/src/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from src.config import settings

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
```

**Step 7: Test health endpoint locally**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m uvicorn src.main:app --host 0.0.0.0 --port 3004 &
sleep 2
curl http://localhost:3004/health
kill %1
```

Expected output:
```json
{"status":"healthy","service":"classification-service","port":3004}
```

**Step 8: Commit foundation**

```bash
git add srcs/classification-service/
git commit -m "feat(classification): create service foundation with health check

- Add Dockerfile with Python 3.11 and PyTorch dependencies
- Add requirements.txt with FastAPI, transformers, torch
- Add config with HuggingFace model IDs and thresholds
- Add minimal main.py with health endpoint
- Configure NSFW, species, and breed detection thresholds

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Image Utilities Service

**Files:**
- Create: `srcs/classification-service/src/services/image_utils.py`
- Create: `srcs/classification-service/tests/test_image_utils.py`

**Step 1: Write failing test for base64 to PIL conversion**

File: `srcs/classification-service/tests/test_image_utils.py`
```python
import pytest
import base64
from io import BytesIO
from PIL import Image

from src.services.image_utils import ImageUtils


@pytest.fixture
def sample_image_base64():
    """Create a sample base64-encoded image."""
    img = Image.new('RGB', (100, 100), color='red')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


@pytest.fixture
def sample_image_base64_no_prefix():
    """Create a sample base64-encoded image without data URI prefix."""
    img = Image.new('RGB', (100, 100), color='blue')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    return base64.b64encode(buffer.getvalue()).decode()


def test_decode_base64_with_data_uri(sample_image_base64):
    """Test decoding base64 image with data URI prefix."""
    pil_image = ImageUtils.decode_base64(sample_image_base64)

    assert isinstance(pil_image, Image.Image)
    assert pil_image.size == (100, 100)
    assert pil_image.mode == 'RGB'


def test_decode_base64_without_prefix(sample_image_base64_no_prefix):
    """Test decoding base64 image without data URI prefix."""
    pil_image = ImageUtils.decode_base64(sample_image_base64_no_prefix)

    assert isinstance(pil_image, Image.Image)
    assert pil_image.size == (100, 100)


def test_decode_invalid_base64():
    """Test decoding invalid base64 raises ValueError."""
    with pytest.raises(ValueError, match="Failed to decode base64 image"):
        ImageUtils.decode_base64("invalid_base64_data")


def test_preprocess_image_for_model(sample_image_base64):
    """Test preprocessing image for model inference."""
    import torch

    pil_image = ImageUtils.decode_base64(sample_image_base64)
    tensor = ImageUtils.preprocess_for_model(pil_image, target_size=(224, 224))

    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (3, 224, 224)  # C, H, W
    assert tensor.dtype == torch.float32
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_image_utils.py -v
```

Expected: FAIL with "ModuleNotFoundError: No module named 'src.services.image_utils'"

**Step 3: Write minimal implementation**

File: `srcs/classification-service/src/services/image_utils.py`
```python
import base64
from io import BytesIO
from PIL import Image
import torch
from torchvision import transforms
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class ImageUtils:
    """Utility functions for image processing."""

    @staticmethod
    def decode_base64(image_base64: str) -> Image.Image:
        """Decode base64 image string to PIL Image.

        Args:
            image_base64: Base64-encoded image (with or without data URI prefix)

        Returns:
            PIL Image object

        Raises:
            ValueError: If base64 decoding fails or image cannot be opened
        """
        try:
            # Remove data URI prefix if present
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            # Decode base64
            image_bytes = base64.b64decode(image_base64)

            # Open image
            pil_image = Image.open(BytesIO(image_bytes))

            # Convert to RGB if needed (handles RGBA, grayscale, etc.)
            if pil_image.mode not in ('RGB', 'L'):
                pil_image = pil_image.convert('RGB')

            return pil_image

        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            raise ValueError(f"Failed to decode base64 image: {str(e)}")

    @staticmethod
    def preprocess_for_model(
        pil_image: Image.Image,
        target_size: Tuple[int, int] = (224, 224)
    ) -> torch.Tensor:
        """Preprocess PIL Image for model inference.

        Args:
            pil_image: PIL Image object
            target_size: Target (height, width) for resizing

        Returns:
            Preprocessed tensor of shape (C, H, W) with values in [0, 1]
        """
        transform = transforms.Compose([
            transforms.Resize(target_size),
            transforms.ToTensor(),  # Converts to [0, 1] and (C, H, W)
        ])

        tensor = transform(pil_image)
        return tensor
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_image_utils.py -v
```

Expected: All tests PASS

**Step 5: Commit image utilities**

```bash
git add srcs/classification-service/src/services/image_utils.py
git add srcs/classification-service/tests/test_image_utils.py
git commit -m "feat(classification): add image utilities for base64 decoding

- Implement ImageUtils.decode_base64() with data URI support
- Implement ImageUtils.preprocess_for_model() for tensor conversion
- Add error handling for invalid base64 and image formats
- Add comprehensive tests for decoding and preprocessing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Crossbreed Detector Service

**Files:**
- Create: `srcs/classification-service/src/services/crossbreed_detector.py`
- Create: `srcs/classification-service/tests/test_crossbreed_detector.py`

**Step 1: Write failing test for crossbreed detection**

File: `srcs/classification-service/tests/test_crossbreed_detector.py`
```python
import pytest
from src.services.crossbreed_detector import CrossbreedDetector
from src.config import Settings


@pytest.fixture
def detector():
    """Create CrossbreedDetector with default settings."""
    settings = Settings()
    return CrossbreedDetector(settings)


def test_detect_crossbreed_high_second_probability(detector):
    """Test crossbreed detection when second breed probability > 0.35."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.47},
        {"breed": "poodle", "probability": 0.36},
        {"breed": "labrador_retriever", "probability": 0.10},
        {"breed": "cocker_spaniel", "probability": 0.05},
        {"breed": "beagle", "probability": 0.02}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["primary_breed"] == "goldendoodle"
    assert result["confidence"] == pytest.approx(0.42, abs=0.01)  # Average of top 2
    assert result["is_likely_crossbreed"] is True
    assert result["crossbreed_analysis"]["common_name"] == "Goldendoodle"
    assert "Golden Retriever" in result["crossbreed_analysis"]["detected_breeds"]
    assert "Poodle" in result["crossbreed_analysis"]["detected_breeds"]


def test_detect_purebred_high_confidence(detector):
    """Test purebred detection when top breed has high confidence."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.89},
        {"breed": "labrador_retriever", "probability": 0.06},
        {"breed": "flat_coated_retriever", "probability": 0.03},
        {"breed": "english_setter", "probability": 0.01},
        {"breed": "irish_setter", "probability": 0.01}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["primary_breed"] == "golden_retriever"
    assert result["confidence"] == 0.89
    assert result["is_likely_crossbreed"] is False
    assert result["crossbreed_analysis"] is None


def test_detect_crossbreed_low_confidence_small_gap(detector):
    """Test crossbreed when top breed < 0.75 AND gap < 0.30."""
    probabilities = [
        {"breed": "golden_retriever", "probability": 0.55},
        {"breed": "labrador_retriever", "probability": 0.30},
        {"breed": "flat_coated_retriever", "probability": 0.10},
        {"breed": "english_setter", "probability": 0.03},
        {"breed": "irish_setter", "probability": 0.02}
    ]

    result = detector.process_breed_result(probabilities)

    # Gap = 0.55 - 0.30 = 0.25 < 0.30, so crossbreed
    assert result["is_likely_crossbreed"] is True
    assert result["confidence"] == pytest.approx(0.42, abs=0.01)  # Average


def test_identify_common_crossbreed_name(detector):
    """Test common crossbreed name identification."""
    assert detector.identify_common_name(["Golden Retriever", "Poodle"]) == "Goldendoodle"
    assert detector.identify_common_name(["Poodle", "Golden Retriever"]) == "Goldendoodle"  # Reversed
    assert detector.identify_common_name(["Labrador Retriever", "Poodle"]) == "Labradoodle"
    assert detector.identify_common_name(["Pug", "Beagle"]) == "Puggle"
    assert detector.identify_common_name(["Chihuahua", "Dachshund"]) == "Chiweenie"
    assert detector.identify_common_name(["Husky", "Chihuahua"]) is None  # Unknown


def test_empty_probabilities(detector):
    """Test handling of empty probabilities list."""
    result = detector.process_breed_result([])

    assert result["primary_breed"] == "unknown"
    assert result["confidence"] == 0.0
    assert result["is_likely_crossbreed"] is False
    assert result["breed_probabilities"] == []
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_crossbreed_detector.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write implementation (ported from ollama_client.py)**

File: `srcs/classification-service/src/services/crossbreed_detector.py`
```python
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class CrossbreedDetector:
    """Detect crossbreeds from breed probability distributions."""

    def __init__(self, config):
        """Initialize crossbreed detector with thresholds.

        Args:
            config: Settings instance with crossbreed detection thresholds
        """
        self.crossbreed_probability_threshold = config.CROSSBREED_PROBABILITY_THRESHOLD
        self.purebred_confidence_threshold = config.PUREBRED_CONFIDENCE_THRESHOLD
        self.purebred_gap_threshold = config.PUREBRED_GAP_THRESHOLD

        logger.info(
            f"CrossbreedDetector initialized: "
            f"prob_threshold={self.crossbreed_probability_threshold}, "
            f"purebred_threshold={self.purebred_confidence_threshold}, "
            f"gap_threshold={self.purebred_gap_threshold}"
        )

    def process_breed_result(self, breed_probabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process breed probabilities and detect crossbreeds.

        Args:
            breed_probabilities: List of {"breed": str, "probability": float}

        Returns:
            Dict with breed_analysis structure including crossbreed detection
        """
        # Sort by probability descending
        breed_probs_sorted = sorted(
            breed_probabilities,
            key=lambda x: x["probability"],
            reverse=True
        )

        # Handle empty list
        if not breed_probs_sorted:
            return {
                "primary_breed": "unknown",
                "confidence": 0.0,
                "is_likely_crossbreed": False,
                "breed_probabilities": [],
                "crossbreed_analysis": None
            }

        top_breed = breed_probs_sorted[0]
        second_breed = breed_probs_sorted[1] if len(breed_probs_sorted) > 1 else None

        # Crossbreed detection logic
        is_crossbreed = False
        crossbreed_analysis = None
        primary_breed = top_breed["breed"]
        confidence = top_breed["probability"]

        # Detect crossbreed based on probability distribution
        if second_breed:
            # Rule 1: Second breed has significant probability
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                is_crossbreed = True

            # Rule 2: Low confidence in top breed + small gap to second
            if top_breed["probability"] < self.purebred_confidence_threshold:
                probability_gap = top_breed["probability"] - second_breed["probability"]
                if probability_gap < self.purebred_gap_threshold:
                    is_crossbreed = True

        # Build crossbreed analysis if detected
        if is_crossbreed and second_breed:
            detected_breeds = [
                top_breed["breed"].replace("_", " ").title(),
                second_breed["breed"].replace("_", " ").title()
            ]

            # Identify common crossbreed name
            common_name = self.identify_common_name(detected_breeds)

            # Build reasoning
            reasoning_parts = []
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                reasoning_parts.append(
                    f"Multiple breeds with high probabilities "
                    f"({top_breed['breed']}: {top_breed['probability']:.2f}, "
                    f"{second_breed['breed']}: {second_breed['probability']:.2f})"
                )
            if top_breed["probability"] < self.purebred_confidence_threshold:
                reasoning_parts.append(
                    f"Low top-breed confidence ({top_breed['probability']:.2f})"
                )

            reasoning = ". ".join(reasoning_parts) if reasoning_parts else "Multiple breed characteristics detected"

            crossbreed_analysis = {
                "detected_breeds": detected_breeds,
                "common_name": common_name,
                "confidence_reasoning": reasoning
            }

            # Update primary breed to crossbreed name
            if common_name:
                primary_breed = common_name.lower().replace(" ", "_")
            else:
                primary_breed = f"{detected_breeds[0].lower().replace(' ', '_')}_{detected_breeds[1].lower().replace(' ', '_')}_mix"

            # Recalculate confidence as average of top 2
            confidence = round((top_breed["probability"] + second_breed["probability"]) / 2, 2)

        # Build final result
        return {
            "primary_breed": primary_breed,
            "confidence": round(confidence, 2),
            "is_likely_crossbreed": is_crossbreed,
            "breed_probabilities": [
                {"breed": bp["breed"], "probability": round(bp["probability"], 2)}
                for bp in breed_probs_sorted
            ],
            "crossbreed_analysis": crossbreed_analysis
        }

    def identify_common_name(self, breeds: List[str]) -> Optional[str]:
        """Identify common crossbreed name from parent breeds.

        Args:
            breeds: List of parent breed names (e.g., ["Golden Retriever", "Poodle"])

        Returns:
            Common crossbreed name or None
        """
        # Normalize breed names
        breeds_normalized = sorted([b.lower() for b in breeds])

        # Common crossbreed mappings
        crossbreed_map = {
            ("golden retriever", "poodle"): "Goldendoodle",
            ("labrador retriever", "poodle"): "Labradoodle",
            ("pug", "beagle"): "Puggle",
            ("cocker spaniel", "poodle"): "Cockapoo",
            ("yorkshire terrier", "poodle"): "Yorkipoo",
            ("maltese", "poodle"): "Maltipoo",
            ("cavalier king charles spaniel", "poodle"): "Cavapoo",
            ("pomeranian", "husky"): "Pomsky",
            ("chihuahua", "dachshund"): "Chiweenie",
            ("chihuahua", "yorkshire terrier"): "Chorkie",
        }

        # Try exact match
        key = tuple(breeds_normalized)
        if key in crossbreed_map:
            return crossbreed_map[key]

        # Try reversed
        key_reversed = tuple(reversed(breeds_normalized))
        if key_reversed in crossbreed_map:
            return crossbreed_map[key_reversed]

        return None
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_crossbreed_detector.py -v
```

Expected: All tests PASS

**Step 5: Commit crossbreed detector**

```bash
git add srcs/classification-service/src/services/crossbreed_detector.py
git add srcs/classification-service/tests/test_crossbreed_detector.py
git commit -m "feat(classification): add crossbreed detection logic

- Port crossbreed detection from ollama_client.py
- Implement probability distribution analysis (top-K)
- Add common crossbreed name mapping (Goldendoodle, Labradoodle, etc.)
- Calculate crossbreed confidence as average of top 2 breeds
- Add comprehensive tests for detection rules and edge cases

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Classification Models

### Task 4: NSFW Detector Model Wrapper

**Files:**
- Create: `srcs/classification-service/src/models/nsfw_detector.py`
- Create: `srcs/classification-service/tests/test_nsfw_detector.py`

**Step 1: Write failing test for NSFW detection**

File: `srcs/classification-service/tests/test_nsfw_detector.py`
```python
import pytest
from PIL import Image
from src.models.nsfw_detector import NSFWDetector
from src.config import settings


@pytest.fixture
def detector():
    """Create NSFW detector (CPU for testing)."""
    return NSFWDetector(device="cpu", model_id=settings.NSFW_MODEL)


@pytest.fixture
def safe_image():
    """Create a simple safe image (solid color)."""
    return Image.new('RGB', (224, 224), color='blue')


def test_nsfw_detector_initialization(detector):
    """Test NSFW detector initializes correctly."""
    assert detector.device == "cpu"
    assert detector.model is not None
    assert detector.processor is not None


def test_predict_safe_image(detector, safe_image):
    """Test predicting on a safe image."""
    result = detector.predict(safe_image)

    assert "is_safe" in result
    assert "nsfw_probability" in result
    assert isinstance(result["is_safe"], bool)
    assert 0.0 <= result["nsfw_probability"] <= 1.0


def test_predict_returns_low_nsfw_for_solid_color(detector, safe_image):
    """Test that solid color image has low NSFW probability."""
    result = detector.predict(safe_image)

    # Solid color should be very safe
    assert result["is_safe"] is True
    assert result["nsfw_probability"] < 0.5
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_nsfw_detector.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write implementation**

File: `srcs/classification-service/src/models/nsfw_detector.py`
```python
from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class NSFWDetector:
    """NSFW content detection using HuggingFace model."""

    def __init__(self, device: str = "cuda", model_id: str = "Falconsai/nsfw_image_detection"):
        """Initialize NSFW detector.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
        """
        self.device = device
        self.model_id = model_id

        logger.info(f"Loading NSFW detector: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info("NSFW detector loaded successfully")

    def predict(self, image: Image.Image) -> Dict[str, any]:
        """Predict NSFW probability for image.

        Args:
            image: PIL Image object

        Returns:
            Dict with is_safe (bool) and nsfw_probability (float)
        """
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get probabilities
        probs = torch.nn.functional.softmax(logits, dim=-1)

        # Assuming binary classification: [safe, nsfw]
        # (Note: Actual label mapping may vary by model)
        nsfw_prob = probs[0][1].item() if probs.shape[1] > 1 else 0.0

        return {
            "is_safe": nsfw_prob < 0.5,  # Simple threshold for now
            "nsfw_probability": round(nsfw_prob, 3)
        }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_nsfw_detector.py -v
```

Expected: All tests PASS (may take 30-60s for first model download)

**Step 5: Commit NSFW detector**

```bash
git add srcs/classification-service/src/models/nsfw_detector.py
git add srcs/classification-service/tests/test_nsfw_detector.py
git commit -m "feat(classification): add NSFW detector model wrapper

- Implement NSFWDetector using HuggingFace transformers
- Add CPU/GPU device support
- Return is_safe boolean and nsfw_probability
- Add tests for initialization and prediction

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Species Classifier Model Wrapper

**Files:**
- Create: `srcs/classification-service/src/models/species_classifier.py`
- Create: `srcs/classification-service/tests/test_species_classifier.py`

**Step 1: Write failing test for species classification**

File: `srcs/classification-service/tests/test_species_classifier.py`
```python
import pytest
from PIL import Image
from src.models.species_classifier import SpeciesClassifier
from src.config import settings


@pytest.fixture
def classifier():
    """Create species classifier (CPU for testing)."""
    return SpeciesClassifier(device="cpu", model_id=settings.SPECIES_MODEL)


@pytest.fixture
def sample_image():
    """Create a sample image."""
    return Image.new('RGB', (224, 224), color='green')


def test_species_classifier_initialization(classifier):
    """Test species classifier initializes correctly."""
    assert classifier.device == "cpu"
    assert classifier.model is not None
    assert classifier.processor is not None


def test_predict_returns_top_species(classifier, sample_image):
    """Test prediction returns top species with confidence."""
    result = classifier.predict(sample_image, top_k=3)

    assert "species" in result
    assert "confidence" in result
    assert "top_predictions" in result
    assert isinstance(result["species"], str)
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["top_predictions"]) == 3
    assert all("label" in pred and "confidence" in pred for pred in result["top_predictions"])


def test_top_k_parameter(classifier, sample_image):
    """Test top_k parameter controls number of predictions."""
    result = classifier.predict(sample_image, top_k=5)

    assert len(result["top_predictions"]) == 5


def test_predictions_sorted_descending(classifier, sample_image):
    """Test predictions are sorted by confidence descending."""
    result = classifier.predict(sample_image, top_k=5)

    confidences = [pred["confidence"] for pred in result["top_predictions"]]
    assert confidences == sorted(confidences, reverse=True)
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_species_classifier.py -v
```

Expected: FAIL

**Step 3: Write implementation**

File: `srcs/classification-service/src/models/species_classifier.py`
```python
from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class SpeciesClassifier:
    """Species classification using HuggingFace model (151 animal types)."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "dima806/animal_151_types_image_detection"
    ):
        """Initialize species classifier.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
        """
        self.device = device
        self.model_id = model_id

        logger.info(f"Loading species classifier: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info("Species classifier loaded successfully")

    def predict(self, image: Image.Image, top_k: int = 3) -> Dict:
        """Predict animal species with top-K results.

        Args:
            image: PIL Image object
            top_k: Number of top predictions to return

        Returns:
            Dict with species, confidence, and top_predictions
        """
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get probabilities
        probs = torch.nn.functional.softmax(logits, dim=-1)[0]

        # Get top-K predictions
        top_probs, top_indices = torch.topk(probs, k=min(top_k, len(probs)))

        # Map indices to labels
        id2label = self.model.config.id2label
        top_predictions = [
            {
                "label": id2label[idx.item()].lower(),
                "confidence": round(prob.item(), 3)
            }
            for prob, idx in zip(top_probs, top_indices)
        ]

        return {
            "species": top_predictions[0]["label"],
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions
        }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_species_classifier.py -v
```

Expected: All tests PASS

**Step 5: Commit species classifier**

```bash
git add srcs/classification-service/src/models/species_classifier.py
git add srcs/classification-service/tests/test_species_classifier.py
git commit -m "feat(classification): add species classifier (151 animals)

- Implement SpeciesClassifier using HuggingFace ViT
- Support top-K predictions with confidence scores
- Return species, confidence, and top_predictions
- Add tests for initialization, prediction, and sorting

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Breed Classifiers (Dog and Cat)

**Files:**
- Create: `srcs/classification-service/src/models/breed_classifier.py`
- Create: `srcs/classification-service/tests/test_breed_classifier.py`

**Step 1: Write failing test for breed classification**

File: `srcs/classification-service/tests/test_breed_classifier.py`
```python
import pytest
from PIL import Image
from src.models.breed_classifier import DogBreedClassifier, CatBreedClassifier
from src.config import settings


@pytest.fixture
def dog_classifier():
    """Create dog breed classifier (CPU for testing)."""
    return DogBreedClassifier(device="cpu", model_id=settings.DOG_BREED_MODEL)


@pytest.fixture
def cat_classifier():
    """Create cat breed classifier (CPU for testing)."""
    return CatBreedClassifier(device="cpu", model_id=settings.CAT_BREED_MODEL)


@pytest.fixture
def sample_image():
    """Create a sample image."""
    return Image.new('RGB', (224, 224), color='brown')


def test_dog_classifier_initialization(dog_classifier):
    """Test dog breed classifier initializes correctly."""
    assert dog_classifier.device == "cpu"
    assert dog_classifier.model is not None
    assert dog_classifier.processor is not None


def test_cat_classifier_initialization(cat_classifier):
    """Test cat breed classifier initializes correctly."""
    assert cat_classifier.device == "cpu"
    assert cat_classifier.model is not None


def test_dog_predict_returns_top_k(dog_classifier, sample_image):
    """Test dog classifier returns top-K breed predictions."""
    result = dog_classifier.predict(sample_image, top_k=5)

    assert len(result) == 5
    assert all("breed" in pred and "probability" in pred for pred in result)
    assert all(0.0 <= pred["probability"] <= 1.0 for pred in result)


def test_cat_predict_returns_top_k(cat_classifier, sample_image):
    """Test cat classifier returns top-K breed predictions."""
    result = cat_classifier.predict(sample_image, top_k=5)

    assert len(result) == 5
    assert all("breed" in pred and "probability" in pred for pred in result)


def test_predictions_sorted_descending(dog_classifier, sample_image):
    """Test predictions are sorted by probability descending."""
    result = dog_classifier.predict(sample_image, top_k=5)

    probabilities = [pred["probability"] for pred in result]
    assert probabilities == sorted(probabilities, reverse=True)


def test_probabilities_sum_to_one(dog_classifier, sample_image):
    """Test all probabilities sum to approximately 1.0."""
    # Get all predictions
    result = dog_classifier.predict(sample_image, top_k=120)  # All breeds

    total_prob = sum(pred["probability"] for pred in result)
    assert 0.99 <= total_prob <= 1.01  # Allow small floating point error
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_breed_classifier.py -v
```

Expected: FAIL

**Step 3: Write implementation**

File: `srcs/classification-service/src/models/breed_classifier.py`
```python
from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class BreedClassifierBase:
    """Base class for breed classifiers."""

    def __init__(self, device: str, model_id: str, species: str):
        """Initialize breed classifier.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
            species: Species name for logging (dog/cat)
        """
        self.device = device
        self.model_id = model_id
        self.species = species

        logger.info(f"Loading {species} breed classifier: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info(f"{species.capitalize()} breed classifier loaded successfully")

    def predict(self, image: Image.Image, top_k: int = 5) -> List[Dict]:
        """Predict breed with top-K results.

        Args:
            image: PIL Image object
            top_k: Number of top predictions to return

        Returns:
            List of {"breed": str, "probability": float} sorted descending
        """
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get probabilities
        probs = torch.nn.functional.softmax(logits, dim=-1)[0]

        # Get top-K predictions
        top_probs, top_indices = torch.topk(probs, k=min(top_k, len(probs)))

        # Map indices to breed labels
        id2label = self.model.config.id2label
        top_predictions = [
            {
                "breed": id2label[idx.item()].lower().replace(" ", "_").replace("-", "_"),
                "probability": round(prob.item(), 3)
            }
            for prob, idx in zip(top_probs, top_indices)
        ]

        return top_predictions


class DogBreedClassifier(BreedClassifierBase):
    """Dog breed classifier using ViT model (120 breeds)."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "wesleyacheng/dog-breeds-multiclass-image-classification-with-vit"
    ):
        """Initialize dog breed classifier."""
        super().__init__(device=device, model_id=model_id, species="dog")


class CatBreedClassifier(BreedClassifierBase):
    """Cat breed classifier."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "dima806/cat_breed_image_detection"
    ):
        """Initialize cat breed classifier."""
        super().__init__(device=device, model_id=model_id, species="cat")
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_breed_classifier.py -v
```

Expected: All tests PASS (may take 60-90s for model downloads)

**Step 5: Commit breed classifiers**

```bash
git add srcs/classification-service/src/models/breed_classifier.py
git add srcs/classification-service/tests/test_breed_classifier.py
git commit -m "feat(classification): add dog and cat breed classifiers

- Implement BreedClassifierBase with shared logic
- Add DogBreedClassifier (120 breeds, ViT-based)
- Add CatBreedClassifier
- Return top-K predictions with normalized breed names
- Add comprehensive tests for both classifiers

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Classification Service API

### Task 7: Classification Routes

**Files:**
- Create: `srcs/classification-service/src/routes/classify.py`
- Create: `srcs/classification-service/tests/test_classify_routes.py`
- Modify: `srcs/classification-service/src/main.py`

**Step 1: Write failing test for classification endpoints**

File: `srcs/classification-service/tests/test_classify_routes.py`
```python
import pytest
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
def client():
    """Create test client."""
    from src.main import app
    return TestClient(app)


def test_classify_content_endpoint(client, sample_image_base64):
    """Test POST /classify/content endpoint."""
    response = client.post(
        "/classify/content",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 200
    data = response.json()
    assert "is_safe" in data
    assert "nsfw_probability" in data
    assert "threshold" in data
    assert isinstance(data["is_safe"], bool)


def test_classify_species_endpoint(client, sample_image_base64):
    """Test POST /classify/species endpoint."""
    response = client.post(
        "/classify/species",
        json={"image": sample_image_base64}
    )

    assert response.status_code == 200
    data = response.json()
    assert "species" in data
    assert "confidence" in data
    assert "top_predictions" in data
    assert len(data["top_predictions"]) == 3  # Default top_k


def test_classify_breed_endpoint_dog(client, sample_image_base64):
    """Test POST /classify/breed endpoint for dog."""
    response = client.post(
        "/classify/breed",
        json={
            "image": sample_image_base64,
            "species": "dog",
            "top_k": 5
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "breed_analysis" in data
    assert "primary_breed" in data["breed_analysis"]
    assert "confidence" in data["breed_analysis"]
    assert "is_likely_crossbreed" in data["breed_analysis"]
    assert len(data["breed_analysis"]["breed_probabilities"]) == 5


def test_classify_breed_invalid_species(client, sample_image_base64):
    """Test breed classification with invalid species."""
    response = client.post(
        "/classify/breed",
        json={
            "image": sample_image_base64,
            "species": "rabbit",
            "top_k": 5
        }
    )

    assert response.status_code == 422  # Validation error


def test_classify_content_invalid_image(client):
    """Test content classification with invalid base64."""
    response = client.post(
        "/classify/content",
        json={"image": "invalid_base64"}
    )

    assert response.status_code == 422
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_classify_routes.py -v
```

Expected: FAIL (routes don't exist yet)

**Step 3: Write classify routes**

File: `srcs/classification-service/src/routes/classify.py`
```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Literal
import logging

from src.services.image_utils import ImageUtils

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classify", tags=["classification"])


# Request models
class ContentCheckRequest(BaseModel):
    """Request for content safety check."""
    image: str = Field(..., description="Base64-encoded image")


class SpeciesDetectRequest(BaseModel):
    """Request for species detection."""
    image: str = Field(..., description="Base64-encoded image")
    top_k: int = Field(3, ge=1, le=10, description="Number of top predictions")


class BreedDetectRequest(BaseModel):
    """Request for breed classification."""
    image: str = Field(..., description="Base64-encoded image")
    species: Literal["dog", "cat"] = Field(..., description="Species (dog or cat)")
    top_k: int = Field(5, ge=1, le=10, description="Number of top predictions")


# Service instances (injected at startup)
nsfw_detector = None
species_classifier = None
dog_breed_classifier = None
cat_breed_classifier = None
crossbreed_detector = None


@router.post("/content")
async def check_content(request: ContentCheckRequest):
    """Check image content safety (NSFW detection).

    Returns:
        Dict with is_safe, nsfw_probability, threshold
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Run NSFW detection
        result = nsfw_detector.predict(pil_image)

        # Add threshold to response
        from src.config import settings
        result["threshold"] = settings.NSFW_REJECTION_THRESHOLD

        return result

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Content check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Content check failed"}
        )


@router.post("/species")
async def detect_species(request: SpeciesDetectRequest):
    """Detect animal species from image.

    Returns:
        Dict with species, confidence, top_predictions
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Run species classification
        result = species_classifier.predict(pil_image, top_k=request.top_k)

        return result

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Species detection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Species detection failed"}
        )


@router.post("/breed")
async def detect_breed(request: BreedDetectRequest):
    """Detect breed from image (dog or cat).

    Returns:
        Dict with breed_analysis including crossbreed detection
    """
    try:
        # Decode image
        pil_image = ImageUtils.decode_base64(request.image)

        # Select appropriate classifier
        if request.species == "dog":
            classifier = dog_breed_classifier
        else:  # cat
            classifier = cat_breed_classifier

        # Run breed classification
        breed_probabilities = classifier.predict(pil_image, top_k=request.top_k)

        # Process with crossbreed detector
        breed_analysis = crossbreed_detector.process_breed_result(breed_probabilities)

        return {"breed_analysis": breed_analysis}

    except ValueError as e:
        logger.warning(f"Invalid image: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_IMAGE", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Breed detection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CLASSIFICATION_ERROR", "message": "Breed detection failed"}
        )
```

**Step 4: Update main.py to load models and inject into routes**

File: `srcs/classification-service/src/main.py` (modify lifespan)
```python
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
```

**Step 5: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/classification-service
python -m pytest tests/test_classify_routes.py -v
```

Expected: All tests PASS

**Step 6: Commit classification routes**

```bash
git add srcs/classification-service/src/routes/classify.py
git add srcs/classification-service/tests/test_classify_routes.py
git add srcs/classification-service/src/main.py
git commit -m "feat(classification): add classification API endpoints

- Add POST /classify/content (NSFW detection)
- Add POST /classify/species (animal detection)
- Add POST /classify/breed (dog/cat breed with crossbreed)
- Load all models in lifespan with GPU detection
- Inject model instances into routes
- Add comprehensive endpoint tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Add Classification Service to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add classification-service to docker-compose.yml**

File: `docker-compose.yml` (add after ollama service)
```yaml
  classification-service:
    build:
      context: ./srcs/classification-service
      dockerfile: Dockerfile
    container_name: ft_transcendence_classification_service
    runtime: nvidia
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - TRANSFORMERS_CACHE=/app/.cache/huggingface
      - HF_HOME=/app/.cache/huggingface
    volumes:
      - huggingface-cache:/app/.cache/huggingface
    networks:
      - backend-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

**Step 2: Add huggingface-cache volume to docker-compose.yml**

File: `docker-compose.yml` (add to volumes section at bottom)
```yaml
volumes:
  # ... existing volumes ...
  huggingface-cache:
    driver: local
```

**Step 3: Build and test classification service**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence
docker compose build classification-service
docker compose up classification-service -d
sleep 90  # Wait for models to load
curl http://localhost:3004/health
docker compose down classification-service
```

Expected: `{"status":"healthy","service":"classification-service","port":3004}`

**Step 4: Commit docker-compose updates**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add classification-service to docker compose

- Add classification-service with GPU runtime
- Configure NVIDIA GPU access with capabilities
- Add huggingface-cache volume for model persistence
- Set 60s start_period for model loading
- Connect to backend-network

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: AI Service Updates

### Task 9: Update AI Service Response Models

**Files:**
- Modify: `srcs/ai/src/models/responses.py`
- Create: `srcs/ai/tests/unit/__init__.py`
- Create: `srcs/ai/tests/unit/test_response_models.py`

**Step 1: Delete old AI service tests**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
rm -rf tests/*.py
mkdir -p tests/unit tests/integration tests/fixtures
touch tests/unit/__init__.py
touch tests/integration/__init__.py
touch tests/fixtures/__init__.py
```

**Step 2: Write failing test for new response models**

File: `srcs/ai/tests/unit/test_response_models.py`
```python
import pytest
from pydantic import ValidationError

from src.models.responses import (
    BreedProbability,
    CrossbreedAnalysis,
    BreedAnalysis,
    EnrichedInfo,
    VisionAnalysisData
)


def test_breed_probability_valid():
    """Test BreedProbability with valid data."""
    bp = BreedProbability(breed="golden_retriever", probability=0.89)
    assert bp.breed == "golden_retriever"
    assert bp.probability == 0.89


def test_breed_probability_invalid_range():
    """Test BreedProbability rejects probability > 1.0."""
    with pytest.raises(ValidationError):
        BreedProbability(breed="golden_retriever", probability=1.5)


def test_crossbreed_analysis_with_common_name():
    """Test CrossbreedAnalysis with common name."""
    ca = CrossbreedAnalysis(
        detected_breeds=["Golden Retriever", "Poodle"],
        common_name="Goldendoodle",
        confidence_reasoning="Multiple breeds detected"
    )
    assert ca.common_name == "Goldendoodle"
    assert len(ca.detected_breeds) == 2


def test_breed_analysis_purebred():
    """Test BreedAnalysis for purebred."""
    ba = BreedAnalysis(
        primary_breed="golden_retriever",
        confidence=0.89,
        is_likely_crossbreed=False,
        breed_probabilities=[
            BreedProbability(breed="golden_retriever", probability=0.89)
        ],
        crossbreed_analysis=None
    )
    assert ba.is_likely_crossbreed is False
    assert ba.crossbreed_analysis is None


def test_breed_analysis_crossbreed():
    """Test BreedAnalysis for crossbreed."""
    ba = BreedAnalysis(
        primary_breed="goldendoodle",
        confidence=0.42,
        is_likely_crossbreed=True,
        breed_probabilities=[
            BreedProbability(breed="golden_retriever", probability=0.47),
            BreedProbability(breed="poodle", probability=0.36)
        ],
        crossbreed_analysis=CrossbreedAnalysis(
            detected_breeds=["Golden Retriever", "Poodle"],
            common_name="Goldendoodle",
            confidence_reasoning="Multiple breeds with high probabilities"
        )
    )
    assert ba.is_likely_crossbreed is True
    assert ba.crossbreed_analysis.common_name == "Goldendoodle"


def test_enriched_info_purebred():
    """Test EnrichedInfo for single breed."""
    ei = EnrichedInfo(
        breed="Golden Retriever",
        parent_breeds=None,
        description="Large sporting dog",
        care_summary="Daily exercise",
        health_info="Hip dysplasia",
        sources=["akc.md"]
    )
    assert ei.breed == "Golden Retriever"
    assert ei.parent_breeds is None


def test_enriched_info_crossbreed():
    """Test EnrichedInfo for crossbreed."""
    ei = EnrichedInfo(
        breed=None,
        parent_breeds=["Golden Retriever", "Poodle"],
        description="Mix of two breeds",
        care_summary="Moderate exercise",
        health_info="Varies by parent",
        sources=["akc_golden.md", "akc_poodle.md"]
    )
    assert ei.breed is None
    assert len(ei.parent_breeds) == 2


def test_vision_analysis_data_complete():
    """Test VisionAnalysisData with all fields."""
    data = VisionAnalysisData(
        species="dog",
        breed_analysis=BreedAnalysis(
            primary_breed="golden_retriever",
            confidence=0.89,
            is_likely_crossbreed=False,
            breed_probabilities=[
                BreedProbability(breed="golden_retriever", probability=0.89)
            ],
            crossbreed_analysis=None
        ),
        description="Healthy adult dog",
        traits={"size": "large", "energy_level": "high", "temperament": "friendly"},
        health_observations=["Healthy coat"],
        enriched_info=EnrichedInfo(
            breed="Golden Retriever",
            parent_breeds=None,
            description="Large sporting dog",
            care_summary="Daily exercise",
            health_info="Hip dysplasia",
            sources=["akc.md"]
        )
    )
    assert data.species == "dog"
    assert data.breed_analysis.primary_breed == "golden_retriever"
```

**Step 3: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_response_models.py -v
```

Expected: FAIL (models don't exist yet)

**Step 4: Write new response models**

File: `srcs/ai/src/models/responses.py` (replace entire file)
```python
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# Breed Analysis Models
class BreedProbability(BaseModel):
    """Individual breed probability."""
    breed: str
    probability: float = Field(..., ge=0.0, le=1.0)


class CrossbreedAnalysis(BaseModel):
    """Crossbreed detection details."""
    detected_breeds: List[str]
    common_name: Optional[str] = None
    confidence_reasoning: str


class BreedAnalysis(BaseModel):
    """Complete breed analysis with crossbreed detection."""
    primary_breed: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_likely_crossbreed: bool
    breed_probabilities: List[BreedProbability]
    crossbreed_analysis: Optional[CrossbreedAnalysis] = None


# Vision Analysis Models
class BreedTraits(BaseModel):
    """Visual trait observations."""
    size: str = Field(..., description="small/medium/large")
    energy_level: str = Field(..., description="low/medium/high")
    temperament: str = Field(..., description="Brief temperament description")


class EnrichedInfo(BaseModel):
    """RAG-enriched breed information."""
    breed: Optional[str] = None  # Single breed
    parent_breeds: Optional[List[str]] = None  # Crossbreed parents
    description: str
    care_summary: str
    health_info: str
    sources: List[str]


class VisionAnalysisData(BaseModel):
    """Vision analysis result data with multi-stage classification."""
    species: str = Field(..., description="Detected species (dog/cat)")
    breed_analysis: BreedAnalysis
    description: str = Field(..., description="Visual description of this specific animal")
    traits: Dict[str, Any] = Field(..., description="Observed traits from image")
    health_observations: List[str] = Field(..., description="Visible health indicators")
    enriched_info: Optional[EnrichedInfo] = None


class VisionAnalysisResponse(BaseModel):
    """Standardized vision analysis response."""
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str


# RAG Models (keep existing)
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
```

**Step 5: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_response_models.py -v
```

Expected: All tests PASS

**Step 6: Commit new response models**

```bash
git add srcs/ai/src/models/responses.py
git add srcs/ai/tests/unit/test_response_models.py
git add srcs/ai/tests/unit/__init__.py
git add srcs/ai/tests/integration/__init__.py
git add srcs/ai/tests/fixtures/__init__.py
git commit -m "feat(ai): update response models for multi-stage pipeline

- Add BreedProbability, CrossbreedAnalysis, BreedAnalysis
- Update VisionAnalysisData with species and breed_analysis
- Add EnrichedInfo with purebred/crossbreed support
- Remove old test files, create unit/integration structure
- Add comprehensive tests for new models

BREAKING CHANGE: VisionAnalysisData structure changed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Classification Client for AI Service

**Files:**
- Create: `srcs/ai/src/services/classification_client.py`
- Create: `srcs/ai/tests/unit/test_classification_client.py`
- Modify: `srcs/ai/src/config.py`

**Step 1: Update AI service config**

File: `srcs/ai/src/config.py` (add classification service URL)
```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Service configuration using Pydantic settings."""

    # Service
    SERVICE_NAME: str = "ai-service"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # Ollama
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen3-vl:8b"
    OLLAMA_TIMEOUT: int = 300
    OLLAMA_TEMPERATURE: float = 0.1

    # Classification Service (NEW)
    CLASSIFICATION_SERVICE_URL: str = "http://classification-service:3004"
    CLASSIFICATION_TIMEOUT: int = 30

    # Image Processing
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_IMAGE_DIMENSION: int = 1024
    MIN_IMAGE_DIMENSION: int = 224
    SUPPORTED_FORMATS: List[str] = ["jpeg", "jpg", "png", "webp"]

    # Vision Analysis (DEPRECATED - thresholds moved to classification service)
    LOW_CONFIDENCE_THRESHOLD: float = 0.5

    # RAG - ChromaDB
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "pet_knowledge"

    # RAG - Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG - Document Processing
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # RAG - Query
    RAG_TOP_K: int = 5
    RAG_MIN_RELEVANCE: float = 0.3

    # RAG - Knowledge Base
    KNOWLEDGE_BASE_DIR: str = "./data/knowledge_base"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

**Step 2: Write failing test for classification client**

File: `srcs/ai/tests/unit/test_classification_client.py`
```python
import pytest
from unittest.mock import AsyncMock, patch
import httpx

from src.services.classification_client import ClassificationClient
from src.config import Settings


@pytest.fixture
def client():
    """Create classification client with test config."""
    settings = Settings(
        CLASSIFICATION_SERVICE_URL="http://test-classification:3004",
        CLASSIFICATION_TIMEOUT=30
    )
    return ClassificationClient(settings)


@pytest.mark.asyncio
async def test_check_content_safe(client):
    """Test content safety check with safe image."""
    mock_response = {
        "is_safe": True,
        "nsfw_probability": 0.1,
        "threshold": 0.7
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.check_content("data:image/jpeg;base64,test123")

        assert result["is_safe"] is True
        assert result["nsfw_probability"] == 0.1


@pytest.mark.asyncio
async def test_detect_species(client):
    """Test species detection."""
    mock_response = {
        "species": "dog",
        "confidence": 0.87,
        "top_predictions": [
            {"label": "dog", "confidence": 0.87}
        ]
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.detect_species("data:image/jpeg;base64,test123")

        assert result["species"] == "dog"
        assert result["confidence"] == 0.87


@pytest.mark.asyncio
async def test_detect_breed(client):
    """Test breed detection."""
    mock_response = {
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False,
            "breed_probabilities": [
                {"breed": "golden_retriever", "probability": 0.89}
            ],
            "crossbreed_analysis": None
        }
    }

    with patch.object(httpx.AsyncClient, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.raise_for_status = lambda: None

        result = await client.detect_breed("data:image/jpeg;base64,test123", "dog", top_k=5)

        assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
        assert result["breed_analysis"]["is_likely_crossbreed"] is False


@pytest.mark.asyncio
async def test_connection_error_handling(client):
    """Test connection error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.ConnectError("Connection failed")):
        with pytest.raises(ConnectionError, match="Classification service unavailable"):
            await client.check_content("data:image/jpeg;base64,test123")


@pytest.mark.asyncio
async def test_timeout_handling(client):
    """Test timeout error handling."""
    with patch.object(httpx.AsyncClient, 'post', side_effect=httpx.TimeoutException("Timeout")):
        with pytest.raises(ConnectionError, match="Classification service timeout"):
            await client.check_content("data:image/jpeg;base64,test123")
```

**Step 3: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_classification_client.py -v
```

Expected: FAIL

**Step 4: Write classification client implementation**

File: `srcs/ai/src/services/classification_client.py`
```python
import httpx
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class ClassificationClient:
    """HTTP client for classification service."""

    def __init__(self, config):
        """Initialize classification client.

        Args:
            config: Settings instance with classification service config
        """
        self.base_url = config.CLASSIFICATION_SERVICE_URL
        self.timeout = config.CLASSIFICATION_TIMEOUT

        logger.info(f"ClassificationClient initialized: {self.base_url}")

    async def check_content(self, image: str) -> Dict[str, Any]:
        """Check image content safety (NSFW detection).

        Args:
            image: Base64-encoded image

        Returns:
            Dict with is_safe, nsfw_probability, threshold

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/content",
                    json={"image": image}
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")

    async def detect_species(self, image: str, top_k: int = 3) -> Dict[str, Any]:
        """Detect animal species from image.

        Args:
            image: Base64-encoded image
            top_k: Number of top predictions

        Returns:
            Dict with species, confidence, top_predictions

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/species",
                    json={"image": image, "top_k": top_k}
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")

    async def detect_breed(
        self,
        image: str,
        species: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Detect breed from image (dog or cat).

        Args:
            image: Base64-encoded image
            species: Species (dog or cat)
            top_k: Number of top predictions

        Returns:
            Dict with breed_analysis

        Raises:
            ConnectionError: If classification service unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/classify/breed",
                    json={
                        "image": image,
                        "species": species,
                        "top_k": top_k
                    }
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError as e:
            logger.error(f"Classification service connection failed: {e}")
            raise ConnectionError("Classification service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Classification service timeout: {e}")
            raise ConnectionError("Classification service timeout")
```

**Step 5: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_classification_client.py -v
```

Expected: All tests PASS

**Step 6: Commit classification client**

```bash
git add srcs/ai/src/services/classification_client.py
git add srcs/ai/tests/unit/test_classification_client.py
git add srcs/ai/src/config.py
git commit -m "feat(ai): add classification service HTTP client

- Implement ClassificationClient for classification service
- Add check_content, detect_species, detect_breed methods
- Handle connection and timeout errors gracefully
- Add config for CLASSIFICATION_SERVICE_URL and timeout
- Add comprehensive unit tests with mocked HTTP calls

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

**Due to message length constraints, I'll write the plan in parts. This completes Phase 1-2 and part of Phase 4. Shall I continue with the remaining tasks (RAG enhancements, Ollama updates, VisionOrchestrator, and integration tests)?**
# Multi-Stage Vision Pipeline Implementation Plan (Part 2)

> Continuation of implementation plan - append this to part 1

---

### Task 11: RAG Service Enhancements

**Files:**
- Modify: `srcs/ai/src/services/rag_service.py`
- Create: `srcs/ai/tests/unit/test_rag_service.py`

**Step 1: Write failing test for breed context retrieval**

File: `srcs/ai/tests/unit/test_rag_service.py`
```python
import pytest
from unittest.mock import Mock, AsyncMock, patch

from src.services.rag_service import RAGService
from src.config import Settings


@pytest.fixture
def mock_embedder():
    """Mock embedder."""
    embedder = Mock()
    embedder.embed_text = Mock(return_value=[0.1] * 384)
    return embedder


@pytest.fixture
def mock_ollama():
    """Mock Ollama client."""
    return Mock()


@pytest.fixture
def rag_service(mock_embedder, mock_ollama):
    """Create RAG service with mocks."""
    settings = Settings()
    with patch('chromadb.PersistentClient'):
        service = RAGService(settings, mock_embedder, mock_ollama)
        return service


@pytest.mark.asyncio
async def test_get_breed_context_purebred(rag_service):
    """Test retrieving context for single breed."""
    # Mock ChromaDB query
    mock_results = {
        "documents": [
            ["Golden Retrievers are large sporting dogs known for friendly temperament."],
            ["They require daily exercise and regular grooming."],
            ["Common health issues include hip dysplasia and cancer."]
        ],
        "metadatas": [
            [{"source": "akc_golden_retriever.md"}],
            [{"source": "care_guide.md"}],
            [{"source": "health_guide.md"}]
        ],
        "distances": [[0.2], [0.3], [0.4]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_breed_context("golden_retriever")

    assert result["breed"] == "Golden Retriever"
    assert result["parent_breeds"] is None
    assert "sporting dogs" in result["description"].lower()
    assert "daily exercise" in result["care_summary"].lower()
    assert "hip dysplasia" in result["health_info"].lower()
    assert len(result["sources"]) > 0


@pytest.mark.asyncio
async def test_get_crossbreed_context(rag_service):
    """Test retrieving context for crossbreed (multiple parent breeds)."""
    # Mock ChromaDB query (called twice, once per breed)
    mock_results = {
        "documents": [
            ["Golden Retrievers are large friendly dogs."],
            ["Poodles are intelligent and hypoallergenic."]
        ],
        "metadatas": [
            [{"source": "golden.md"}],
            [{"source": "poodle.md"}]
        ],
        "distances": [[0.2], [0.3]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_crossbreed_context(["Golden Retriever", "Poodle"])

    assert result["breed"] is None
    assert result["parent_breeds"] == ["Golden Retriever", "Poodle"]
    assert "friendly" in result["description"].lower() or "intelligent" in result["description"].lower()
    assert len(result["sources"]) > 0


@pytest.mark.asyncio
async def test_get_breed_context_normalizes_name(rag_service):
    """Test breed name normalization (snake_case to Title Case)."""
    mock_results = {
        "documents": [["Golden Retriever info"]],
        "metadatas": [[{"source": "test.md"}]],
        "distances": [[0.2]]
    }
    rag_service._collection.query = Mock(return_value=mock_results)

    result = await rag_service.get_breed_context("golden_retriever")

    # Query should use "Golden Retriever" not "golden_retriever"
    call_args = rag_service._collection.query.call_args
    assert "Golden Retriever" in call_args[1]["query_texts"][0]
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_rag_service.py -v
```

Expected: FAIL (methods don't exist yet)

**Step 3: Add new methods to RAG service**

File: `srcs/ai/src/services/rag_service.py` (add after existing methods)
```python
    async def get_breed_context(self, breed: str) -> Dict[str, Any]:
        """Retrieve context for a single breed (purebred).

        Args:
            breed: Normalized breed name (e.g., "golden_retriever")

        Returns:
            Dict with breed description, care, health info, sources
        """
        breed_display = breed.replace("_", " ").title()

        # Query ChromaDB
        query_text = f"{breed_display} breed characteristics health care requirements"
        query_embedding = self.embedder.embed_text(query_text)

        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=5
        )

        # Extract sources
        sources = []
        if results["metadatas"] and len(results["metadatas"]) > 0:
            for metadata_list in results["metadatas"]:
                for metadata in metadata_list:
                    sources.append(metadata.get("source", "unknown"))

        # Extract documents
        documents = []
        if results["documents"] and len(results["documents"]) > 0:
            for doc_list in results["documents"]:
                documents.extend(doc_list)

        # Synthesize context from retrieved documents
        description = " ".join(documents[:2]) if len(documents) >= 2 else (documents[0] if documents else "No information available")
        care_summary = documents[2] if len(documents) > 2 else "Standard care recommended"
        health_info = documents[3] if len(documents) > 3 else "Consult veterinarian for health information"

        return {
            "breed": breed_display,
            "parent_breeds": None,
            "description": description[:500],  # Limit length
            "care_summary": care_summary[:300],
            "health_info": health_info[:300],
            "sources": list(set(sources))  # Deduplicate
        }

    async def get_crossbreed_context(self, parent_breeds: List[str]) -> Dict[str, Any]:
        """Retrieve context for crossbreed parent breeds.

        Args:
            parent_breeds: List like ["Golden Retriever", "Poodle"]

        Returns:
            Dict with combined breed context
        """
        all_documents = []
        all_sources = []

        # Query for each parent breed
        for breed in parent_breeds:
            query_text = f"{breed} breed characteristics health care requirements"
            query_embedding = self.embedder.embed_text(query_text)

            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=3
            )

            # Collect documents
            if results["documents"] and len(results["documents"]) > 0:
                for doc_list in results["documents"]:
                    all_documents.extend(doc_list)

            # Collect sources
            if results["metadatas"] and len(results["metadatas"]) > 0:
                for metadata_list in results["metadatas"]:
                    for metadata in metadata_list:
                        all_sources.append(metadata.get("source", "unknown"))

        # Combine contexts
        description = " ".join(all_documents[:3]) if len(all_documents) >= 3 else " ".join(all_documents)
        care_summary = " ".join(all_documents[3:5]) if len(all_documents) > 3 else "Standard care recommended"
        health_info = " ".join(all_documents[5:7]) if len(all_documents) > 5 else "Consult veterinarian for health information"

        return {
            "breed": None,
            "parent_breeds": parent_breeds,
            "description": description[:500],
            "care_summary": care_summary[:300],
            "health_info": health_info[:300],
            "sources": list(set(all_sources))
        }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/crea/Desktop/ft_transcendence/srcs/ai
python -m pytest tests/unit/test_rag_service.py -v
```

Expected: All tests PASS

**Step 5: Commit RAG enhancements**

```bash
git add srcs/ai/src/services/rag_service.py
git add srcs/ai/tests/unit/test_rag_service.py
git commit -m "feat(ai): add breed context retrieval to RAG service

- Add get_breed_context() for purebred queries
- Add get_crossbreed_context() for multi-breed queries
- Query ChromaDB with breed-specific prompts
- Synthesize description, care, and health info from chunks
- Add tests for purebred and crossbreed context retrieval

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```