# AI Service CLAUDE.md

## Service Overview

FastAPI service for pet breed identification (vision) and knowledge retrieval (RAG).

**Architecture:**
- Vision: Direct Ollama HTTP API (NOT LlamaIndex - doesn't support Ollama multimodal)
- RAG: ChromaDB (embedded) + sentence-transformers (all-MiniLM-L6-v2, 384 dims)
- Model: qwen3-vl:8b for both vision and text generation

## Key Commands

```bash
# Run tests
./scripts/run-ai-tests.sh --unit         # Fast unit tests (~14s)
./scripts/run-ai-tests.sh --integration  # Requires Ollama (~2.5min)
docker compose run --rm ai-service python -m pytest tests/ -v

# Rebuild after requirements.txt changes
docker compose build ai-service
```

## Code Patterns

**Service Injection:** Services are injected into routes at startup via `main.py` lifespan
```python
# In routes/vision.py
ollama_client: OllamaVisionClient = None  # Injected at startup

# In main.py lifespan
vision.ollama_client = ollama_client
```

**Response Format:** Use `utils/responses.py` helpers
```python
return success_response(data.model_dump())  # NOT Response(success_response(...))
```

**Pydantic V2:** Use `model_dump()` not `dict()`, use `@field_validator` not `@validator`

## File Structure

```
src/
├── config.py           # Pydantic Settings (env vars)
├── main.py             # FastAPI app + lifespan
├── services/           # Business logic (ollama_client, embedder, rag_service)
├── routes/             # API endpoints (vision, rag)
├── models/             # Request/response Pydantic models
└── utils/              # Helpers (responses, logger)
```

## Design Docs

- RAG Design: `docs/plans/2026-01-25-ai-service-rag-design.md`
- RAG Implementation: `docs/plans/2026-01-25-ai-service-rag-implementation.md`
