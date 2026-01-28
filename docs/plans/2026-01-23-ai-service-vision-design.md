# AI Service - Vision Analysis Design

**Date:** 2026-01-23
**Status:** Approved
**Priority:** Critical (enables core breed identification feature)

## Overview

Design for the AI Service microservice, focusing on Phase 1: Vision Analysis. This service provides AI-powered pet breed identification using LlamaIndex orchestration and Ollama's qwen3-vl:8b multimodal model.

## Scope

### Phase 1 (This Design)
- Vision Analysis endpoint for breed identification
- Image validation and preprocessing
- LlamaIndex integration with Ollama
- Structured JSON responses with confidence scoring
- Comprehensive error handling
- Test suite

### Future Phases (Backlog)
- **Phase 2:** RAG System with ChromaDB for pet health knowledge base
- **Phase 3:** ML Product Recommendations with scikit-learn + LlamaIndex explanations
- **Phase 4:** Enhancements (caching, circuit breakers, async processing)

## Architecture

### High-Level Structure

```
srcs/ai/
├── src/
│   ├── main.py              # FastAPI app, routes, lifespan
│   ├── config.py            # Pydantic Settings
│   ├── routes/
│   │   └── vision.py        # Vision analysis endpoint
│   ├── services/
│   │   ├── ollama_client.py # Ollama API wrapper (LlamaIndex)
│   │   └── image_processor.py # Image validation/preprocessing
│   ├── models/
│   │   ├── requests.py      # Pydantic request models
│   │   └── responses.py     # Pydantic response models
│   └── utils/
│       ├── responses.py     # Standardized response format
│       └── logger.py        # Structured logging
├── tests/
│   └── test_vision.py       # Vision endpoint tests
├── requirements.txt
├── Dockerfile
├── .env
└── README.md
```

### Technology Stack

- **Framework:** FastAPI (async, high-performance)
- **AI Orchestration:** LlamaIndex (MultiModalLLM)
- **Vision Model:** Ollama qwen3-vl:8b (GPU-accelerated)
- **Image Processing:** Pillow (validation, resize, optimization)
- **Testing:** pytest + pytest-asyncio

## API Design

### Endpoint: POST /api/v1/vision/analyze

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "options": {
    "return_traits": true,
    "return_health_info": true
  }
}
```

**Response (Success - High Confidence):**
```json
{
  "success": true,
  "data": {
    "breed": "Golden Retriever",
    "confidence": 0.92,
    "traits": {
      "size": "large",
      "energy_level": "high",
      "temperament": "friendly, intelligent, devoted"
    },
    "health_considerations": [
      "Hip dysplasia risk",
      "Cancer predisposition",
      "Heart disease"
    ],
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

**Error Response (503 - Ollama Unavailable):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VISION_SERVICE_UNAVAILABLE",
    "message": "Vision analysis temporarily unavailable, please try again",
    "details": {}
  },
  "timestamp": "2026-01-23T15:30:00Z"
}
```

## Design Decisions

### 1. Image Handling
**Decision:** Accept base64-encoded images in JSON (data URI format)

**Rationale:**
- Simple frontend integration
- Works seamlessly with API Gateway proxying
- No special multipart handling required
- Consistent with JSON-only API design

### 2. LlamaIndex Integration
**Decision:** Use `OllamaMultiModal` directly for vision queries

**Rationale:**
- Clean LlamaIndex pattern for multimodal operations
- Initialize once at startup, reuse for all requests
- Handles Ollama connection pooling and retries
- Prepares for future RAG integration (consistent patterns)

**Implementation:**
```python
from llama_index.multi_modal_llms.ollama import OllamaMultiModal
from llama_index.core.schema import ImageDocument

# Initialize at startup
vision_llm = OllamaMultiModal(
    model="qwen3-vl:8b",
    base_url="http://ollama:11434",
    timeout=60.0,
    temperature=0.1
)

