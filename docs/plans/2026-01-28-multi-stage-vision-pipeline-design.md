# Multi-Stage Vision Analysis Pipeline Design

**Date:** 2026-01-28
**Author:** Claude Code
**Status:** Approved

## Executive Summary

This design introduces a multi-stage vision analysis pipeline to improve breed detection accuracy by delegating specialized classification tasks to dedicated HuggingFace models before invoking the Ollama vision model. The current system asks Ollama to handle too many tasks simultaneously (content safety, species detection, breed classification, and visual description), causing reduced accuracy and focus.

The new architecture introduces a **classification-service** microservice that performs pre-analysis using specialized models, allowing Ollama to focus exclusively on visual description with full contextual knowledge.

---

## Problem Statement

**Current Issues:**
- Ollama vision model (qwen3-vl:8b) is asked to perform multiple tasks in a single prompt:
  - Identify species (dog/cat)
  - Classify breed from 100+ possibilities
  - Detect crossbreeds vs purebreds
  - Provide visual description
  - Assess health indicators
  - Generate breed-specific care advice

- This multi-task burden causes:
  - Lower breed classification accuracy
  - Generic descriptions lacking specificity
  - Inconsistent crossbreed detection
  - Hallucinated breed information (not grounded in knowledge base)

**Solution:**
Delegate classification tasks to specialized models, use RAG for breed knowledge, and focus Ollama on what it does best: visual analysis of the specific individual animal in the image.

---

## Architecture Overview

### Service Communication Flow

```
User Request
    ↓
API Gateway
    ↓
AI Service (Orchestrator)
    ↓
┌─────────────────────────────────────────┐
│ Stage 1: Content Safety                 │
│   → Classification Service (NSFW)       │
└─────────────────────────────────────────┘
    ↓ (if safe)
┌─────────────────────────────────────────┐
│ Stage 2: Species Detection              │
│   → Classification Service (Animal 151) │
└─────────────────────────────────────────┘
    ↓ (if dog/cat)
┌─────────────────────────────────────────┐
│ Stage 3: Breed Classification           │
│   → Classification Service (ViT models) │
│   → Crossbreed Detection Logic          │
└─────────────────────────────────────────┘
    ↓ (confidence >= 0.40)
┌─────────────────────────────────────────┐
│ Stage 4: RAG Enrichment                 │
│   → ChromaDB (breed knowledge)          │
└─────────────────────────────────────────┘
    ↓ (graceful failure allowed)
┌─────────────────────────────────────────┐
│ Stage 5: Contextual Visual Analysis     │
│   → Ollama Vision (with full context)   │
└─────────────────────────────────────────┘
    ↓
Response Assembly
```

### New Service: Classification Service

**Responsibilities:**
- Load and manage 4 HuggingFace models (PyTorch + transformers)
- Expose REST API for synchronous classification
- Return structured predictions with confidence scores
- Handle model inference with GPU acceleration
- Implement crossbreed detection logic

**Technology Stack:**
- FastAPI framework
- PyTorch 2.5+ with CUDA support
- HuggingFace Transformers 4.46+
- Pillow for image processing
- Runtime: NVIDIA GPU (shares with Ollama)

**Network Placement:**
- `backend-network` only (internal communication)
- Internal port: 3004 (NOT exposed to localhost)
- Accessible from AI Service via Docker DNS: `http://classification-service:3004`

---

## Detailed Pipeline Stages

### Stage 1: Content Safety (NSFW Detection)

**Endpoint:** `POST /classify/content`

**Model:** `Falconsai/nsfw_image_detection`

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response (Safe):**
```json
{
  "is_safe": true,
  "nsfw_probability": 0.12,
  "threshold": 0.70
}
```

**Response (Unsafe):**
```json
{
  "is_safe": false,
  "nsfw_probability": 0.85,
  "threshold": 0.70
}
```

**Rejection Criteria:**
- If `nsfw_probability > 0.70` → Reject with `CONTENT_POLICY_VIOLATION`
- Status code: 422
- Message: "Image does not meet content policy requirements"

**Performance:** ~50-100ms

---

### Stage 2: Species Classification

**Endpoint:** `POST /classify/species`

**Model:** `dima806/animal_151_types_image_detection`

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response (Dog Detected):**
```json
{
  "species": "dog",
  "confidence": 0.87,
  "top_predictions": [
    {"label": "dog", "confidence": 0.87},
    {"label": "wolf", "confidence": 0.08},
    {"label": "cat", "confidence": 0.03}
  ]
}
```

**Rejection Criteria:**
- If top species NOT in `["dog", "cat"]` → Reject with `UNSUPPORTED_SPECIES`
- If `confidence < 0.60` → Reject with `SPECIES_DETECTION_FAILED`
- Status code: 422

**Performance:** ~100-150ms

---

### Stage 3: Breed Classification with Crossbreed Detection

**Endpoint:** `POST /classify/breed`

**Models:**
- Dogs: `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit` (120 breeds, trained on Stanford Dogs Dataset)
- Cats: `dima806/cat_breed_image_detection`

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "species": "dog",
  "top_k": 5
}
```

**Response (Purebred):**
```json
{
  "breed_analysis": {
    "primary_breed": "golden_retriever",
    "confidence": 0.89,
    "is_likely_crossbreed": false,
    "breed_probabilities": [
      {"breed": "golden_retriever", "probability": 0.89},
      {"breed": "labrador_retriever", "probability": 0.06},
      {"breed": "flat_coated_retriever", "probability": 0.03},
      {"breed": "english_setter", "probability": 0.01},
      {"breed": "irish_setter", "probability": 0.01}
    ],
    "crossbreed_analysis": null
  }
}
```

**Response (Crossbreed Detected):**
```json
{
  "breed_analysis": {
    "primary_breed": "goldendoodle",
    "confidence": 0.42,
    "is_likely_crossbreed": true,
    "breed_probabilities": [
      {"breed": "golden_retriever", "probability": 0.47},
      {"breed": "poodle", "probability": 0.36},
      {"breed": "labradoodle", "probability": 0.09},
      {"breed": "labrador_retriever", "probability": 0.05},
      {"breed": "cocker_spaniel", "probability": 0.02}
    ],
    "crossbreed_analysis": {
      "detected_breeds": ["Golden Retriever", "Poodle"],
      "common_name": "Goldendoodle",
      "confidence_reasoning": "Multiple breeds with high probabilities (golden_retriever: 0.47, poodle: 0.36)"
    }
  }
}
```

**Crossbreed Detection Logic:**

Ported from existing `ollama_client.py` (lines 197-346):

```python
# Thresholds (configurable via environment)
CROSSBREED_PROBABILITY_THRESHOLD = 0.35
PUREBRED_CONFIDENCE_THRESHOLD = 0.75
PUREBRED_GAP_THRESHOLD = 0.30

