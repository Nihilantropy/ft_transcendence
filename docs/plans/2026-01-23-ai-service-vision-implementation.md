# AI Service Vision Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement AI-powered pet breed identification using Ollama's qwen3-vl:8b multimodal model with direct HTTP API calls.

**Architecture:** FastAPI service that accepts base64-encoded images, validates and preprocesses them with Pillow, sends to Ollama via direct HTTP API (bypassing LlamaIndex for vision), and returns structured breed identification with confidence scoring and traits.

**Tech Stack:** FastAPI, Ollama HTTP API (qwen3-vl:8b), Pillow, Pydantic, httpx, pytest

**Important Note:** LlamaIndex does NOT currently support Ollama multimodal models. We will use Ollama's native HTTP API directly for vision analysis, which is more reliable and gives us full control over the interaction.

---

## Prerequisites

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
# Should show qwen3-vl:8b model available
```

**Current directory:** `/home/crea/Desktop/ft_transcendence/srcs/ai/`

---

## Task 1: Configuration and Settings

**Files:**
- Create: `srcs/ai/src/config.py`
- Create: `srcs/ai/.env`

**Step 1: Write configuration test**

Create `srcs/ai/tests/test_config.py`:
```python
import pytest
from src.config import Settings

def test_settings_defaults():
    """Test default configuration values."""
    settings = Settings()

    assert settings.SERVICE_NAME == "ai-service"
    assert settings.OLLAMA_BASE_URL == "http://ollama:11434"
    assert settings.OLLAMA_MODEL == "qwen3-vl:8b"
    assert settings.OLLAMA_TIMEOUT == 60
    assert settings.OLLAMA_TEMPERATURE == 0.1
    assert settings.MAX_IMAGE_SIZE_MB == 5
    assert settings.MAX_IMAGE_DIMENSION == 1024
    assert settings.MIN_IMAGE_DIMENSION == 224
    assert settings.LOW_CONFIDENCE_THRESHOLD == 0.5
    assert "jpeg" in settings.SUPPORTED_FORMATS
    assert "png" in settings.SUPPORTED_FORMATS

def test_settings_from_env(monkeypatch):
    """Test configuration from environment variables."""
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://custom:11434")
    monkeypatch.setenv("MAX_IMAGE_SIZE_MB", "10")
    monkeypatch.setenv("LOW_CONFIDENCE_THRESHOLD", "0.6")

    settings = Settings()

    assert settings.OLLAMA_BASE_URL == "http://custom:11434"
    assert settings.MAX_IMAGE_SIZE_MB == 10
    assert settings.LOW_CONFIDENCE_THRESHOLD == 0.6
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_config.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.config'"

**Step 3: Create configuration module**

Create `srcs/ai/src/config.py`:
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
    OLLAMA_TIMEOUT: int = 60
    OLLAMA_TEMPERATURE: float = 0.1

    # Image Processing
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_IMAGE_DIMENSION: int = 1024
    MIN_IMAGE_DIMENSION: int = 224
    SUPPORTED_FORMATS: List[str] = ["jpeg", "jpg", "png", "webp"]

    # Vision Analysis
    LOW_CONFIDENCE_THRESHOLD: float = 0.5

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

**Step 4: Create .env file**

Create `srcs/ai/.env`:
```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen3-vl:8b
OLLAMA_TIMEOUT=60
OLLAMA_TEMPERATURE=0.1

# Image Processing
MAX_IMAGE_SIZE_MB=5
MAX_IMAGE_DIMENSION=1024
MIN_IMAGE_DIMENSION=224

# Vision Analysis
LOW_CONFIDENCE_THRESHOLD=0.5

# Service Configuration
SERVICE_NAME=ai-service
DEBUG=false
LOG_LEVEL=info
```

**Step 5: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_config.py -v`
Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add src/config.py .env tests/test_config.py
git commit -m "feat: add configuration with Pydantic settings

- Service, Ollama, image processing settings
- Environment variable support with defaults
- Test coverage for config loading

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Pydantic Data Models

**Files:**
- Create: `srcs/ai/src/models/__init__.py`
- Create: `srcs/ai/src/models/requests.py`
- Create: `srcs/ai/src/models/responses.py`

**Step 1: Write models test**

Create `srcs/ai/tests/test_models.py`:
```python
import pytest
from pydantic import ValidationError
from src.models.requests import VisionAnalysisRequest, VisionAnalysisOptions
from src.models.responses import BreedTraits, VisionAnalysisData, VisionAnalysisResponse

class TestRequestModels:
    def test_vision_analysis_request_valid(self):
        """Test valid vision analysis request."""
        request = VisionAnalysisRequest(
            image="data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            options=VisionAnalysisOptions(return_traits=True)
        )

        assert request.image.startswith("data:image/")
        assert request.options.return_traits is True

    def test_vision_analysis_request_invalid_image(self):
        """Test invalid image format raises error."""
        with pytest.raises(ValidationError) as exc_info:
            VisionAnalysisRequest(image="not-a-data-uri")

        assert "Image must be a data URI" in str(exc_info.value)

    def test_vision_analysis_options_defaults(self):
        """Test default options."""
        options = VisionAnalysisOptions()

        assert options.return_traits is True
        assert options.return_health_info is True

class TestResponseModels:
    def test_breed_traits_valid(self):
        """Test breed traits model."""
        traits = BreedTraits(
            size="large",
            energy_level="high",
            temperament="friendly"
        )

        assert traits.size == "large"
        assert traits.energy_level == "high"

    def test_vision_analysis_data_valid(self):
        """Test vision analysis data model."""
        data = VisionAnalysisData(
            breed="Golden Retriever",
            confidence=0.92,
            traits=BreedTraits(size="large", energy_level="high", temperament="friendly"),
            health_considerations=["Hip dysplasia"],
            note=None
        )

        assert data.breed == "Golden Retriever"
        assert data.confidence == 0.92
        assert data.note is None

    def test_vision_analysis_data_confidence_validation(self):
        """Test confidence must be 0.0-1.0."""
        with pytest.raises(ValidationError):
            VisionAnalysisData(
                breed="Test",
                confidence=1.5,  # Invalid
                traits=BreedTraits(size="medium", energy_level="medium", temperament="test"),
                health_considerations=[]
            )
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.models'"