# Use in endpoint
image_doc = ImageDocument(image=image_base64)
response = vision_llm.complete(prompt=prompt, image_documents=[image_doc])
```

### 3. Prompt Design
**Decision:** Structured JSON output request with specific fields

**Rationale:**
- Makes parsing reliable and predictable
- Reduces post-processing complexity
- Model follows JSON structure well (qwen3-vl capability)
- Easier to validate and test

**Prompt:**
```
Analyze this pet image and identify the breed.
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
}
```

### 4. Confidence Handling
**Decision:** Always return response, add note when confidence < 0.5

**Rationale:**
- Better UX (user sees partial results)
- Transparent about uncertainty
- Allows user to decide if acceptable
- Avoids hard rejection that frustrates users

### 5. Image Validation
**Decision:** Moderate limits - 5MB max, JPEG/PNG/WebP, resize to 1024x1024

**Rationale:**
- Balances quality with performance
- Most phone photos are 2-4MB
- 1024x1024 sufficient for breed identification
- Reduces Ollama processing time

**Validation Rules:**
- Min dimensions: 224x224 (model needs detail)
- Max dimensions: 1024x1024 (performance)
- Max size: 5MB
- Formats: JPEG, PNG, WebP
- Aspect ratio: Preserved during resize

### 6. Error Handling
**Decision:** Fail fast with clear errors (HTTP 503 for Ollama failures)

**Rationale:**
- Simple and honest with users
- API Gateway can implement retry logic if needed
- Avoids complexity of internal retries adding latency
- Clear error messages for debugging

**Error Scenarios:**
- Image validation: 422 Unprocessable Entity
- Ollama timeout/unavailable: 503 Service Unavailable
- Parse failures: 500 Internal Server Error

## Data Models

### Request Models (`models/requests.py`)
```python
from pydantic import BaseModel, Field, validator

class VisionAnalysisOptions(BaseModel):
    return_traits: bool = True
    return_health_info: bool = True

class VisionAnalysisRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded image with data URI")
    options: VisionAnalysisOptions = VisionAnalysisOptions()

    @validator('image')
    def validate_image_format(cls, v):
        if not v.startswith('data:image/'):
            raise ValueError('Image must be a data URI')
        return v
```

### Response Models (`models/responses.py`)
```python
from typing import Optional, List
from pydantic import BaseModel, Field

class BreedTraits(BaseModel):
    size: str = Field(..., description="small/medium/large")
    energy_level: str = Field(..., description="low/medium/high")
    temperament: str = Field(..., description="Brief temperament description")

class VisionAnalysisData(BaseModel):
    breed: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    traits: BreedTraits
    health_considerations: List[str]
    note: Optional[str] = None

class VisionAnalysisResponse(BaseModel):
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str
```

## Configuration

### Environment Variables (`.env`)
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

### Pydantic Settings (`config.py`)
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
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
    SUPPORTED_FORMATS: list = ["jpeg", "jpg", "png", "webp"]

    # Vision Analysis
    LOW_CONFIDENCE_THRESHOLD: float = 0.5

    class Config:
        env_file = ".env"

settings = Settings()
```

## Implementation Details

### Ollama Client (`services/ollama_client.py`)

**Responsibilities:**
- Initialize LlamaIndex `OllamaMultiModal` at startup
- Build structured prompts for breed analysis
- Call Ollama via LlamaIndex
- Parse JSON responses (handle markdown code blocks if present)
- Add low-confidence notes

**Key Methods:**
- `async def analyze_breed(image_base64: str) -> Dict[str, Any]`
- `def _build_analysis_prompt() -> str`
- `def _parse_response(response_text: str) -> Dict[str, Any]`

### Image Processor (`services/image_processor.py`)

**Responsibilities:**
- Parse data URI to extract format and base64 data
- Validate image format (JPEG/PNG/WebP only)
- Check file size (max 5MB)
- Decode and validate dimensions (224-1024px)
- Resize if needed (preserve aspect ratio)
- Re-encode optimized image to base64 data URI

**Key Methods:**
- `def process_image(data_uri: str) -> str`
- `def _parse_data_uri(data_uri: str) -> Tuple[str, str]`
- `def _resize_image(image: Image) -> Image`
- `def _encode_image(image: Image, format: str) -> str`

### Vision Route (`routes/vision.py`)

**Flow:**
1. Validate request (Pydantic)
2. Process image (ImageProcessor)
3. Analyze with Ollama (OllamaVisionClient)
4. Build response (Pydantic models)
5. Handle errors (422, 503, 500)

**Error Handling:**
- `ValueError` → 422 (image validation)
- `ConnectionError` → 503 (Ollama unavailable)
- `Exception` → 500 (unexpected errors)

### Main Application (`main.py`)

**Lifespan Events:**
- **Startup:** Initialize ImageProcessor and OllamaVisionClient, inject into routes
- **Shutdown:** Cleanup (none needed for current implementation)

**Middleware:**
- CORS (permissive for development, API Gateway handles production CORS)

**Routes:**
- `GET /health` - Service health check
- `POST /api/v1/vision/analyze` - Vision analysis endpoint

## Testing Strategy