# Detection rules
is_crossbreed = False

if second_breed_probability > 0.35:
    is_crossbreed = True

if top_breed_probability < 0.75:
    gap = top_breed_probability - second_breed_probability
    if gap < 0.30:
        is_crossbreed = True

# If crossbreed detected:
# - Identify common name (Goldendoodle, Labradoodle, etc.)
# - Calculate average confidence from top 2 breeds
# - Return parent breed names
```

**Common Crossbreed Mappings:**
- Golden Retriever + Poodle → Goldendoodle
- Labrador Retriever + Poodle → Labradoodle
- Pug + Beagle → Puggle
- Cocker Spaniel + Poodle → Cockapoo
- Yorkshire Terrier + Poodle → Yorkipoo
- Maltese + Poodle → Maltipoo
- Cavalier King Charles Spaniel + Poodle → Cavapoo
- Pomeranian + Husky → Pomsky
- Chihuahua + Dachshund → Chiweenie
- Chihuahua + Yorkshire Terrier → Chorkie

**Rejection Criteria:**
- If `confidence < 0.40` → Reject with `BREED_DETECTION_FAILED`
- Note: Confidence for crossbreeds is the average of top 2 probabilities
- Status code: 422

**Performance:** ~150-250ms

**Limitation:** ViT models are trained on purebred datasets only. Crossbreed detection relies on analyzing probability distributions, not explicit crossbreed training data.

---

### Stage 4: RAG Enrichment

**Purpose:** Retrieve breed-specific knowledge to provide context for Ollama's visual analysis.

**Two Query Modes:**

**Purebred Query:**
```python
query = "Golden Retriever breed characteristics health care requirements"
top_k = 5 chunks from ChromaDB
```

**Crossbreed Query:**
```python
# Query for each parent breed separately
query_1 = "Golden Retriever breed characteristics health care requirements"
query_2 = "Poodle breed characteristics health care requirements"
top_k = 3 chunks per breed
# Combine and deduplicate
```

**RAG Response:**
```json
{
  "breed": "Golden Retriever",  // Or null for crossbreeds
  "parent_breeds": null,  // Or ["Golden Retriever", "Poodle"] for crossbreeds
  "description": "Large sporting dog known for friendly temperament...",
  "care_summary": "Requires daily exercise, regular grooming...",
  "health_info": "Common issues: hip dysplasia, cancer, heart disease...",
  "sources": ["akc_breed_standards.md", "vet_health_guide.md"]
}
```

**Failure Handling:** Graceful degradation
- If ChromaDB unavailable or query fails → Continue with `rag_context = None`
- Ollama still receives classification context
- Response includes `enriched_info: null`
- Log warning but don't fail request

**Performance:** ~50-100ms

---

### Stage 5: Contextual Ollama Visual Analysis

**Purpose:** Generate visual description of the specific individual animal with full contextual knowledge.

**New Method:** `OllamaVisionClient.analyze_with_context()`

**Input Parameters:**
- `image_base64`: Processed image
- `species`: Pre-classified species (dog/cat)
- `breed_analysis`: Complete breed classification result
- `rag_context`: RAG-enriched breed knowledge (optional)

**Contextual Prompt Structure (Purebred):**

```
You are analyzing a dog image that has been pre-classified as a Golden Retriever (confidence: 0.89).

BREED CONTEXT (from database):
Large sporting dog, 55-75 lbs, friendly temperament, high energy level.
Common health considerations: hip dysplasia, cancer, heart disease.

YOUR TASK: Describe THIS SPECIFIC Golden Retriever based on what you SEE in the image:
- Physical appearance and condition (coat quality, body condition, visible features)
- Estimated age range based on visual cues
- Any notable characteristics or features specific to this individual
- Visible health indicators (if any)

Return ONLY valid JSON:
{
  "description": "detailed visual description of this specific dog",
  "traits": {
    "size": "small/medium/large (based on visual proportions)",
    "energy_level": "low/medium/high (inferred from posture/expression)",
    "temperament": "brief description based on expression and body language"
  },
  "health_observations": ["visible observation 1", "visible observation 2"]
}

Focus on describing what you SEE, not general breed knowledge.
```

**Contextual Prompt Structure (Crossbreed):**

```
You are analyzing a dog image that has been pre-classified as a Goldendoodle (confidence: 0.42).

BREED CONTEXT (from database):
Parent breeds: Golden Retriever, Poodle
Typical characteristics: Medium to large size, wavy or curly coat, friendly and intelligent.
Common health considerations: hip dysplasia, progressive retinal atrophy, patellar luxation.