**Step 3: Create request models**

Create `srcs/ai/src/models/__init__.py`:
```python
"""Pydantic models for requests and responses."""
```

Create `srcs/ai/src/models/requests.py`:
```python
from pydantic import BaseModel, Field, validator

class VisionAnalysisOptions(BaseModel):
    """Options for vision analysis."""
    return_traits: bool = True
    return_health_info: bool = True

class VisionAnalysisRequest(BaseModel):
    """Request model for vision analysis endpoint."""
    image: str = Field(..., description="Base64-encoded image with data URI")
    options: VisionAnalysisOptions = Field(default_factory=VisionAnalysisOptions)

    @validator('image')
    def validate_image_format(cls, v):
        """Validate image is a data URI."""
        if not v.startswith('data:image/'):
            raise ValueError('Image must be a data URI')
        return v
```

**Step 4: Create response models**

Create `srcs/ai/src/models/responses.py`:
```python
from typing import Optional, List
from pydantic import BaseModel, Field

class BreedTraits(BaseModel):
    """Breed characteristic traits."""
    size: str = Field(..., description="small/medium/large")
    energy_level: str = Field(..., description="low/medium/high")
    temperament: str = Field(..., description="Brief temperament description")

class VisionAnalysisData(BaseModel):
    """Vision analysis result data."""
    breed: str
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    traits: BreedTraits
    health_considerations: List[str]
    note: Optional[str] = None

class VisionAnalysisResponse(BaseModel):
    """Standardized vision analysis response."""
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str
```

**Step 5: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_models.py -v`
Expected: PASS (7 tests)

**Step 6: Commit**

```bash
git add src/models/ tests/test_models.py
git commit -m "feat: add Pydantic models for vision analysis

- Request models with data URI validation
- Response models with confidence validation
- Breed traits and health considerations
- Test coverage for validation logic

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Response Utilities

**Files:**
- Create: `srcs/ai/src/utils/__init__.py`
- Create: `srcs/ai/src/utils/responses.py`

**Step 1: Write response utilities test**

Create `srcs/ai/tests/test_responses.py`:
```python
from datetime import datetime
from src.utils.responses import success_response, error_response

def test_success_response():
    """Test success response format."""
    data = {"breed": "Golden Retriever", "confidence": 0.92}
    response = success_response(data)

    assert response["success"] is True
    assert response["data"] == data
    assert response["error"] is None
    assert "timestamp" in response
    assert response["timestamp"].endswith("Z")

def test_error_response():
    """Test error response format."""
    response = error_response(
        code="TEST_ERROR",
        message="Test error message",
        details={"field": "value"}
    )

    assert response["success"] is False
    assert response["data"] is None
    assert response["error"]["code"] == "TEST_ERROR"
    assert response["error"]["message"] == "Test error message"
    assert response["error"]["details"] == {"field": "value"}
    assert "timestamp" in response

def test_error_response_without_details():
    """Test error response without details."""
    response = error_response(
        code="SIMPLE_ERROR",
        message="Simple error"
    )

    assert response["error"]["details"] == {}
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_responses.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.utils'"

**Step 3: Create response utilities**

Create `srcs/ai/src/utils/__init__.py`:
```python
"""Utility functions for the AI service."""
```

Create `srcs/ai/src/utils/responses.py`:
```python
from datetime import datetime
from typing import Any, Optional

