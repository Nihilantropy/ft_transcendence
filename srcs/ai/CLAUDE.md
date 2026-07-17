# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

FastAPI microservice that orchestrates multi-stage vision analysis for pet breed identification and health insights. Coordinates between the Classification Service (HuggingFace models, optional), the RAG system (ChromaDB), and an LLM reached through the **LiteLLM proxy** (OpenAI-compatible).

**Port:** 3003 (internal, accessed via API Gateway)

**LLM access:** The service never talks to Ollama directly. It POSTs OpenAI
chat-completions to the LiteLLM proxy (`LLM_BASE_URL`, default `http://litellm:4000/v1`),
which routes to a local model (Ollama `qwen3-vl:8b`) or a hosted provider (Mistral)
based on the model alias in `.env` — no code change to switch. See `srcs/litellm/config.yaml`.

**Two pipelines (via `CLASSIFICATION_ENABLED`):**
- `true` (default, `local` compose profile): full pipeline — Classification Service does
  NSFW + species + breed, then RAG + LLM enrich.
- `false` (`cloud` profile, no GPU): VLM-only — the vision LLM (e.g. Mistral) does
  species/breed detection itself. **The dedicated NSFW safety filter is NOT applied**
  in this mode; moderation is delegated to the LLM provider.

**Volume mount:** Full source (`./srcs/ai:/app`) for development.

## Commands

### Testing

```bash
# All tests (104 total)
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
# Preferred: use the Makefile rule from project root
make rag

# Direct (from inside container — localhost-only endpoint)
docker exec ft_transcendence_ai_service curl -X POST http://localhost:3003/api/v1/admin/rag/initialize
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
    vision_orchestrator.py        # pipeline coordinator (full + VLM-only paths)
    classification_client.py      # HTTP client → Classification Service
    rag_service.py                # ChromaDB query/retrieval
    ollama_client.py              # LLM client — OpenAI chat-completions → LiteLLM proxy
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

Full pipeline (`CLASSIFICATION_ENABLED=true`):

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
4. LLM via LiteLLM proxy (local Ollama qwen3-vl:8b OR cloud Mistral)
   - Image + classification + RAG context
   - Generate contextual analysis
       ↓
5. Return enriched response
```

VLM-only pipeline (`CLASSIFICATION_ENABLED=false`, `_analyze_vlm_only`): step 2 is
skipped (no NSFW filter); the vision LLM performs species/breed/crossbreed detection,
then RAG (step 3, graceful degradation if empty) and the contextual LLM call (step 4) run.

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

- **LiteLLM proxy** (port 4000): OpenAI-compatible gateway; the only LLM endpoint this
  service calls. Routes to Ollama (local) or Mistral (cloud). Config: `srcs/litellm/config.yaml`.
- **Classification Service** (port 3004, `local` profile only): HuggingFace model inference.
  Skipped when `CLASSIFICATION_ENABLED=false`.
- **Ollama** (port 11434, `local` profile only): qwen3-vl:8b multimodal LLM, behind LiteLLM.
- **ChromaDB**: Vector store for RAG (sentence-transformers embeddings)

### LLM Configuration (config.py / .env)

| Var | Default | Purpose |
|-----|---------|---------|
| `LLM_BASE_URL` | `http://litellm:4000/v1` | LiteLLM proxy endpoint |
| `LLM_API_KEY` | `sk-smartbreeds-local` | Must match LiteLLM `LITELLM_MASTER_KEY` |
| `LLM_VISION_MODEL` | `vision-model` | Alias: `vision-model` (Ollama) or `vision-model-cloud` (Mistral) |
| `LLM_TEXT_MODEL` | `text-model` | Alias: `text-model` (Ollama) or `text-model-cloud` (Mistral) |
| `CLASSIFICATION_ENABLED` | `true` | `false` → VLM-only pipeline (must be `false` in the `cloud` profile) |

**Gotcha:** In the `cloud` profile the classification-service does not run, so
`CLASSIFICATION_ENABLED` **must** be `false` there, otherwise the orchestrator calls a
dead host and returns 503.

## Current State

**Status:** 104 passing tests (86% coverage)
- New test files: `test_image_processor.py`, `test_embedder.py`, `test_ollama_client.py`
- pytest-cov not in requirements — install temporarily: `docker exec ft_transcendence_ai_service pip install pytest-cov`