YOUR TASK: Describe THIS SPECIFIC dog based on what you SEE in the image:
[Same as purebred prompt...]
```

**Key Differences from Current Implementation:**
- ✅ Ollama knows the breed BEFORE analyzing (no guessing)
- ✅ Prompt explicitly focuses on visual description
- ✅ RAG context prevents hallucinated breed facts
- ✅ Health observations are visual only (breed health issues come from RAG)
- ✅ Ollama response is simpler (description + visual traits only)

**Performance:** ~2-4 seconds (Ollama inference time)

---

## AI Service Orchestration

### VisionOrchestrator Class

**File:** `srcs/ai/src/services/vision_orchestrator.py`

**Responsibilities:**
- Coordinate sequential pipeline execution
- Handle early rejection at each stage
- Implement error handling and graceful degradation
- Assemble final response

**Key Methods:**

```python
class VisionOrchestrator:
    def __init__(self, classification_client, ollama_client, rag_service):
        self.classification = classification_client
        self.ollama = ollama_client
        self.rag = rag_service

    async def analyze_image(self, image: str) -> dict:
        """Execute full pipeline with early rejection."""

        # Stage 1: Content safety (strict)
        safety = await self.classification.check_content(image)
        if not safety["is_safe"]:
            raise ValueError("CONTENT_POLICY_VIOLATION")

        # Stage 2: Species detection (strict)
        species_result = await self.classification.detect_species(image)
        if species_result["species"] not in ["dog", "cat"]:
            raise ValueError("UNSUPPORTED_SPECIES")
        if species_result["confidence"] < 0.60:
            raise ValueError("SPECIES_DETECTION_FAILED")

        # Stage 3: Breed classification (strict)
        breed_result = await self.classification.detect_breed(
            image, species_result["species"], top_k=5
        )
        if breed_result["breed_analysis"]["confidence"] < 0.40:
            raise ValueError("BREED_DETECTION_FAILED")

        # Stage 4: RAG enrichment (graceful failure)
        try:
            if breed_result["breed_analysis"]["is_likely_crossbreed"]:
                detected_breeds = breed_result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]
                rag_context = await self.rag.get_crossbreed_context(detected_breeds)
            else:
                rag_context = await self.rag.get_breed_context(
                    breed_result["breed_analysis"]["primary_breed"]
                )
        except Exception as e:
            logger.warning(f"RAG enrichment failed: {e}")
            rag_context = None

        # Stage 5: Contextual Ollama analysis
        ollama_result = await self.ollama.analyze_with_context(
            image=image,
            species=species_result["species"],
            breed_analysis=breed_result["breed_analysis"],
            rag_context=rag_context
        )

        # Assemble final response
        return {
            "species": species_result["species"],
            "breed_analysis": breed_result["breed_analysis"],
            "description": ollama_result["description"],
            "traits": ollama_result["traits"],
            "health_observations": ollama_result["health_observations"],
            "enriched_info": rag_context
        }
```

### Updated Vision Route

**File:** `srcs/ai/src/routes/vision.py`

**Changes:**
- Replace direct `ollama_client.analyze_breed()` call with `vision_orchestrator.analyze_image()`
- Update error handling for new rejection codes
- Maintain existing endpoint path: `POST /api/v1/vision/analyze`
- Breaking change: Response format updated (see Response Models section)

```python
# Service instances (injected at startup)
image_processor: ImageProcessor = None
vision_orchestrator: VisionOrchestrator = None  # New

@router.post("/analyze", response_model=dict)
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze pet image with multi-stage pipeline."""
    try:
        # Process and validate image
        processed_image = image_processor.process_image(request.image)

        # Run orchestrated pipeline
        result = await vision_orchestrator.analyze_image(processed_image)

        return success_response(result)

    except ValueError as e:
        # Classification rejection errors (422)
        error_code = str(e)
        error_map = {
            "CONTENT_POLICY_VIOLATION": "Image does not meet content policy requirements",
            "UNSUPPORTED_SPECIES": "Only dog and cat images are supported",
            "SPECIES_DETECTION_FAILED": "Unable to identify species with sufficient confidence",
            "BREED_DETECTION_FAILED": "Unable to identify breed with sufficient confidence"
        }
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(code=error_code, message=error_map.get(error_code))
        )

    except ConnectionError as e:
        # Service unavailability (503)
        logger.error(f"Service connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="VISION_SERVICE_UNAVAILABLE",
                message="Vision analysis temporarily unavailable, please try again"
            )
        )

    except Exception as e:
        # Unexpected errors (500)
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(code="INTERNAL_ERROR", message="An unexpected error occurred")
        )
```

---

## Classification Service Implementation

### Service Structure

```
srcs/classification-service/
├── Dockerfile
├── requirements.txt
├── .env
├── src/
│   ├── main.py                          # FastAPI app + lifespan
│   ├── config.py                        # Pydantic Settings
│   ├── models/
│   │   ├── nsfw_detector.py             # Falconsai/nsfw_image_detection
│   │   ├── species_classifier.py        # dima806/animal_151_types_image_detection
│   │   ├── dog_breed_classifier.py      # wesleyacheng/dog-breeds-multiclass...
│   │   └── cat_breed_classifier.py      # dima806/cat_breed_image_detection
│   ├── services/
│   │   ├── crossbreed_detector.py       # Top-K analysis + common name mapping
│   │   └── image_utils.py               # Base64 → PIL Image conversion
│   └── routes/
│       └── classify.py                  # API endpoints
└── tests/
    ├── test_nsfw_detector.py
    ├── test_species_classifier.py
    ├── test_breed_classifiers.py
    └── test_crossbreed_detector.py
```

### Model Loading Strategy

**File:** `src/main.py`

```python
from contextlib import asynccontextmanager
import torch
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models at startup (GPU warmup)."""
    logger.info("Loading classification models...")

    # Detect GPU availability
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")

    # Load models (HuggingFace auto-downloads on first run)
    app.state.nsfw_detector = NSFWDetector(device=device)
    app.state.species_classifier = SpeciesClassifier(device=device)
    app.state.dog_breed_classifier = DogBreedClassifier(device=device)
    app.state.cat_breed_classifier = CatBreedClassifier(device=device)
    app.state.crossbreed_detector = CrossbreedDetector(config)

    logger.info("All models loaded successfully")
    yield

    # Cleanup on shutdown
    logger.info("Shutting down classification service")

app = FastAPI(lifespan=lifespan)
app.include_router(classify_router)
```

**Why Lifespan Loading:**
- Models loaded once at startup (~60-90 seconds first time, ~10-15 seconds after cache)
- Subsequent inference is fast (50-250ms per model)
- Avoids cold-start latency on first request
- GPU memory allocated once and reused
- HuggingFace models cached in volume: `/app/.cache/huggingface`

### Crossbreed Detection Service

**File:** `src/services/crossbreed_detector.py`

Ports logic from `srcs/ai/src/services/ollama_client.py` (lines 197-346).

**Key Functions:**
- `process_breed_result(breed_probabilities: List[dict]) -> dict`: Analyze top-K probabilities
- `detect_crossbreed(top_prob, second_prob, gap) -> bool`: Apply threshold logic
- `identify_common_name(breeds: List[str]) -> Optional[str]`: Map to known crossbreed names
- `build_breed_analysis(...)`: Assemble final `breed_analysis` response

**Configuration (Environment Variables):**
```bash
CROSSBREED_PROBABILITY_THRESHOLD=0.35
PUREBRED_CONFIDENCE_THRESHOLD=0.75
PUREBRED_GAP_THRESHOLD=0.30
```

---

## RAG Service Enhancements

**File:** `srcs/ai/src/services/rag_service.py`

### New Methods

**1. Single Breed Context (Purebred):**

```python
async def get_breed_context(self, breed: str) -> dict:
    """Retrieve context for a single breed.

    Args:
        breed: Normalized breed name (e.g., "golden_retriever")

    Returns:
        Dict with description, care, health info, sources
    """
    breed_display = breed.replace("_", " ").title()

    query = f"{breed_display} breed characteristics health care requirements"
    chunks = await self.query_engine.query(query, top_k=5)

    return {
        "breed": breed_display,
        "parent_breeds": None,
        "description": self._extract_description(chunks),
        "care_summary": self._extract_care_info(chunks),
        "health_info": self._extract_health_info(chunks),
        "sources": [chunk.metadata["source"] for chunk in chunks]
    }