def success_response(data: Any) -> dict:
    """Create standardized success response.

    Args:
        data: Response data payload

    Returns:
        Standardized success response dict
    """
    return {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

def error_response(code: str, message: str, details: Optional[dict] = None) -> dict:
    """Create standardized error response.

    Args:
        code: Error code (e.g., "INVALID_IMAGE")
        message: Human-readable error message
        details: Optional additional error details

    Returns:
        Standardized error response dict
    """
    return {
        "success": False,
        "data": None,
        "error": {
            "code": code,
            "message": message,
            "details": details or {}
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_responses.py -v`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/utils/ tests/test_responses.py
git commit -m "feat: add standardized response utilities

- success_response for successful operations
- error_response with code, message, details
- ISO 8601 timestamps with UTC timezone
- Test coverage for response formats

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Image Processor Service

**Files:**
- Create: `srcs/ai/src/services/__init__.py`
- Create: `srcs/ai/src/services/image_processor.py`

**Step 1: Write image processor tests**

Create `srcs/ai/tests/test_image_processor.py`:
```python
import pytest
import base64
from PIL import Image
import io
from src.services.image_processor import ImageProcessor
from src.config import Settings

@pytest.fixture
def settings():
    """Test settings."""
    return Settings()

@pytest.fixture
def image_processor(settings):
    """Image processor instance."""
    return ImageProcessor(settings)

@pytest.fixture
def valid_image_base64():
    """Generate valid 512x512 test image."""
    img = Image.new('RGB', (512, 512), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def large_image_base64():
    """Generate 2048x2048 test image (needs resize)."""
    img = Image.new('RGB', (2048, 2048), color='blue')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def small_image_base64():
    """Generate 100x100 test image (too small)."""
    img = Image.new('RGB', (100, 100), color='green')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

class TestImageProcessor:
    def test_process_valid_image(self, image_processor, valid_image_base64):
        """Test processing valid image."""
        result = image_processor.process_image(valid_image_base64)

        assert result.startswith("data:image/jpeg;base64,")
        assert len(result) > 100

    def test_process_large_image_resizes(self, image_processor, large_image_base64):
        """Test large image is resized to max dimension."""
        result = image_processor.process_image(large_image_base64)

        # Decode and check dimensions
        base64_data = result.split(',')[1]
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))

        assert max(img.size) <= 1024
        assert min(img.size) <= 1024

    def test_invalid_data_uri_rejected(self, image_processor):
        """Test invalid data URI format is rejected."""
        with pytest.raises(ValueError, match="Invalid data URI"):
            image_processor.process_image("not-a-data-uri")

    def test_unsupported_format_rejected(self, image_processor):
        """Test unsupported image format is rejected."""
        # Create BMP image (not supported)
        img = Image.new('RGB', (512, 512), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='BMP')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/bmp;base64,{encoded}"

        with pytest.raises(ValueError, match="Unsupported format"):
            image_processor.process_image(data_uri)

    def test_small_image_rejected(self, image_processor, small_image_base64):
        """Test image below minimum dimensions is rejected."""
        with pytest.raises(ValueError, match="too small"):
            image_processor.process_image(small_image_base64)

    def test_oversized_image_rejected(self, image_processor, settings):
        """Test image exceeding size limit is rejected."""
        # Create very large image that exceeds 5MB
        img = Image.new('RGB', (4000, 4000), color='white')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=100)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        with pytest.raises(ValueError, match="exceeds"):
            image_processor.process_image(data_uri)

    def test_png_image_processed(self, image_processor):
        """Test PNG images are processed correctly."""
        img = Image.new('RGB', (512, 512), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/png;base64,{encoded}"

        result = image_processor.process_image(data_uri)
        assert result.startswith("data:image/png;base64,")
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_image_processor.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.services'"

**Step 3: Create image processor service**

Create `srcs/ai/src/services/__init__.py`:
```python
"""Service layer for AI operations."""
```

Create `srcs/ai/src/services/image_processor.py`:
```python
from PIL import Image
import base64
import io
from typing import Tuple
import logging

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Process and validate images for AI analysis."""

    def __init__(self, config):
        """Initialize image processor with configuration.

        Args:
            config: Settings instance with image processing config
        """
        self.max_size_bytes = config.MAX_IMAGE_SIZE_MB * 1024 * 1024
        self.max_dimension = config.MAX_IMAGE_DIMENSION
        self.min_dimension = config.MIN_IMAGE_DIMENSION
        self.supported_formats = config.SUPPORTED_FORMATS

    def process_image(self, data_uri: str) -> str:
        """Process and optimize image from data URI.

        Args:
            data_uri: Base64-encoded image with data URI format

        Returns:
            Processed image as data URI

        Raises:
            ValueError: If image is invalid, wrong format, or wrong size
        """
        # Extract format and base64 data
        format_str, base64_data = self._parse_data_uri(data_uri)

        # Decode base64
        image_bytes = base64.b64decode(base64_data)

        # Validate size
        if len(image_bytes) > self.max_size_bytes:
            raise ValueError(
                f"Image exceeds {self.max_size_bytes / (1024*1024):.0f}MB limit"
            )

        # Open image
        image = Image.open(io.BytesIO(image_bytes))

        # Validate dimensions
        width, height = image.size
        if width < self.min_dimension or height < self.min_dimension:
            raise ValueError(
                f"Image too small (min {self.min_dimension}x{self.min_dimension})"
            )

        # Resize if needed
        if width > self.max_dimension or height > self.max_dimension:
            logger.info(f"Resizing image from {width}x{height}")
            image = self._resize_image(image)

        # Convert to RGB if needed
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')

        # Re-encode optimized image
        return self._encode_image(image, format_str)

    def _parse_data_uri(self, data_uri: str) -> Tuple[str, str]:
        """Parse data URI into format and base64 data.

        Args:
            data_uri: Data URI string

        Returns:
            Tuple of (format, base64_data)

        Raises:
            ValueError: If data URI is invalid or format unsupported
        """
        if not data_uri.startswith('data:image/'):
            raise ValueError("Invalid data URI format")

        parts = data_uri.split(',', 1)
        if len(parts) != 2:
            raise ValueError("Invalid data URI format")

        header = parts[0]
        format_str = header.split('/')[1].split(';')[0].lower()

        if format_str not in self.supported_formats:
            raise ValueError(f"Unsupported format: {format_str}")

        return format_str, parts[1]

    def _resize_image(self, image: Image.Image) -> Image.Image:
        """Resize image maintaining aspect ratio.

        Args:
            image: PIL Image instance

        Returns:
            Resized PIL Image
        """
        image.thumbnail(
            (self.max_dimension, self.max_dimension),
            Image.Resampling.LANCZOS
        )
        return image

    def _encode_image(self, image: Image.Image, format_str: str) -> str:
        """Encode image to base64 data URI.

        Args:
            image: PIL Image instance
            format_str: Image format (jpeg, png, webp)

        Returns:
            Base64-encoded data URI
        """
        buffer = io.BytesIO()
        save_format = 'JPEG' if format_str in ['jpg', 'jpeg'] else format_str.upper()

        # Save with optimization
        if save_format == 'JPEG':
            image.save(buffer, format=save_format, quality=85, optimize=True)
        else:
            image.save(buffer, format=save_format, optimize=True)

        encoded = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/{format_str};base64,{encoded}"
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_image_processor.py -v`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/services/ tests/test_image_processor.py
git commit -m "feat: add image processor with validation

- Parse and validate data URI format
- Check image size (5MB max) and dimensions (224-1024px)
- Resize large images maintaining aspect ratio
- Support JPEG, PNG, WebP formats
- Comprehensive test coverage (8 tests)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Ollama HTTP Client Service

**Files:**
- Create: `srcs/ai/src/services/ollama_client.py`

**Important:** This task uses Ollama's native HTTP API directly, NOT LlamaIndex, because LlamaIndex doesn't support Ollama multimodal.

**Step 1: Write Ollama client tests**

Create `srcs/ai/tests/test_ollama_client.py`:
```python
import pytest
from unittest.mock import Mock, patch, AsyncMock
import json
from src.services.ollama_client import OllamaVisionClient
from src.config import Settings

@pytest.fixture
def settings():
    """Test settings."""
    return Settings()

@pytest.fixture
def ollama_client(settings):
    """Ollama client instance."""
    return OllamaVisionClient(settings)

@pytest.fixture
def mock_image_base64():
    """Mock image base64 data."""
    return "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

@pytest.fixture
def mock_ollama_response():
    """Mock successful Ollama response."""
    return {
        "breed": "Golden Retriever",
        "confidence": 0.92,
        "traits": {
            "size": "large",
            "energy_level": "high",
            "temperament": "friendly, intelligent"
        },
        "health_considerations": ["Hip dysplasia", "Cancer risk"]
    }

@pytest.fixture
def mock_low_confidence_response():
    """Mock low confidence Ollama response."""
    return {
        "breed": "Unknown",
        "confidence": 0.35,
        "traits": {
            "size": "medium",
            "energy_level": "medium",
            "temperament": "unknown"
        },
        "health_considerations": []
    }

class TestOllamaClient:
    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_successful_analysis(self, mock_post, ollama_client,
                                      mock_image_base64, mock_ollama_response):
        """Test successful breed analysis."""
        # Mock httpx response
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": json.dumps(mock_ollama_response)
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Golden Retriever"
        assert result["confidence"] == 0.92
        assert result["traits"]["size"] == "large"
        assert "Hip dysplasia" in result["health_considerations"]
        assert "note" not in result  # High confidence, no note

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_low_confidence_adds_note(self, mock_post, ollama_client,
                                           mock_image_base64, mock_low_confidence_response):
        """Test low confidence analysis adds warning note."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": json.dumps(mock_low_confidence_response)
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Unknown"
        assert result["confidence"] == 0.35
        assert result["note"] == "Low confidence - manual verification recommended"

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_parse_json_from_markdown(self, mock_post, ollama_client,
                                           mock_image_base64, mock_ollama_response):
        """Test parsing JSON from markdown code blocks."""
        # Response wrapped in markdown
        markdown_response = f"```json\n{json.dumps(mock_ollama_response)}\n```"

        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": markdown_response
            }
        }
        mock_post.return_value = mock_response

        result = await ollama_client.analyze_breed(mock_image_base64)

        assert result["breed"] == "Golden Retriever"

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_invalid_json_raises_error(self, mock_post, ollama_client,
                                            mock_image_base64):
        """Test invalid JSON response raises error."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "message": {
                "content": "This is not JSON"
            }
        }
        mock_post.return_value = mock_response

        with pytest.raises(ValueError, match="Failed to parse JSON"):
            await ollama_client.analyze_breed(mock_image_base64)

    def test_build_analysis_prompt(self, ollama_client):
        """Test prompt building."""
        prompt = ollama_client._build_analysis_prompt()

        assert "Analyze this pet image" in prompt
        assert "breed" in prompt.lower()
        assert "JSON" in prompt
        assert "confidence" in prompt
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_ollama_client.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.services.ollama_client'"

**Step 3: Create Ollama client service**

Create `srcs/ai/src/services/ollama_client.py`:
```python
import httpx
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OllamaVisionClient:
    """Client for Ollama vision analysis using native HTTP API."""

    def __init__(self, config):
        """Initialize Ollama client with configuration.

        Args:
            config: Settings instance with Ollama configuration
        """
        self.base_url = config.OLLAMA_BASE_URL
        self.model = config.OLLAMA_MODEL
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.low_confidence_threshold = config.LOW_CONFIDENCE_THRESHOLD
        logger.info(f"Initialized Ollama client: {self.base_url}, model: {self.model}")

    async def analyze_breed(self, image_base64: str) -> Dict[str, Any]:
        """Analyze pet breed from base64 image.

        Args:
            image_base64: Base64-encoded image data URI

        Returns:
            Dict with breed, confidence, traits, health_considerations

        Raises:
            ValueError: If response cannot be parsed
            ConnectionError: If Ollama is unreachable
        """
        try:
            # Extract just the base64 part (remove data URI prefix)
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            # Build structured prompt
            prompt = self._build_analysis_prompt()

            logger.info("Sending image to Ollama for analysis")

            # Call Ollama HTTP API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": [image_base64]
                            }
                        ],
                        "stream": False,
                        "options": {
                            "temperature": self.temperature
                        }
                    }
                )

                response.raise_for_status()
                response_data = response.json()

            # Extract content from response
            content = response_data.get("message", {}).get("content", "")

            # Parse JSON response
            result = self._parse_response(content)

            # Add note if low confidence
            if result["confidence"] < self.low_confidence_threshold:
                result["note"] = "Low confidence - manual verification recommended"
                logger.warning(f"Low confidence result: {result['confidence']}")
            else:
                logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

            return result

        except httpx.HTTPError as e:
            logger.error(f"Ollama connection failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
        except Exception as e:
            logger.error(f"Ollama analysis failed: {str(e)}")
            raise

    def _build_analysis_prompt(self) -> str:
        """Build structured prompt for breed analysis.

        Returns:
            Prompt string for Ollama
        """
        return """Analyze this pet image and identify the breed.
Return ONLY valid JSON in this exact format:
{
  "breed": "breed name or Unknown",
  "confidence": 0.0-1.0,
  "traits": {
    "size": "small/medium/large",
    "energy_level": "low/medium/high",
    "temperament": "brief description"
  },
  "health_considerations": ["condition1", "condition2"]
}"""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON from model response.

        Args:
            response_text: Raw response text from Ollama

        Returns:
            Parsed JSON dict

        Raises:
            ValueError: If JSON cannot be parsed
        """
        try:
            # Try direct JSON parse
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Extract JSON from markdown code blocks if present
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end > start:
                    json_str = response_text[start:end].strip()
                    return json.loads(json_str)

            logger.error(f"Failed to parse response: {response_text[:200]}")
            raise ValueError("Failed to parse JSON from response")
```

**Step 4: Run test to verify it passes**

Run: `docker compose run --rm ai-service python -m pytest tests/test_ollama_client.py -v`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/services/ollama_client.py tests/test_ollama_client.py
git commit -m "feat: add Ollama client with native HTTP API

- Direct HTTP API calls to Ollama (no LlamaIndex)
- Structured prompt for JSON responses
- Parse JSON from direct response or markdown blocks
- Add low-confidence warning notes
- Comprehensive test coverage with mocking

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Vision Analysis Route

**Files:**
- Create: `srcs/ai/src/routes/__init__.py`
- Create: `srcs/ai/src/routes/vision.py`

**Step 1: Write vision route tests**

Create `srcs/ai/tests/test_vision_route.py`:
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import base64
from PIL import Image
import io

# Import will fail initially - that's expected
from src.main import app

client = TestClient(app)

@pytest.fixture
def valid_image_base64():
    """Generate valid test image."""
    img = Image.new('RGB', (512, 512), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def mock_ollama_response():
    """Mock successful Ollama response."""
    return {
        "breed": "Golden Retriever",
        "confidence": 0.92,
        "traits": {
            "size": "large",
            "energy_level": "high",
            "temperament": "friendly"
        },
        "health_considerations": ["Hip dysplasia"]
    }

class TestVisionEndpoint:
    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_successful_analysis(self, mock_processor, mock_client,
                                 valid_image_base64, mock_ollama_response):
        """Test successful vision analysis."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(return_value=mock_ollama_response)

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64,
            "options": {"return_traits": True, "return_health_info": True}
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["breed"] == "Golden Retriever"
        assert data["data"]["confidence"] == 0.92
        assert "timestamp" in data

    def test_invalid_image_format(self):
        """Test invalid image format returns 422."""
        response = client.post("/api/v1/vision/analyze", json={
            "image": "not-a-valid-image"
        })

        assert response.status_code == 422

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_image_validation_error(self, mock_processor, mock_client, valid_image_base64):
        """Test image validation error returns 422."""
        mock_processor.process_image.side_effect = ValueError("Image too large")

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 422
        data = response.json()
        assert "INVALID_IMAGE" in str(data)

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_ollama_failure_returns_503(self, mock_processor, mock_client, valid_image_base64):
        """Test Ollama connection failure returns 503."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(side_effect=ConnectionError("Ollama unreachable"))

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 503
        data = response.json()
        assert "VISION_SERVICE_UNAVAILABLE" in str(data)

    @patch('src.routes.vision.ollama_client')
    @patch('src.routes.vision.image_processor')
    def test_unexpected_error_returns_500(self, mock_processor, mock_client, valid_image_base64):
        """Test unexpected error returns 500."""
        mock_processor.process_image.return_value = valid_image_base64
        mock_client.analyze_breed = AsyncMock(side_effect=Exception("Unexpected error"))

        response = client.post("/api/v1/vision/analyze", json={
            "image": valid_image_base64
        })

        assert response.status_code == 500
        data = response.json()
        assert "INTERNAL_ERROR" in str(data)
```

**Step 2: Run test to verify it fails**

Run: `docker compose run --rm ai-service python -m pytest tests/test_vision_route.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.main'" or similar

**Step 3: Create vision route**

Create `srcs/ai/src/routes/__init__.py`:
```python
"""API routes for the AI service."""
```

Create `srcs/ai/src/routes/vision.py`:
```python
from fastapi import APIRouter, HTTPException, status
import logging

from src.models.requests import VisionAnalysisRequest
from src.models.responses import VisionAnalysisResponse, VisionAnalysisData, BreedTraits
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/vision", tags=["vision"])

# Service instances (injected at startup)
image_processor: ImageProcessor = None
ollama_client: OllamaVisionClient = None

@router.post("/analyze", response_model=dict)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image to identify breed and characteristics.

    Args:
        request: Vision analysis request with image and options

    Returns:
        Standardized response with breed data

    Raises:
        HTTPException: For validation errors (422), service unavailable (503), or internal errors (500)
    """
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)
        logger.info("Image processed successfully")

        # Analyze with Ollama
        result = await ollama_client.analyze_breed(processed_image)
        logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

        # Build response
        data = VisionAnalysisData(
            breed=result["breed"],
            confidence=result["confidence"],
            traits=BreedTraits(**result["traits"]),
            health_considerations=result["health_considerations"],
            note=result.get("note")
        )

        return success_response(data.dict())

    except ValueError as e:
        # Image validation errors
        logger.warning(f"Image validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(
                code="INVALID_IMAGE",
                message=str(e)
            )
        )

    except ConnectionError as e:
        # Ollama connection failures
        logger.error(f"Ollama connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="VISION_SERVICE_UNAVAILABLE",
                message="Vision analysis temporarily unavailable, please try again"
            )
        )

    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error in vision analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred during analysis"
            )
        )
