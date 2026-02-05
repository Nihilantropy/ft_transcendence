# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

FastAPI microservice that orchestrates multi-stage vision analysis for pet breed identification and health insights. Coordinates between Classification Service (HuggingFace models), RAG system (ChromaDB), and Ollama (qwen3-vl:8b LLM).

**Port:** 3003 (internal, accessed via API Gateway)

**Volume mount:** Full source (`./srcs/ai:/app`) for development.

## Commands

### Testing

```bash
# All tests (47 total)
docker compose run --rm ai-service python -m pytest tests/ -v

# Specific test file
docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py -v

# Single test
docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py::test_function_name -v

# With coverage
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=html
```

### RAG Initialization

ChromaDB starts empty. Initialize the knowledge base:

```bash
# From inside container (localhost-only endpoint)
docker exec ft_transcendence_ai_service curl -X POST http://localhost:3003/api/v1/admin/rag/initialize

# Or via shell
docker exec -it ft_transcendence_ai_service sh
curl -X POST http://localhost:3003/api/v1/admin/rag/initialize
```

### Docker Operations

```bash
# From project root
make build              # Rebuild images
make up                 # Start services
make logs-ai-service    # View logs
make exec-ai-service    # Shell into container
```

## Architecture

### Project Structure

```
src/
  main.py                         # FastAPI app, lifespan
  config.py                       # Pydantic Settings, thresholds
  routes/
    vision.py                     # POST /api/v1/vision/analyze
    rag.py                        # RAG admin endpoints (localhost-only)
  services/
    vision_orchestrator.py        # 3-stage pipeline coordinator
    classification_client.py      # HTTP client → Classification Service
    rag_service.py                # ChromaDB query/retrieval
    ollama_client.py              # Ollama HTTP API for contextual analysis
    image_processor.py            # Base64 decode, resize, validation
    document_processor.py         # Markdown chunking for RAG ingestion
    embedder.py                   # sentence-transformers embeddings
  models/
    requests.py                   # ImageAnalysisRequest schema
    responses.py                  # VisionAnalysisResponse, ClassificationResult
  middleware/
    localhost.py                  # Localhost-only access control
  utils/
    responses.py                  # success_response / error_response helpers
    logger.py                     # Structured logging
data/
  chroma/                         # ChromaDB persistence (volume mounted)
  knowledge_base/                 # Markdown docs for RAG ingestion
    spiecies/                     # Species-level info (dogs.md, cats.md)
tests/                            # 47 tests
```

### Vision Pipeline Flow

```
1. Image received (base64)
       ↓
2. Classification Service
   - NSFW check (reject unsafe)
   - Species identification (dog/cat)
   - Breed classification (purebred or crossbreed)
       ↓
3. RAG Service
   - Query ChromaDB with species + breed
   - Retrieve health info, breed standards
       ↓
4. Ollama (qwen3-vl:8b)
   - Image + classification + RAG context
   - Generate contextual analysis
       ↓
5. Return enriched response
```

### Rejection Thresholds (config.py)

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `SPECIES_MIN_CONFIDENCE` | 0.10 | Reject if species confidence below |
| `BREED_MIN_CONFIDENCE` | 0.05 | Reject if breed confidence below (low for crossbreeds) |
| `LOW_CONFIDENCE_THRESHOLD` | 0.50 | General low confidence warning |

### API Endpoints

**Public (via API Gateway):**
- `POST /api/v1/vision/analyze` - Image analysis pipeline

**Internal (localhost-only):**
- `POST /api/v1/admin/rag/initialize` - Bulk ingest knowledge base
- `GET /api/v1/admin/rag/stats` - ChromaDB collection stats
- `POST /api/v1/admin/rag/query` - Test RAG queries

## Testing Patterns

**Mocking external services:**
- Classification Service: `AsyncMock` for `ClassificationClient.classify()`
- Ollama: `AsyncMock` for `OllamaClient.generate_analysis()`
- RAG: `MagicMock` for `RAGService.query()`

**Defensive mocking:** Always mock ALL async methods in execution path, even when expecting early rejection. Prevents breakage if thresholds change.

**Example:**
```python
@pytest.fixture
def mock_classification_client():
    with patch('src.services.vision_orchestrator.ClassificationClient') as mock:
        client = AsyncMock()
        mock.return_value = client
        yield client
```

## Common Gotchas

**RAG embedder method:** ChromaDB embedder uses `embed()` method, NOT `embed_text()`.

**Ollama parameter names:** `OllamaClient.generate_analysis()` expects `image_base64`, NOT `image`.

**Threshold confusion:** Test comments may reference outdated thresholds - always trust config.py values.

**Crossbreed confidence:** Crossbreeds naturally have low confidence (5-10%) vs purebreds (20-30%+). This is expected behavior.

## Key Dependencies

- **Classification Service** (port 3004): HuggingFace model inference
- **Ollama** (port 11434): qwen3-vl:8b multimodal LLM
- **ChromaDB**: Vector store for RAG (sentence-transformers embeddings)

## Current State

**Status:** 47 passing tests