```

**2. Crossbreed Context (Multiple Parent Breeds):**

```python
async def get_crossbreed_context(self, parent_breeds: List[str]) -> dict:
    """Retrieve context for crossbreed parent breeds.

    Args:
        parent_breeds: List like ["Golden Retriever", "Poodle"]

    Returns:
        Dict with combined breed context
    """
    # Query for each parent breed
    contexts = []
    for breed in parent_breeds:
        query = f"{breed} breed characteristics health care requirements"
        chunks = await self.query_engine.query(query, top_k=3)
        contexts.append({"breed": breed, "chunks": chunks})

    # Combine and deduplicate
    all_chunks = [chunk for ctx in contexts for chunk in ctx["chunks"]]

    return {
        "breed": None,
        "parent_breeds": parent_breeds,
        "description": self._extract_crossbreed_description(contexts),
        "care_summary": self._extract_combined_care_info(all_chunks),
        "health_info": self._extract_combined_health_info(all_chunks),
        "sources": list(set([chunk.metadata["source"] for chunk in all_chunks]))
    }
```

### Helper Methods

- `_extract_description(chunks)`: Synthesize breed description from chunks
- `_extract_care_info(chunks)`: Extract care requirements
- `_extract_health_info(chunks)`: Extract common health issues
- `_extract_crossbreed_description(contexts)`: Combine parent breed characteristics
- `_extract_combined_care_info(chunks)`: Merge care requirements from multiple breeds
- `_extract_combined_health_info(chunks)`: Merge health considerations

---

## Ollama Client Modifications

**File:** `srcs/ai/src/services/ollama_client.py`

### New Method

```python
async def analyze_with_context(
    self,
    image_base64: str,
    species: str,
    breed_analysis: dict,
    rag_context: Optional[dict]
) -> dict:
    """Analyze pet image with pre-classified context.

    Args:
        image_base64: Base64-encoded image (data URI or raw)
        species: Pre-classified species (dog/cat)
        breed_analysis: Complete breed classification result
        rag_context: RAG-enriched breed knowledge (can be None)

    Returns:
        Dict with visual description, traits, health observations

    Raises:
        ConnectionError: If Ollama unreachable
        RuntimeError: If response parsing fails
    """
    # Extract base64 part if data URI
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    # Build contextual prompt
    prompt = self._build_contextual_prompt(species, breed_analysis, rag_context)

    # Call Ollama HTTP API
    timeout = httpx.Timeout(self.timeout, connect=self.timeout)
    async with httpx.AsyncClient(timeout=timeout) as client:
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
                "options": {"temperature": self.temperature}
            }
        )
        response.raise_for_status()
        response_data = response.json()

    # Parse JSON response
    content = response_data.get("message", {}).get("content", "")
    result = self._parse_response(content)

    logger.info(f"Visual analysis complete for {breed_analysis['primary_breed']}")
    return result