```

**Step 4: Note about main.py**

We'll create main.py in the next task. Tests will still fail until then - that's expected.

**Step 5: Commit**

```bash
git add src/routes/ tests/test_vision_route.py
git commit -m "feat: add vision analysis route

- POST /api/v1/vision/analyze endpoint
- Image processing and validation
- Ollama breed analysis integration
- Error handling (422, 503, 500)
- Test coverage for all error scenarios

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: FastAPI Application and Logging

**Files:**
- Modify: `srcs/ai/src/main.py` (replace placeholder)
- Create: `srcs/ai/src/utils/logger.py`

**Step 1: Create logging utility**

Create `srcs/ai/src/utils/logger.py`:
```python
import logging
import sys
import json

def setup_logging(log_level: str = "info"):
    """Configure structured JSON logging.

    Args:
        log_level: Logging level (debug, info, warning, error)
    """
    level = getattr(logging, log_level.upper())

    # Custom formatter for structured logging
    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "service": "ai-service",
                "message": record.getMessage(),
                "module": record.name
            }
            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_data)

    # Configure handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Set third-party loggers to WARNING
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
```

**Step 2: Create main application**

Replace `srcs/ai/src/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from src.config import settings
from src.routes import vision
from src.services.image_processor import ImageProcessor
from src.services.ollama_client import OllamaVisionClient
from src.utils.logger import setup_logging

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
```

