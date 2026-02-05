# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

FastAPI microservice for image classification using HuggingFace Transformers. Provides NSFW detection, species identification, and breed classification with crossbreed detection.

**Port:** 3004 (internal, called by AI Service)

**GPU Support:** RTX 5060 Ti (Blackwell) via PyTorch 2.11 nightly + CUDA 12.8

## Commands

### Testing

```bash
# All tests (28 total)
docker compose run --rm classification-service python -m pytest tests/ -v

# Specific test file
docker compose run --rm classification-service python -m pytest tests/test_crossbreed_detector.py -v

# Single test
docker compose run --rm classification-service python -m pytest tests/test_breed_classifier.py::test_function_name -v

# With coverage
docker compose run --rm classification-service python -m pytest tests/ --cov=src --cov-report=html
```

### GPU Verification

```bash
# Check GPU detection
docker exec ft_transcendence_classification_service python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"

# Check device setting
docker exec ft_transcendence_classification_service python -c "from src.config import settings; print(settings.DEVICE)"
```

### Docker Operations

```bash
# From project root
make build                         # Rebuild images
make up                            # Start services
make logs-classification-service   # View logs
make exec-classification-service   # Shell into container
```

## Architecture

### Project Structure

```
src/
  main.py                    # FastAPI app, lifespan (model loading)
  config.py                  # Pydantic Settings, thresholds
  routes/
    classify.py              # POST /classify endpoint
  models/
    nsfw_detector.py         # NSFW content safety filter
    species_classifier.py    # Dog/Cat/Other identification
    breed_classifier.py      # 120 dog breeds, 70 cat breeds
  services/
    crossbreed_detector.py   # Multi-rule heuristic for mixed breeds
    image_utils.py           # Base64 decode, PIL processing
tests/                       # 28 tests
```

### Classification Pipeline

```
1. Image received (base64)
       ↓
2. NSFW Detection
   - Reject if unsafe content detected (threshold: 0.70)
       ↓
3. Species Classification
   - Identify: dog, cat, or other
   - Reject if below min confidence (threshold: 0.60)
       ↓
4. Breed Classification
   - Dog: 120 breeds (Stanford Dogs dataset)
   - Cat: 70 breeds
       ↓
5. Crossbreed Detection
   - Check probability distribution
   - Flag as crossbreed if criteria met
       ↓
6. Return classification result
```

### HuggingFace Models

| Model | Purpose | Source |
|-------|---------|--------|
| `Falconsai/nsfw_image_detection` | NSFW safety filter | HuggingFace |
| `dima806/animal_151_types_image_detection` | Species classification | HuggingFace |
| `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit` | Dog breeds (120) | HuggingFace |
| `dima806/cat_breed_image_detection` | Cat breeds (70) | HuggingFace |

### Threshold Configuration (config.py)

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `NSFW_REJECTION_THRESHOLD` | 0.70 | Reject if NSFW score above |
| `SPECIES_MIN_CONFIDENCE` | 0.60 | Reject if species confidence below |
| `BREED_MIN_CONFIDENCE` | 0.40 | Warn if breed confidence below |
| `CROSSBREED_PROBABILITY_THRESHOLD` | 0.35 | Max top breed for crossbreed flag |
| `PUREBRED_CONFIDENCE_THRESHOLD` | 0.75 | Min confidence for purebred |
| `PUREBRED_GAP_THRESHOLD` | 0.30 | Min gap between top 2 for purebred |
| `CROSSBREED_MIN_SECOND_BREED` | 0.05 | Min second breed for crossbreed |

### API Endpoint

**Internal** (called by AI Service):
```
POST /classify
Content-Type: application/json

{
  "image": "<base64-encoded-image>"
}
```

**Response:**
```json
{
  "is_nsfw": false,
  "species": "dog",
  "species_confidence": 0.95,
  "breed": "golden_retriever",
  "breed_confidence": 0.78,
  "is_crossbreed": false,
  "top_breeds": [
    {"breed": "golden_retriever", "confidence": 0.78},
    {"breed": "labrador_retriever", "confidence": 0.12}
  ]
}
```

## Testing Patterns

**Lifespan bypass:** Tests create app WITHOUT lifespan to avoid loading real models. See `conftest.py` for pattern.

**Model mocking:**
```python
@pytest.fixture
def mock_nsfw_detector():
    with patch('src.routes.classify.nsfw_detector') as mock:
        mock.detect.return_value = {"is_nsfw": False, "confidence": 0.1}
        yield mock
```

**Image fixtures:** Use small base64 test images, not real photos.

## Common Gotchas

**PyTorch nightly:** Using 2.11.0.dev20260128+cu128 for RTX 5060 Ti support. Pin specific nightly build to avoid breaking changes.

**Model loading:** Models load during app lifespan startup. First request may be slow if models not cached.

**Crossbreed behavior:** Dog breed classifier trained on purebreds only. Crossbreeds naturally have low confidence (5-10%) - this is expected, not a bug.

**GPU fallback:** If `DEVICE=auto` and no GPU available, falls back to CPU automatically.

## PyTorch Configuration

```
# requirements.txt
--extra-index-url https://download.pytorch.org/whl/nightly/cu128
torch==2.11.0.dev20260128+cu128
torchvision==0.25.0.dev20260128+cu128
```

**CUDA Runtime:** 12.8 (specified in Dockerfile)

## Current State

**Status:** 28 passing tests