```

### Contextual Prompt Builder

```python
def _build_contextual_prompt(
    self,
    species: str,
    breed_analysis: dict,
    rag_context: Optional[dict]
) -> str:
    """Build focused prompt with classification context."""

    is_crossbreed = breed_analysis["is_likely_crossbreed"]
    confidence = breed_analysis["confidence"]

    # Build RAG context section
    if rag_context:
        if is_crossbreed:
            breed_name = (
                breed_analysis["crossbreed_analysis"]["common_name"] or
                f"{breed_analysis['crossbreed_analysis']['detected_breeds'][0]}-"
                f"{breed_analysis['crossbreed_analysis']['detected_breeds'][1]} mix"
            )
            parent_breeds = breed_analysis["crossbreed_analysis"]["detected_breeds"]
            context_section = f"""BREED CONTEXT (from database):
Parent breeds: {', '.join(parent_breeds)}
Typical characteristics: {rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
        else:
            breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
            context_section = f"""BREED CONTEXT (from database):
{rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
    else:
        breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
        context_section = "BREED CONTEXT: (unavailable)"

    return f"""You are analyzing a {species} image that has been pre-classified as a {breed_name} (confidence: {confidence:.2f}).

{context_section}

YOUR TASK: Describe THIS SPECIFIC {species} based on what you SEE in the image:
- Physical appearance and condition (coat quality, body condition, visible features)
- Estimated age range based on visual cues
- Any notable characteristics or features specific to this individual
- Visible health indicators (if any)

Return ONLY valid JSON:
{{
  "description": "detailed visual description of this specific {species}",
  "traits": {{
    "size": "small/medium/large (based on visual proportions)",
    "energy_level": "low/medium/high (inferred from posture/expression)",
    "temperament": "brief description based on expression and body language"
  }},
  "health_observations": ["visible observation 1", "visible observation 2"]
}}

Focus on describing what you SEE, not general breed knowledge."""
```

### Deprecation Notice

The existing `analyze_breed()` method will be **deprecated** but kept for backward compatibility during transition:

```python
async def analyze_breed(
    self,
    image_base64: str,
    detect_crossbreed: bool = True,
    top_n_breeds: int = 2
) -> Dict[str, Any]:
    """DEPRECATED: Use analyze_with_context() instead.

    This method will be removed in future versions.
    """
    warnings.warn(
        "analyze_breed() is deprecated. Use the multi-stage pipeline with "
        "analyze_with_context() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    # Keep existing implementation for now
    ...
```

---

## Response Models

**File:** `srcs/ai/src/models/responses.py`

### New Models

```python
from typing import Optional, List
from pydantic import BaseModel, Field


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
    traits: BreedTraits = Field(..., description="Observed traits from image")
    health_observations: List[str] = Field(..., description="Visible health indicators")
    enriched_info: Optional[EnrichedInfo] = None


class VisionAnalysisResponse(BaseModel):
    """Standardized vision analysis response."""
    success: bool = True
    data: Optional[VisionAnalysisData] = None
    error: Optional[dict] = None
    timestamp: str
```

### Breaking Changes

**Old Response Format (Current):**
```json
{
  "success": true,
  "data": {
    "breed": "golden_retriever",
    "confidence": 0.85,
    "traits": {
      "size": "large",
      "energy_level": "high",
      "temperament": "Friendly and energetic"
    },
    "health_considerations": ["hip dysplasia", "cancer"],
    "note": null,
    "enriched_info": null
  },
  "timestamp": "2026-01-28T10:00:00.000000"
}
```

**New Response Format:**
```json
{
  "success": true,
  "data": {
    "species": "dog",
    "breed_analysis": {
      "primary_breed": "golden_retriever",
      "confidence": 0.89,
      "is_likely_crossbreed": false,
      "breed_probabilities": [
        {"breed": "golden_retriever", "probability": 0.89},
        {"breed": "labrador_retriever", "probability": 0.06},
        {"breed": "flat_coated_retriever", "probability": 0.03},
        {"breed": "english_setter", "probability": 0.01},
        {"breed": "irish_setter", "probability": 0.01}
      ],
      "crossbreed_analysis": null
    },
    "description": "This Golden Retriever appears to be an adult dog in excellent physical condition...",
    "traits": {
      "size": "large",
      "energy_level": "medium",
      "temperament": "Alert and friendly based on expression"
    },
    "health_observations": [
      "Coat appears healthy and well-groomed",
      "Eyes are clear and bright"
    ],
    "enriched_info": {
      "breed": "Golden Retriever",
      "parent_breeds": null,
      "description": "Large sporting dog known for friendly temperament...",
      "care_summary": "Requires daily exercise, regular grooming...",
      "health_info": "Common issues: hip dysplasia, cancer, heart disease...",
      "sources": ["akc_breed_standards.md", "vet_health_guide.md"]
    }
  },
  "timestamp": "2026-01-28T10:00:00.000000"
}
```

**Migration Strategy:** In-place upgrade (Option B)
- Replace existing `/api/v1/vision/analyze` endpoint
- Frontend must update to handle new response structure
- Tests must be rebuilt to match new format
- No API versioning (simpler deployment)

---

## Docker Infrastructure

### docker-compose.yml Updates

Add classification-service:

```yaml
services:
  classification-service:
    build:
      context: ./srcs/classification-service
      dockerfile: Dockerfile
    container_name: ft_transcendence_classification_service
    runtime: nvidia  # GPU access
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
    volumes:
      - huggingface-cache:/app/.cache/huggingface  # Persist models
    networks:
      - backend-network
    ports:
      - "3004:3004"  # Internal only (not exposed to host)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s  # Longer startup (model loading)
    depends_on:
      - redis

volumes:
  huggingface-cache:  # New volume for model persistence
```

### Classification Service Dockerfile

**File:** `srcs/classification-service/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN useradd -m -u 1000 classifier && \
    chown -R classifier:classifier /app
USER classifier

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:3004/health || exit 1

EXPOSE 3004

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3004"]
```

### requirements.txt

**File:** `srcs/classification-service/requirements.txt`

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
```

**Size Estimate:** ~2.5GB Docker image (PyTorch is large)

### GPU Memory Requirements

**Total VRAM Usage:**
- Ollama (qwen3-vl:8b): ~6-8GB
- NSFW detector: ~500MB
- Species classifier (Animal 151): ~400MB
- Dog breed classifier (ViT): ~800MB
- Cat breed classifier: ~400MB

**Total: ~10GB VRAM minimum**

**Supported GPUs:**
- NVIDIA RTX 3060 12GB ✅
- NVIDIA RTX 3080 10GB ⚠️ (tight, may need to limit batch size)
- NVIDIA RTX 4090 24GB ✅
- NVIDIA A6000 48GB ✅

### Environment Variables

**File:** `srcs/classification-service/.env`

```bash
# Service
SERVICE_NAME=classification-service
SERVICE_PORT=3004
LOG_LEVEL=INFO

# Models
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

# HuggingFace
TRANSFORMERS_CACHE=/app/.cache/huggingface
HF_HOME=/app/.cache/huggingface
```

**File:** `srcs/ai/.env` (add classification service URL)

```bash
# Existing vars...
OLLAMA_BASE_URL=http://ollama:11434
CHROMADB_HOST=ai-service
CHROMADB_PORT=8000

# New classification service
CLASSIFICATION_SERVICE_URL=http://classification-service:3004
CLASSIFICATION_TIMEOUT=30  # Generous timeout for model inference
```

---

## Testing Strategy

### Test Organization

```
srcs/ai/tests/
├── unit/
│   ├── test_vision_orchestrator.py       # Mock all dependencies
│   ├── test_classification_client.py     # Mock HTTP calls
│   └── test_response_models.py           # Pydantic validation
├── integration/
│   ├── test_classification_service.py    # Real HF models (slow)
│   ├── test_ollama_integration.py        # Real Ollama
│   └── test_full_pipeline.py             # End-to-end (slow)
└── fixtures/
    ├── sample_images.py                  # Base64 dog/cat images
    └── mock_responses.py                 # Mock data for tests

srcs/classification-service/tests/
├── test_nsfw_detector.py
├── test_species_classifier.py
├── test_breed_classifiers.py
└── test_crossbreed_detector.py           # Logic tests (no model)
```

### Key Test Scenarios

**AI Service - Vision Orchestrator:**

```python
# test_vision_orchestrator.py

@pytest.fixture
def mock_classification():
    """Mock classification service client."""
    return Mock()

@pytest.fixture
def mock_rag():
    """Mock RAG service."""
    return Mock()

@pytest.fixture
def mock_ollama():
    """Mock Ollama client."""
    return Mock()


async def test_purebred_pipeline_success(mock_classification, mock_rag, mock_ollama):
    """Test successful purebred dog analysis."""
    # Arrange
    mock_classification.check_content.return_value = {"is_safe": True, "nsfw_probability": 0.1}
    mock_classification.detect_species.return_value = {
        "species": "dog",
        "confidence": 0.87
    }
    mock_classification.detect_breed.return_value = {
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
    mock_rag.get_breed_context.return_value = {
        "breed": "Golden Retriever",
        "description": "Large sporting dog...",
        "care_summary": "...",
        "health_info": "...",
        "sources": []
    }
    mock_ollama.analyze_with_context.return_value = {
        "description": "This Golden Retriever...",
        "traits": {"size": "large", "energy_level": "medium", "temperament": "friendly"},
        "health_observations": ["Healthy coat"]
    }

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,...")

    # Assert
    assert result["species"] == "dog"
    assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
    assert result["breed_analysis"]["is_likely_crossbreed"] == False
    assert result["enriched_info"] is not None
    assert "Golden Retriever" in result["description"]


async def test_crossbreed_detection_pipeline(mock_classification, mock_rag, mock_ollama):
    """Test crossbreed detection (Goldendoodle)."""
    # Arrange
    mock_classification.check_content.return_value = {"is_safe": True}
    mock_classification.detect_species.return_value = {"species": "dog", "confidence": 0.90}
    mock_classification.detect_breed.return_value = {
        "breed_analysis": {
            "primary_breed": "goldendoodle",
            "confidence": 0.42,
            "is_likely_crossbreed": True,
            "breed_probabilities": [
                {"breed": "golden_retriever", "probability": 0.47},
                {"breed": "poodle", "probability": 0.36}
            ],
            "crossbreed_analysis": {
                "detected_breeds": ["Golden Retriever", "Poodle"],
                "common_name": "Goldendoodle",
                "confidence_reasoning": "Multiple breeds with high probabilities"
            }
        }
    }
    mock_rag.get_crossbreed_context.return_value = {
        "parent_breeds": ["Golden Retriever", "Poodle"],
        "description": "...",
        "sources": []
    }

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,...")

    # Assert
    assert result["breed_analysis"]["is_likely_crossbreed"] == True
    assert result["breed_analysis"]["crossbreed_analysis"]["common_name"] == "Goldendoodle"
    assert "Golden Retriever" in result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]
    assert "Poodle" in result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]


async def test_nsfw_rejection(mock_classification):
    """Test content policy violation rejection."""
    # Arrange
    mock_classification.check_content.return_value = {
        "is_safe": False,
        "nsfw_probability": 0.85
    }

    orchestrator = VisionOrchestrator(mock_classification, None, None)

    # Act & Assert
    with pytest.raises(ValueError, match="CONTENT_POLICY_VIOLATION"):
        await orchestrator.analyze_image("data:image/jpeg;base64,...")


async def test_unsupported_species_rejection(mock_classification):
    """Test rabbit image rejection."""
    # Arrange
    mock_classification.check_content.return_value = {"is_safe": True}
    mock_classification.detect_species.return_value = {
        "species": "rabbit",
        "confidence": 0.92
    }

    orchestrator = VisionOrchestrator(mock_classification, None, None)

    # Act & Assert
    with pytest.raises(ValueError, match="UNSUPPORTED_SPECIES"):
        await orchestrator.analyze_image("data:image/jpeg;base64,...")


async def test_low_breed_confidence_rejection(mock_classification):
    """Test rejection when breed confidence < 0.40."""
    # Arrange
    mock_classification.check_content.return_value = {"is_safe": True}
    mock_classification.detect_species.return_value = {"species": "dog", "confidence": 0.85}
    mock_classification.detect_breed.return_value = {
        "breed_analysis": {
            "primary_breed": "unknown",
            "confidence": 0.32,  # Below threshold
            "is_likely_crossbreed": False,
            "breed_probabilities": []
        }
    }

    orchestrator = VisionOrchestrator(mock_classification, None, None)

    # Act & Assert
    with pytest.raises(ValueError, match="BREED_DETECTION_FAILED"):
        await orchestrator.analyze_image("data:image/jpeg;base64,...")


async def test_rag_failure_graceful_degradation(mock_classification, mock_ollama):
    """Test pipeline continues when RAG fails."""
    # Arrange
    mock_classification.check_content.return_value = {"is_safe": True}
    mock_classification.detect_species.return_value = {"species": "dog", "confidence": 0.87}
    mock_classification.detect_breed.return_value = {
        "breed_analysis": {
            "primary_breed": "golden_retriever",
            "confidence": 0.89,
            "is_likely_crossbreed": False
        }
    }
    mock_rag = Mock(side_effect=Exception("ChromaDB connection failed"))
    mock_ollama.analyze_with_context.return_value = {
        "description": "Golden Retriever in good condition",
        "traits": {},
        "health_observations": []
    }

    orchestrator = VisionOrchestrator(mock_classification, mock_ollama, mock_rag)

    # Act
    result = await orchestrator.analyze_image("data:image/jpeg;base64,...")

    # Assert
    assert result["enriched_info"] is None  # RAG failed gracefully
    assert result["description"] is not None  # Ollama still worked
    assert result["breed_analysis"]["primary_breed"] == "golden_retriever"
```

**Classification Service - Breed Classifier:**

```python
# test_breed_classifiers.py

def test_dog_breed_top5_predictions(dog_classifier):
    """Test top-5 breed predictions return expected format."""
    image = load_sample_image("golden_retriever.jpg")

    predictions = dog_classifier.predict(image, top_k=5)

    assert len(predictions) == 5
    assert predictions[0]["breed"] == "golden_retriever"
    assert predictions[0]["probability"] > 0.7
    assert all(p["probability"] >= 0.0 and p["probability"] <= 1.0 for p in predictions)


def test_crossbreed_split_probabilities(dog_classifier):
    """Test goldendoodle returns split probabilities (no dominant breed)."""
    image = load_sample_image("goldendoodle.jpg")

    predictions = dog_classifier.predict(image, top_k=5)

    # Expect no single breed dominates
    assert predictions[0]["probability"] < 0.6
    assert predictions[1]["probability"] > 0.3
```

**Classification Service - Crossbreed Detector:**

```python
# test_crossbreed_detector.py

def test_detect_crossbreed_high_second_probability():
    """Test crossbreed detection when second breed probability > 0.35."""
    detector = CrossbreedDetector(config)

    probabilities = [
        {"breed": "golden_retriever", "probability": 0.47},
        {"breed": "poodle", "probability": 0.36},
        {"breed": "labrador_retriever", "probability": 0.10}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["is_likely_crossbreed"] == True
    assert result["crossbreed_analysis"]["common_name"] == "Goldendoodle"


def test_detect_purebred_high_confidence():
    """Test purebred detection when top breed has high confidence."""
    detector = CrossbreedDetector(config)

    probabilities = [
        {"breed": "golden_retriever", "probability": 0.89},
        {"breed": "labrador_retriever", "probability": 0.06}
    ]

    result = detector.process_breed_result(probabilities)

    assert result["is_likely_crossbreed"] == False
    assert result["crossbreed_analysis"] is None


def test_identify_common_crossbreed_name():
    """Test common crossbreed name identification."""
    detector = CrossbreedDetector(config)

    name = detector.identify_common_name(["Golden Retriever", "Poodle"])
    assert name == "Goldendoodle"

    name = detector.identify_common_name(["Poodle", "Golden Retriever"])  # Reversed
    assert name == "Goldendoodle"

    name = detector.identify_common_name(["Husky", "Chihuahua"])  # Unknown
    assert name is None
```

### Test Script Updates

**File:** `./scripts/run-ai-tests.sh`

```bash
#!/bin/bash

set -e

if [ "$1" == "--unit" ]; then
    echo "Running AI Service unit tests..."
    docker compose run --rm ai-service python -m pytest tests/unit/ -v
elif [ "$1" == "--integration" ]; then
    echo "Running AI Service integration tests (requires Ollama + Classification Service)..."
    docker compose run --rm ai-service python -m pytest tests/integration/ -v --timeout=300
else
    echo "Running all AI Service tests..."
    docker compose run --rm ai-service python -m pytest tests/ -v
fi
```

**File:** `./scripts/run-classification-tests.sh` (new)

```bash
#!/bin/bash

set -e

echo "Running Classification Service tests..."
docker compose run --rm classification-service python -m pytest tests/ -v --timeout=300
```

### Estimated Test Count

**AI Service:**
- Unit tests: ~15 tests (orchestrator, client, models)
- Integration tests: ~10 tests (full pipeline scenarios)
- **Subtotal: ~25 tests**

**Classification Service:**
- Model tests: ~12 tests (NSFW, species, breed classifiers)
- Crossbreed logic: ~8 tests (threshold detection, name mapping)
- **Subtotal: ~20 tests**

**Total: ~45-50 tests** (down from current 90, but more focused and maintainable)

---

## Error Handling

### Classification Service Errors

**Connection Failures:**
```python
try:
    safety = await self.classification.check_content(image)
except httpx.ConnectError:
    raise ConnectionError("Classification service unavailable")
except httpx.TimeoutException:
    raise ConnectionError("Classification service timeout (30s exceeded)")
```

**Model Inference Failures:**
```python
# In classification service
try:
    predictions = model(image_tensor)
except Exception as e:
    logger.error(f"Model inference failed: {e}")
    raise HTTPException(
        status_code=500,
        detail={"code": "CLASSIFICATION_ERROR", "message": "Model inference failed"}
    )
```

### Standardized Error Codes

**422 Unprocessable Entity (Client Errors):**
- `CONTENT_POLICY_VIOLATION`: NSFW probability > threshold
- `UNSUPPORTED_SPECIES`: Species not dog/cat
- `SPECIES_DETECTION_FAILED`: Species confidence < threshold
- `BREED_DETECTION_FAILED`: Breed confidence < threshold
- `INVALID_IMAGE`: Image format/size validation failed

**503 Service Unavailable:**
- `CLASSIFICATION_SERVICE_UNAVAILABLE`: Classification service down/timeout
- `VISION_SERVICE_UNAVAILABLE`: Ollama connection failed

**500 Internal Server Error:**
- `INTERNAL_ERROR`: Unexpected errors
- `VISION_PROCESSING_ERROR`: Ollama response parsing failed

### Graceful Degradation

**RAG Failures:**
- Log warning but continue pipeline
- Return `enriched_info: null` in response
- Ollama still receives classification context
- User experience degraded but not broken

**Classification Service Partial Failures:**
- If content safety fails → abort (security critical)
- If species detection fails → abort (business requirement)
- If breed classification fails → abort (core feature)
- RAG enrichment failure → continue (nice-to-have)

---

## Performance Characteristics

### Pipeline Latency

**Expected Timings (per stage):**
1. Image processing (AI Service): ~10-20ms
2. Content safety (Classification): ~50-100ms
3. Species detection (Classification): ~100-150ms
4. Breed classification (Classification): ~150-250ms
5. RAG enrichment (AI Service): ~50-100ms
6. Ollama visual analysis (AI Service): ~2000-4000ms

**Total End-to-End: ~2.5-4.5 seconds**

**Bottleneck:** Ollama inference (80%+ of total time)

### Optimization Opportunities

**Future Improvements:**
1. **Batch Classification:** Process multiple images in parallel batches
2. **Model Quantization:** Use INT8 quantized ViT models (~40% faster, minimal accuracy loss)
3. **Caching:** Cache breed classification results by image hash (deduplication)
4. **Async RAG:** Query RAG in parallel with Ollama (save ~50-100ms)
5. **Smaller Ollama Model:** Test qwen2-vl:2b for faster inference (~1-2s instead of 2-4s)

**Not Recommended:**
- Running classification models on CPU (10x slower, ~2-5s per model)
- Removing crossbreed detection (accuracy loss)
- Skipping content safety (security risk)

---

## Migration Plan

### Phase 1: Classification Service Setup (Week 1)

**Tasks:**
1. Create `srcs/classification-service/` directory structure
2. Implement model wrappers (NSFW, species, breed classifiers)
3. Port crossbreed detection logic from `ollama_client.py`
4. Implement FastAPI endpoints (`/classify/content`, `/species`, `/breed`)
5. Write Dockerfile and requirements.txt
6. Add to docker-compose.yml with GPU support
7. Test service in isolation (unit tests)

**Deliverables:**
- Working classification-service container
- Health endpoint responding
- Models loading successfully on GPU
- ~20 passing tests

### Phase 2: AI Service Integration (Week 2)

**Tasks:**
1. Create `VisionOrchestrator` class
2. Create `ClassificationClient` HTTP client
3. Implement RAG service enhancements (`get_breed_context`, `get_crossbreed_context`)
4. Implement `OllamaVisionClient.analyze_with_context()`
5. Update response models (Pydantic)
6. Update vision route to use orchestrator
7. Write unit tests with mocked dependencies

**Deliverables:**
- Orchestrated pipeline functional
- ~15 passing unit tests
- Old `analyze_breed()` marked deprecated

### Phase 3: Testing & Validation (Week 3)

**Tasks:**
1. Rebuild AI service integration tests from scratch
2. Test full pipeline with real images (dog, cat, crossbreed)
3. Test rejection scenarios (NSFW, wrong species, low confidence)
4. Load testing (concurrent requests, GPU memory usage)
5. Validate crossbreed detection accuracy
6. Document API changes

**Deliverables:**
- ~25 passing integration tests
- Performance benchmarks documented
- API documentation updated

### Phase 4: Deployment & Monitoring (Week 4)

**Tasks:**
1. Update frontend to handle new response format
2. Deploy to staging environment
3. Run E2E tests through full stack
4. Monitor GPU memory usage, latency, error rates
5. Tune thresholds based on real-world data
6. Create runbook for troubleshooting

**Deliverables:**
- Production-ready system
- Monitoring dashboards
- Troubleshooting documentation

---

## Success Criteria

### Functional Requirements

✅ **Content Safety:** NSFW images rejected before reaching Ollama
✅ **Species Validation:** Only dog/cat images processed
✅ **Breed Classification:** Top-5 predictions with crossbreed detection
✅ **RAG Enrichment:** Breed knowledge retrieved from ChromaDB
✅ **Contextual Analysis:** Ollama receives full context (species, breed, RAG)
✅ **Graceful Degradation:** RAG failures don't break pipeline

### Performance Requirements

✅ **Latency:** < 5 seconds end-to-end (95th percentile)
✅ **GPU Memory:** < 10GB VRAM total (Ollama + classification models)
✅ **Throughput:** Handle 10 concurrent requests without OOM
✅ **Startup Time:** Classification service ready in < 90 seconds

### Quality Requirements

✅ **Purebred Accuracy:** > 85% top-1 accuracy on purebred test set
✅ **Crossbreed Detection:** > 75% recall on known crossbreeds (Goldendoodle, Labradoodle, etc.)
✅ **False Positive Rate (NSFW):** < 5% (prefer false negatives over false positives)
✅ **Test Coverage:** > 80% line coverage in AI service, > 70% in classification service

---

## Risks & Mitigations

### Risk: GPU Memory Exhaustion

**Scenario:** Concurrent requests cause OOM on 10GB GPU

**Mitigation:**
- Implement request queuing in classification service (max 2 concurrent inferences)
- Monitor GPU memory usage with Prometheus
- Auto-restart service on OOM (Docker restart policy)
- Scale horizontally with second GPU if needed

### Risk: Model Download Failures

**Scenario:** HuggingFace hub unavailable during first startup

**Mitigation:**
- Pre-download models in Dockerfile (optional build step)
- Use cached volume `huggingface-cache` for persistence
- Implement retry logic with exponential backoff
- Provide manual download script for offline environments

### Risk: Ollama Still Gets Confused

**Scenario:** Even with context, Ollama provides inaccurate descriptions

**Mitigation:**
- Tune prompt templates based on empirical testing
- Add few-shot examples to prompt
- Consider switching to smaller, faster model (qwen2-vl:2b) if accuracy sufficient
- Implement user feedback loop to identify problem cases

### Risk: Crossbreed Detection Too Aggressive

**Scenario:** Purebreds with unusual features flagged as crossbreeds

**Mitigation:**
- Make thresholds configurable via environment variables
- A/B test different threshold values
- Provide confidence reasoning in response (transparency)
- Allow manual override in frontend (user can correct)

---

## Future Enhancements

### Short-Term (Next 3 Months)

1. **Batch Processing API:** Upload multiple images, get batch results
2. **Image Quality Scoring:** Reject blurry/low-res images before classification
3. **Caching Layer:** Cache breed classification by image perceptual hash
4. **Model Versioning:** Support A/B testing different ViT models

### Long-Term (6+ Months)

1. **Custom Fine-Tuning:** Fine-tune ViT models on user-submitted labeled data
2. **Multi-Pet Detection:** Detect and classify multiple pets in single image
3. **Age Estimation Model:** Dedicated model for age prediction (puppy/adult/senior)
4. **Health Screening:** Fine-tune on veterinary image dataset for health issues
5. **Video Analysis:** Extend pipeline to analyze pet videos (behavior analysis)

---

## Appendix

### Model References

- **NSFW Detection:** [Falconsai/nsfw_image_detection](https://huggingface.co/Falconsai/nsfw_image_detection)
- **Species Classification:** [dima806/animal_151_types_image_detection](https://huggingface.co/dima806/animal_151_types_image_detection)
- **Dog Breed Classification:** [wesleyacheng/dog-breeds-multiclass-image-classification-with-vit](https://huggingface.co/wesleyacheng/dog-breeds-multiclass-image-classification-with-vit)
- **Cat Breed Classification:** [dima806/cat_breed_image_detection](https://huggingface.co/dima806/cat_breed_image_detection)

### Related Documentation

- **AI Service Overview:** `srcs/ai/CLAUDE.md`
- **RAG Design:** `docs/plans/2026-01-25-ai-service-rag-design.md`
- **RAG Implementation:** `docs/plans/2026-01-25-ai-service-rag-implementation.md`
- **Architecture Guide:** `ARCHITECTURE.md`

### Threshold Configuration Reference

```bash
# Classification Service (.env)
NSFW_REJECTION_THRESHOLD=0.70           # Reject if NSFW prob > 70%
SPECIES_MIN_CONFIDENCE=0.60             # Reject if species conf < 60%
BREED_MIN_CONFIDENCE=0.40               # Reject if breed conf < 40%

# Crossbreed Detection
CROSSBREED_PROBABILITY_THRESHOLD=0.35   # 2nd breed > 35% → crossbreed
PUREBRED_CONFIDENCE_THRESHOLD=0.75      # Top breed < 75% → check gap
PUREBRED_GAP_THRESHOLD=0.30             # Gap < 30% → crossbreed
```

---

**End of Design Document**