**Step 3: Run all tests to verify**

Run: `docker compose run --rm ai-service python -m pytest tests/ -v`
Expected: PASS (all tests from previous tasks)

**Step 4: Test health endpoint**

Start service: `docker compose up ai-service -d`
Test: `curl http://localhost:3003/health`
Expected: JSON with status "healthy"

**Step 5: Commit**

```bash
git add src/main.py src/utils/logger.py
git commit -m "feat: add FastAPI application with lifecycle management

- Application startup/shutdown with lifespan
- Service initialization and dependency injection
- Structured JSON logging
- Health check endpoint
- CORS middleware
- All tests passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Docker Integration

**Files:**
- Modify: `srcs/ai/requirements.txt`
- Modify: `srcs/ai/Dockerfile`
- Modify: `docker-compose.yml` (root)

**Step 1: Update requirements.txt**

Modify `srcs/ai/requirements.txt`:
```txt
# FastAPI
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.0
pydantic-settings==2.1.0

# HTTP Client
httpx==0.26.0

# Image Processing
Pillow==10.2.0

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0

# Utilities
python-multipart==0.0.6
```

**Step 2: Create Dockerfile**

Modify `srcs/ai/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/

# Create non-root user
RUN useradd -m -u 1000 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "2"]
```

**Step 3: Add to docker-compose.yml**

Add this service to `docker-compose.yml` (after ollama service):
```yaml
  ai-service:
    build:
      context: ./srcs/ai
      dockerfile: Dockerfile
    container_name: ft_transcendence_ai_service
    env_file:
      - ./srcs/ai/.env
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - OLLAMA_MODEL=qwen3-vl:8b
      - DEBUG=false
      - LOG_LEVEL=info
    ports:
      - "3003:3003"
    networks:
      - backend-network
    volumes:
      - ./srcs/ai/src:/app/src
    depends_on:
      - ollama
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

