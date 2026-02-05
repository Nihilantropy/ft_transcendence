# AI Service

Vision analysis microservice for the SmartBreeds platform. Orchestrates pet breed identification and health insights through a multi-stage pipeline.

## Features

- **Multi-stage vision pipeline**: Classification → RAG → LLM analysis
- **Breed identification**: Supports 120 dog breeds and 70 cat breeds
- **Crossbreed detection**: Intelligent thresholding for mixed breed identification
- **RAG enrichment**: ChromaDB-backed knowledge retrieval for breed-specific health information
- **Contextual analysis**: Ollama (qwen3-vl:8b) generates natural language insights

## Technology Stack

- **Framework**: FastAPI
- **Vector Store**: ChromaDB with sentence-transformers embeddings
- **LLM**: Ollama (qwen3-vl:8b multimodal model)
- **Classification**: Delegates to Classification Service (HuggingFace models)

## Quick Start

```bash
# Start services
make up

# Initialize RAG knowledge base (required once)
docker exec ft_transcendence_ai_service curl -X POST http://localhost:3003/api/v1/admin/rag/initialize

# Run tests
docker compose run --rm ai-service python -m pytest tests/ -v
```

## API

**Public endpoint** (via API Gateway):
```
POST /api/v1/vision/analyze
Content-Type: application/json

{
  "image": "<base64-encoded-image>"
}
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance.