### Test Structure
```
tests/
└── test_vision.py
    ├── Unit Tests - Image Processor
    │   ├── test_valid_image_processing
    │   ├── test_invalid_format_rejected
    │   ├── test_oversized_image_rejected
    │   └── test_small_image_rejected
    ├── Unit Tests - Ollama Client
    │   ├── test_successful_analysis
    │   └── test_low_confidence_adds_note
    └── Integration Tests - API Endpoint
        ├── test_successful_analysis_endpoint
        ├── test_invalid_image_format
        └── test_ollama_failure_returns_503
```

### Test Execution (Docker-based)
```bash
# All tests
docker compose run --rm ai-service python -m pytest tests/ -v

# With coverage
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=html

# Specific test
docker compose run --rm ai-service python -m pytest tests/test_vision.py::TestVisionEndpoint -v
```

### Testing Principles
- All tests run inside Docker containers
- Mock LlamaIndex responses for unit tests
- Use real test images for integration tests
- Test all error scenarios (validation, Ollama failures)

## Deployment

### Docker Compose Integration

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
    - "3003:3003"  # Exposed for testing, not public
  networks:
    - backend-network
  volumes:
    - ./srcs/ai/src:/app/src  # Hot reload in development
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

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl gcc g++ build-essential \
    libjpeg-dev zlib1g-dev \
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

### Requirements

```txt
# FastAPI
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.0
pydantic-settings==2.1.0

# LlamaIndex
llama-index-core==0.10.0
llama-index-llms-ollama==0.1.0
llama-index-multi-modal-llms-ollama==0.1.0

# Image Processing
Pillow==10.2.0

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.26.0

# Utilities
python-multipart==0.0.22
```

## API Gateway Integration

**Zero-Touch Routing:**
- Frontend calls: `POST /api/v1/vision/analyze`
- Nginx forwards to API Gateway
- API Gateway automatically proxies to: `http://ai-service:3003/api/v1/vision/analyze`
- No additional configuration needed in API Gateway

**User Context:**
- API Gateway adds headers: `X-User-ID`, `X-User-Role`, `X-Request-ID`
- Vision endpoint can log user_id for analytics (future enhancement)
- Currently not used for authorization (vision analysis is user-agnostic)

## Logging

**Structured JSON Logging:**
```python
{
  "timestamp": "2026-01-23T15:30:00Z",
  "level": "INFO",
  "service": "ai-service",
  "message": "Breed identified: Golden Retriever (confidence: 0.92)",
  "module": "services.ollama_client"
}
```

**Key Log Events:**
- Image processing (size, format, resize)
- Ollama requests (model, timeout)
- Breed identification results (breed, confidence)
- Errors (validation, Ollama failures, parsing errors)

## Future Roadmap (Backlog)

### Phase 2: RAG System
- Set up ChromaDB vector store
- Implement HuggingFace embeddings (sentence-transformers/all-MiniLM-L6-v2)
- Document ingestion pipeline (PDFs, docs, markdown)
- RAG query endpoint: `POST /api/v1/rag/query`
- Admin document management: `POST /api/v1/rag/ingest`
- Ingest veterinary guides, breed standards, health information

### Phase 3: ML Product Recommendations
- Implement scikit-learn product scoring engine
- Product catalog schema (ai_schema.product_catalog)
- Recommendation endpoint: `POST /api/v1/recommendations`
- Integrate RAG for natural language explanations
- Redis caching for recommendations

### Phase 4: Enhancements
- Async processing for batch recommendations (Celery + Redis)
- Response caching by image hash (Redis)
- Circuit breaker pattern for Ollama failures
- Return multiple breed candidates when confidence is low
- A/B testing framework for prompt engineering
- Performance monitoring and analytics

## Success Criteria

✅ Vision analysis endpoint accepts base64 images and returns breed data
✅ LlamaIndex integrates with Ollama (qwen3-vl:8b)
✅ Image validation rejects invalid/oversized images
✅ Low confidence results include warning notes
✅ Ollama failures return 503 with clear error messages
✅ All tests pass (unit + integration)
✅ Service integrates with docker-compose.yml
✅ API Gateway can proxy requests automatically
✅ Health check endpoint responds correctly
✅ Documentation complete (README.md)

## Next Steps

1. Create isolated git worktree for implementation
2. Write detailed implementation plan with TDD approach
3. Implement in order:
   - Configuration and models
   - Image processor with tests
   - Ollama client with tests
   - Vision route with tests
   - Main application and Docker integration
4. Integration testing with full stack
5. Update TODO.md when complete

---

**Design Status:** ✅ Approved and ready for implementation
**Estimated Effort:** Medium (2-3 implementation sessions)
**Dependencies:** Ollama service must be running with qwen3-vl:8b model loaded