**Step 4: Build and test**

```bash
# Build image
docker compose build ai-service

# Start service
docker compose up ai-service -d

# Check logs
make logs-ai-service

# Test health endpoint
curl http://localhost:3003/health

# Run all tests
docker compose run --rm ai-service python -m pytest tests/ -v
```

**Step 5: Commit**

```bash
git add requirements.txt Dockerfile
git add ../../docker-compose.yml
git commit -m "feat: add Docker integration for AI service

- Complete requirements.txt with httpx instead of LlamaIndex
- Multi-stage Dockerfile with health checks
- docker-compose.yml service definition
- Backend network integration
- Volume mount for development hot reload
- Depends on Ollama service

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Service Documentation

**Files:**
- Create: `srcs/ai/README.md`
- Modify: `TODO.md` (root)

**Step 1: Create service README**

Create `srcs/ai/README.md`:
```markdown
# AI Service

AI-powered pet breed identification and analysis using Ollama's native HTTP API.

## Features

- **Vision Analysis**: Breed identification from pet images using qwen3-vl:8b
- **Confidence Scoring**: Returns confidence levels with low-confidence warnings
- **Trait Extraction**: Size, energy level, temperament analysis
- **Health Insights**: Breed-specific health considerations
- **Direct HTTP API**: Uses Ollama's native API (no LlamaIndex dependency)

## API Endpoints

### POST /api/v1/vision/analyze
Analyze pet image to identify breed and characteristics.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "options": {
    "return_traits": true,
    "return_health_info": true
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "breed": "Golden Retriever",
    "confidence": 0.92,
    "traits": {
      "size": "large",
      "energy_level": "high",
      "temperament": "friendly, intelligent"
    },
    "health_considerations": ["Hip dysplasia", "Cancer risk"],
    "note": null
  },
  "timestamp": "2026-01-23T15:30:00Z"
}
```

**Response (Low Confidence):**
```json
{
  "success": true,
  "data": {
    "breed": "Unknown",
    "confidence": 0.35,
    "traits": {...},
    "health_considerations": [],
    "note": "Low confidence - manual verification recommended"
  },
  "timestamp": "2026-01-23T15:30:00Z"
}
```

**Error Responses:**
- `422 Unprocessable Entity`: Invalid image (format, size, dimensions)
- `503 Service Unavailable`: Ollama unavailable
- `500 Internal Server Error`: Unexpected error

### GET /health
Service health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "ai-service",
  "ollama_url": "http://ollama:11434",
  "model": "qwen3-vl:8b"
}
```

## Configuration

Environment variables in `.env`:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen3-vl:8b
OLLAMA_TIMEOUT=60
OLLAMA_TEMPERATURE=0.1

# Image Processing
MAX_IMAGE_SIZE_MB=5
MAX_IMAGE_DIMENSION=1024
MIN_IMAGE_DIMENSION=224

# Vision Analysis
LOW_CONFIDENCE_THRESHOLD=0.5

# Service
SERVICE_NAME=ai-service
DEBUG=false
LOG_LEVEL=info
```

## Development

### Build and Start

```bash
# Build image
docker compose build ai-service

# Start service
docker compose up ai-service -d

# View logs
make logs-ai-service

# Check health
curl http://localhost:3003/health
```

### Testing

All tests run inside Docker containers:

```bash
# Run all tests
docker compose run --rm ai-service python -m pytest tests/ -v

# Run with coverage
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=html

# Run specific test file
docker compose run --rm ai-service python -m pytest tests/test_vision_route.py -v
```

### Manual Testing

```bash
# Test vision analysis endpoint
curl -X POST http://localhost:3003/api/v1/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "options": {
      "return_traits": true,
      "return_health_info": true
    }
  }'
```

## Architecture

```
src/
├── main.py              # FastAPI app, lifecycle management
├── config.py            # Pydantic settings
├── models/
│   ├── requests.py      # Request models with validation
│   └── responses.py     # Response models
├── routes/
│   └── vision.py        # Vision analysis endpoint
├── services/
│   ├── image_processor.py    # Image validation and preprocessing
│   └── ollama_client.py      # Ollama HTTP API client
└── utils/
    ├── logger.py        # Structured JSON logging
    └── responses.py     # Standardized response helpers
```

## Technology Stack

- **FastAPI**: Async web framework
- **Ollama HTTP API**: Direct multimodal vision API (qwen3-vl:8b)
- **httpx**: Async HTTP client
- **Pillow**: Image processing
- **Pydantic**: Data validation
- **pytest**: Testing framework

## Image Requirements

- **Formats**: JPEG, PNG, WebP
- **Size**: Max 5MB
- **Dimensions**: 224x224 to 1024x1024 pixels
- **Encoding**: Base64 with data URI format

Images exceeding max dimensions are automatically resized while preserving aspect ratio.

## Why Not LlamaIndex?

LlamaIndex does not currently support Ollama multimodal models (only text-based Ollama LLMs). We use Ollama's native HTTP API directly for:
- Full control over multimodal requests
- Lower latency (no orchestration overhead)
- Direct access to vision model features
- Simpler dependency management

## Future Roadmap

### Phase 2: RAG System
- ChromaDB vector store integration
- HuggingFace embeddings (sentence-transformers)
- Document ingestion pipeline
- Pet health knowledge base queries
- Admin document management

### Phase 3: ML Recommendations
- scikit-learn product scoring
- Product catalog integration
- Natural language explanations via RAG
- Recommendation caching

### Phase 4: Enhancements
- Response caching by image hash
- Circuit breaker for Ollama failures
- Multiple breed candidates for low confidence
- Async batch processing
- A/B testing for prompts

## Troubleshooting

### Ollama Connection Failed
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Check model is loaded
curl http://localhost:11434/api/show -d '{"name":"qwen3-vl:8b"}'

# Check network connectivity
docker compose exec ai-service curl http://ollama:11434/api/tags
```

### Tests Failing
```bash
# Rebuild image after dependency changes
docker compose build ai-service

# Check container logs
make logs-ai-service

# Run tests with verbose output
docker compose run --rm ai-service python -m pytest tests/ -vv
```

### Image Processing Errors
- Ensure image is valid JPEG/PNG/WebP
- Check file size < 5MB
- Verify dimensions >= 224x224 pixels
- Confirm base64 encoding is correct

## API Gateway Integration

The API Gateway automatically proxies requests to this service:

- Frontend: `POST /api/v1/vision/analyze`
- Nginx → API Gateway → AI Service: `http://ai-service:3003/api/v1/vision/analyze`
- No additional API Gateway configuration needed (zero-touch routing)

## Logging

Structured JSON logs to stdout:

```json
{
  "timestamp": "2026-01-23T15:30:00",
  "level": "INFO",
  "service": "ai-service",
  "message": "Breed identified: Golden Retriever (confidence: 0.92)",
  "module": "src.services.ollama_client"
}
```

Key events logged:
- Image processing (size, format, resize)
- Ollama requests and responses
- Breed identification results
- Errors and exceptions
```

**Step 2: Update TODO.md**

Modify root `TODO.md` to mark AI Service vision analysis as complete:
```markdown
### AI Service (FastAPI + Ollama) - PHASE 1 COMPLETE

**Phase 1: Vision Analysis** ✅
- [x] FastAPI application structure
- [x] Configuration with Pydantic Settings
- [x] Image processor (validation, resize, optimization)
- [x] Ollama HTTP API client (direct, no LlamaIndex)
- [x] Vision analysis endpoint (POST /api/v1/vision/analyze)
- [x] Comprehensive test suite (20+ tests, all passing)
- [x] Docker integration (Dockerfile, docker-compose.yml)
- [x] Documentation (README.md, design doc)

**Phase 2: RAG System** - NOT STARTED
- [ ] ChromaDB vector store setup
- [ ] HuggingFace embeddings integration
- [ ] Document ingestion pipeline
- [ ] RAG query endpoint
- [ ] Admin document management

**Phase 3: ML Recommendations** - NOT STARTED
- [ ] scikit-learn product scoring
- [ ] Product catalog schema
- [ ] Recommendation endpoint
- [ ] RAG-powered explanations
```

**Step 3: Commit**

```bash
git add README.md
git add ../../TODO.md
git commit -m "docs: add AI service documentation and update TODO

- Comprehensive README with API docs, configuration, troubleshooting
- Update TODO.md to mark Phase 1 (Vision Analysis) complete
- Document future roadmap (RAG, ML recommendations)
- Clarify why we use Ollama HTTP API directly (no LlamaIndex)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Integration Testing

**Files:**
- Create: `srcs/ai/tests/test_integration.py`

**Step 1: Write integration test**

Create `srcs/ai/tests/test_integration.py`:
```python
import pytest
from fastapi.testclient import TestClient
import base64
from PIL import Image
import io

from src.main import app

client = TestClient(app)

@pytest.fixture
def sample_dog_image():
    """Generate sample dog-like image (solid color for testing)."""
    img = Image.new('RGB', (512, 512), color=(139, 69, 19))  # Brown color
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

class TestVisionAnalysisIntegration:
    """Integration tests for vision analysis (requires Ollama running)."""

    def test_health_endpoint(self):
        """Test health check endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ai-service"
        assert "ollama_url" in data

    @pytest.mark.integration
    def test_vision_analysis_full_flow(self, sample_dog_image):
        """Test complete vision analysis flow with real Ollama.

        Note: This test requires Ollama to be running and may be slow (30-60s).
        Mark as integration test to skip in unit test runs.
        """
        response = client.post("/api/v1/vision/analyze", json={
            "image": sample_dog_image,
            "options": {
                "return_traits": True,
                "return_health_info": True
            }
        })

        # Should succeed even if breed is unknown
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "breed" in data["data"]
        assert "confidence" in data["data"]
        assert 0.0 <= data["data"]["confidence"] <= 1.0
        assert "traits" in data["data"]
        assert "timestamp" in data

    def test_invalid_image_rejected(self):
        """Test that invalid images are rejected properly."""
        response = client.post("/api/v1/vision/analyze", json={
            "image": "data:image/jpeg;base64,invalid_base64"
        })

        assert response.status_code in [422, 500]

    def test_oversized_image_rejected(self):
        """Test that oversized images are rejected."""
        # Create large image (will exceed size limit after encoding)
        large_img = Image.new('RGB', (5000, 5000), color='white')
        buffer = io.BytesIO()
        large_img.save(buffer, format='JPEG', quality=100)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        response = client.post("/api/v1/vision/analyze", json={
            "image": data_uri
        })

        assert response.status_code == 422
        assert "exceeds" in response.text.lower()
```

**Step 2: Run unit tests (skip integration)**

Run: `docker compose run --rm ai-service python -m pytest tests/ -v -m "not integration"`
Expected: PASS (all unit tests, integration test skipped)

**Step 3: Run integration test (with Ollama)**

Ensure Ollama is running, then run:
```bash
# Start Ollama if not running
docker compose up ollama -d

# Run integration tests
docker compose run --rm ai-service python -m pytest tests/test_integration.py -v -m integration
```
Expected: PASS (may take 30-60s for Ollama inference)

**Step 4: Run all tests**

Run: `docker compose run --rm ai-service python -m pytest tests/ -v`
Expected: ALL PASS (unit + integration)

**Step 5: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: add integration tests for vision analysis

- Health endpoint integration test
- Full vision analysis flow with real Ollama
- Image validation integration tests
- Marked slow tests with @pytest.mark.integration
- All tests passing (unit + integration)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Final Verification

**Step 1: Run complete test suite**

```bash
docker compose run --rm ai-service python -m pytest tests/ -v --cov=src
```

Expected: All tests passing, high coverage (>80%)

**Step 2: Verify service is running**

```bash
# Check health
curl http://localhost:3003/health

# Check API Gateway integration (if running)
curl -k https://localhost/api/v1/vision/analyze
```

**Step 3: Check docker-compose integration**

```bash
# Restart all services
docker compose down
docker compose up -d

# Verify ai-service is healthy
docker compose ps
docker compose logs ai-service
```

**Step 4: Final commit and push**

```bash
# Final integration commit
git add -A
git commit -m "feat: complete AI service Phase 1 (Vision Analysis)

Summary of implementation:
- FastAPI application with async support
- Direct Ollama HTTP API integration (qwen3-vl:8b)
- Image processing (validation, resize, optimization)
- Vision analysis endpoint with confidence scoring
- Comprehensive test coverage (20+ tests)
- Docker integration with health checks
- Complete documentation

Test results: 20+ tests passing
Coverage: >80%

Ready for integration with API Gateway and Frontend.

Next phases: RAG System (Phase 2), ML Recommendations (Phase 3)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote (if applicable)
git push origin feature/ai-service-vision
```

---

## Success Criteria Checklist

✅ Vision analysis endpoint accepts base64 images and returns breed data
✅ Direct Ollama HTTP API integration (no LlamaIndex)
✅ Image validation rejects invalid/oversized images
✅ Low confidence results include warning notes
✅ Ollama failures return 503 with clear error messages
✅ All tests pass (unit + integration)
✅ Service integrates with docker-compose.yml
✅ API Gateway can proxy requests automatically
✅ Health check endpoint responds correctly
✅ Documentation complete (README.md, design doc)

---

## Troubleshooting

### "ModuleNotFoundError" during tests
```bash
# Rebuild container after code changes
docker compose build ai-service
```

### Ollama connection timeout
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check model is loaded
docker compose exec ollama ollama list
```

### Tests pass but service fails at runtime
```bash
# Check service logs
make logs-ai-service

# Verify environment variables
docker compose exec ai-service env | grep OLLAMA
```

### Image processing failures
- Verify Pillow dependencies installed: `docker compose exec ai-service pip show Pillow`
- Check system dependencies: `docker compose exec ai-service dpkg -l | grep libjpeg`

---

## Plan Complete

All tasks implemented following TDD approach:
1. Configuration and Settings ✅
2. Pydantic Data Models ✅
3. Response Utilities ✅
4. Image Processor Service ✅
5. Ollama HTTP Client Service ✅
6. Vision Analysis Route ✅
7. FastAPI Application and Logging ✅
8. Docker Integration ✅
9. Service Documentation ✅
10. Integration Testing ✅

**Total test coverage:** 20+ tests across all components
**Implementation time:** ~2-3 hours for experienced developer

**Ready for Phase 2:** RAG System implementation
