# AI Service

FastAPI microservice that turns a base64 pet photo into a structured breed analysis. It owns the
vision pipeline: it validates and normalises the image, obtains a species/breed classification,
retrieves grounding facts from a local ChromaDB knowledge base (RAG), and asks a vision LLM —
reached through the LiteLLM OpenAI-compatible proxy — to describe the individual animal in the
picture. It is stateless with respect to PostgreSQL; the only thing it persists is the ChromaDB
vector collection.

## Responsibilities

- Decode, validate, resize and re-encode uploaded images (`src/services/image_processor.py`).
- Orchestrate the multi-stage analysis with early rejection (`src/services/vision_orchestrator.py`).
- Call the Classification Service for NSFW / species / breed when it is enabled
  (`src/services/classification_client.py`).
- Call the LLM through LiteLLM using OpenAI `chat/completions` — vision and text models
  (`src/services/ollama_client.py`).
- Own the RAG stack: markdown chunking, sentence-transformers embeddings, ChromaDB collection,
  breed/crossbreed context retrieval (`src/services/document_processor.py`, `embedder.py`,
  `rag_service.py`).
- Expose a localhost-restricted admin endpoint that bulk-ingests the bundled knowledge base.

It does **not** do: authentication (the API Gateway validates the JWT), rate limiting, persistence
of analysis results (the user-service owns pet analysis history), or HuggingFace model inference
(that is the Classification Service).

## Architecture

```
Browser ──▶ Nginx ──▶ API Gateway ──▶ ai-service:3003 ──┬─▶ classification-service:3004   (local profile only)
                     (JWT, 300s timeout)                ├─▶ litellm:4000/v1  ─▶ ollama:11434 (local) | Mistral (cloud)
                                                        └─▶ ChromaDB (embedded, on-disk volume)
```

| Fact | Value | Source |
|------|-------|--------|
| Container | `ft_transcendence_ai_service` | docker-compose.yml:83 |
| Port | 3003, **no host port mapping** — internal only | docker-compose.yml:79-99 |
| Network | `backend-network` only | docker-compose.yml:86-87 |
| Compose profile | none declared → runs in **both** `local` and `cloud` | docker-compose.yml:79 |
| `depends_on` | none — the service starts even if LiteLLM/classification are down | docker-compose.yml:79-99 |
| Healthcheck | `curl -f http://localhost:3003/health`, 30s interval, 60s start period | docker-compose.yml:94-99 |

The API Gateway maps prefix `/api/v1/vision` to `AI_SERVICE_URL` and preserves the path
(`srcs/api-gateway/routes/proxy.py:44`, `:105`). It applies a 300s timeout for that prefix
(`SERVICE_TIMEOUTS`, `srcs/api-gateway/routes/proxy.py:16-18`) instead of the 30s default, because
LLM inference is slow. `/api/v1/rag` and `/api/v1/admin/rag` are deliberately **not** in
`SERVICE_ROUTES`, so they are unreachable from outside the Docker network.

### Two pipelines

Selected by `CLASSIFICATION_ENABLED` (`src/config.py:22`), branch at
`src/services/vision_orchestrator.py:57`.

| | Full pipeline (`true`) | VLM-only pipeline (`false`) |
|---|---|---|
| Intended profile | `local` (GPU) | `cloud` (no GPU) |
| NSFW safety filter | Classification Service, hard reject | **none** |
| Species detection | Classification Service | vision LLM |
| Breed / crossbreed | Classification Service | vision LLM (`analyze_breed`, top 2 breeds) |
| RAG enrichment | yes, failures degrade gracefully | yes, failures degrade gracefully |
| Final description | vision LLM `analyze_with_context` | vision LLM `analyze_with_context` |
| Rejection codes | `CONTENT_POLICY_VIOLATION`, `UNSUPPORTED_SPECIES`, `SPECIES_DETECTION_FAILED`, `BREED_DETECTION_FAILED` | `BREED_DETECTION_FAILED` only |

**Safety implication:** in VLM-only mode there is no dedicated NSFW classifier and no species
allow-list. Any image that the LLM is willing to answer about is accepted, and content moderation
is entirely delegated to the LLM provider. `_analyze_vlm_only` logs a warning on every request
(`src/services/vision_orchestrator.py:145-148`).

In the `cloud` profile the `classification-service` container does not exist
(`profiles: ["local"]`, docker-compose.yml:106). Leaving `CLASSIFICATION_ENABLED=true` there makes
the orchestrator call a dead hostname; `httpx.ConnectError` becomes `ConnectionError` and the route
returns 503.

### Full-pipeline stage order

1. `ImageProcessor.process_image` — data-URI parse, size/dimension checks, resize, re-encode.
2. `classification.check_content` → reject if `is_safe` is false.
3. `classification.detect_species` → reject if species ∉ {dog, cat} or confidence < `SPECIES_MIN_CONFIDENCE`.
4. `classification.detect_breed(top_k=5)` → reject if confidence < `BREED_MIN_CONFIDENCE`.
5. `rag.get_breed_context(primary_breed)` or `rag.get_crossbreed_context(detected_breeds)` —
   wrapped in `try/except Exception`, so any RAG failure yields `enriched_info: null` rather than
   an error.
6. `ollama.analyze_with_context(image, species, breed_analysis, rag_context)` — the vision LLM
   describes the individual animal; the classification result and RAG facts are injected into the
   prompt.

## API Reference

All paths are absolute (router prefix + decorator path). No trailing slashes.

| Method | Path | Reachable from | Purpose |
|--------|------|----------------|---------|
| POST | `/api/v1/vision/analyze` | API Gateway (JWT required at the gateway) | Full image analysis |
| GET | `/api/v1/vision/health` | API Gateway (JWT required — it matches the `/api/v1/vision` prefix) | Vision router liveness |
| GET | `/health` | inside the container / compose healthcheck | Service health + active LLM config |
| POST | `/api/v1/rag/query` | inside the Docker network only | RAG question answering |
| POST | `/api/v1/rag/ingest` | inside the Docker network only | Ingest one document |
| GET | `/api/v1/rag/status` | inside the Docker network only | Collection stats |
| POST | `/api/v1/admin/rag/initialize` | localhost / `172.*` only | Bulk-ingest `data/knowledge_base` |
| GET | `/docs`, `/openapi.json` | inside the Docker network | FastAPI defaults (not disabled) |

The AI Service performs **no** authentication of its own. It ignores the `X-User-ID` /
`X-User-Role` headers the gateway injects. Its security boundary is network isolation.

### POST /api/v1/vision/analyze

Request (`src/routes/vision.py:14-16`):

```json
{ "image": "data:image/jpeg;base64,/9j/4AAQ..." }
```

`image` is the only field and it is required. `ImageProcessor` requires a real data URI
(`data:image/<fmt>;base64,<payload>`); a bare base64 string is rejected. Accepted formats:
`jpeg`, `jpg`, `png`, `webp`.

Success (200):

```json
{
  "success": true,
  "data": {
    "species": "dog",
    "breed_analysis": {
      "primary_breed": "golden_retriever",
      "confidence": 0.89,
      "is_likely_crossbreed": false,
      "breed_probabilities": [{ "breed": "golden_retriever", "probability": 0.89 }],
      "crossbreed_analysis": null
    },
    "description": "This Golden Retriever appears ...",
    "traits": { "size": "large", "energy_level": "medium", "temperament": "friendly" },
    "health_observations": ["Coat appears healthy"],
    "enriched_info": {
      "breed": "Golden Retriever",
      "parent_breeds": null,
      "description": "...",
      "care_summary": "...",
      "health_info": "...",
      "sources": ["spiecies/dogs/purebreeds/golden_retriever.md"]
    }
  },
  "error": null,
  "timestamp": "2026-08-10T12:00:00.000000"
}
```

For a crossbreed, `crossbreed_analysis` is `{detected_breeds, common_name, confidence_reasoning}`
and `enriched_info.breed` is `null` while `enriched_info.parent_breeds` is populated.
`enriched_info` is `null` whenever RAG retrieval raised.

Errors (`src/routes/vision.py:56-113`) — the body is wrapped by FastAPI in a `detail` object:

| Status | `error.code` | Trigger |
|--------|--------------|---------|
| 422 | `CONTENT_POLICY_VIOLATION` | NSFW check failed (full pipeline only) |
| 422 | `UNSUPPORTED_SPECIES` | species not dog/cat |
| 422 | `SPECIES_DETECTION_FAILED` | species confidence < `SPECIES_MIN_CONFIDENCE` |
| 422 | `BREED_DETECTION_FAILED` | breed confidence < `BREED_MIN_CONFIDENCE` |
| 422 | raw exception message, e.g. `Image exceeds 5MB limit` | any `ValueError` from `ImageProcessor` — see Troubleshooting |
| 503 | `VISION_SERVICE_UNAVAILABLE` | `ConnectionError`: classification or LLM unreachable / timed out |
| 500 | `INTERNAL_ERROR` | anything else (unparsable LLM JSON, missing key in LLM output, corrupt image bytes) |

Request-shape violations (missing `image`) are handled by FastAPI itself and return the standard
pydantic 422 payload, not the shape above.

### POST /api/v1/rag/query

```json
{ "question": "What health issues affect Golden Retrievers?",
  "filters": { "species": "dog" },
  "top_k": 5 }
```

`question` min length 1 and stripped; `top_k` is `1..20`, default 5 (`src/models/requests.py:26-37`).
Returns `success_response({answer, sources[{content, source_file, relevance_score}], model})`.
`model` echoes `LLM_TEXT_MODEL`. `relevance_score` is `max(0, 1 - chroma_distance)` rounded to 3
decimals (`src/services/rag_service.py:117`). Errors: 503 `RAG_SERVICE_UNAVAILABLE` on
`ConnectionError`, 500 `INTERNAL_ERROR` otherwise.

### POST /api/v1/rag/ingest

```json
{ "content": "# Beagle\n...", "metadata": { "breed": "beagle" }, "source_name": "beagle.md" }
```

Chunks the content and adds it to the collection. Returns
`{chunks_created, document_id}` where `document_id` is `source_name` with `/` and `.` replaced by
`_`. 422 `INVALID_DOCUMENT` on `ValueError` (e.g. whitespace-only content — a truly empty `content`
is rejected earlier by the pydantic `min_length=1`), 500 `INTERNAL_ERROR` otherwise.

### GET /api/v1/rag/status

Returns `{collection_name, document_count, embedding_model}`.

### POST /api/v1/admin/rag/initialize

No body. Guarded by `require_localhost` (`src/middleware/localhost.py`), which accepts
`127.0.0.1`, `localhost`, `::1` **and any client IP starting with `172.`** — i.e. any container on
the Docker bridge network, not strictly the loopback. Walks `KNOWLEDGE_BASE_DIR` recursively with
`rglob("*.md")`, processes each file, and adds the chunks. Per-file failures are collected instead
of aborting.

Returns `{files_processed, total_chunks_created, files_skipped, errors[]}`.
403 `FORBIDDEN` from a non-allowed IP, 404 `DIRECTORY_NOT_FOUND` if the directory is missing,
503 `SERVICE_UNAVAILABLE` if the RAG singletons were never injected, 500 `INTERNAL_ERROR` otherwise.

### GET /health

```json
{ "status": "healthy", "service": "ai-service", "llm_url": "...", "vision_model": "...",
  "text_model": "...", "classification_enabled": true }
```

Static — it does not probe LiteLLM, ChromaDB or the Classification Service.

## Data Model

No relational tables, no migrations, no PostgreSQL connection. The single persisted structure is
the ChromaDB collection.

| Aspect | Value |
|--------|-------|
| Store | `chromadb.PersistentClient` (embedded, no server), `src/services/rag_service.py:46` |
| Path | `CHROMA_PERSIST_DIR` (default `./data/chroma` → `/app/data/chroma`) |
| Volume | named volume `ai-chroma-data` (docker-compose.yml:92, :363) |
| Collection | `CHROMA_COLLECTION_NAME`, default `pet_knowledge`, `get_or_create_collection` |
| Embeddings | `all-MiniLM-L6-v2` via sentence-transformers, 384 dims |
| Chunk ID | `f"chunk_{i}_{hash(content) % 10000}"` (`rag_service.py:180`) |
| Chunk metadata | frontmatter keys + `source_file` (path relative to the KB root) + `source_type` + `chunk_index` |

Metadata is sanitised for ChromaDB before storage: lists become comma-separated strings, other
non-primitive types are dropped with a warning (`src/services/document_processor.py:38-61`).

### Knowledge base

34 markdown files ship with the service under `data/knowledge_base/`. The top-level directory is
literally spelled **`spiecies`** (sic) — it is referenced by path in the mount and in
`KNOWLEDGE_BASE_DIR` walks, so do not "fix" the spelling without changing everything that points
at it.

```
data/knowledge_base/spiecies/
├── dogs/{purebreeds(10), crossbreeds(3), health(4)}
└── cats/{purebreeds(10), crossbreeds(3), health(4)}
```

Each file starts with YAML frontmatter, e.g.
`doc_type: breed`, `species: dog`, `breed: golden_retriever`, `topics: [health, temperament, ...]`.
The directory is mounted read-only into the container (docker-compose.yml:91), so edits on the host
are visible immediately, but they only reach ChromaDB after a re-ingest.

Chunking: frontmatter is stripped, the body is split on `#`/`##`/`###` headers, then each section is
token-chunked with `tiktoken` `cl100k_base` at `CHUNK_SIZE` tokens with `CHUNK_OVERLAP` overlap.

## Configuration

Read by `src/config.py` (pydantic-settings, `case_sensitive = False`, `env_file = ".env"`). The
container also receives `srcs/ai/.env` through compose `env_file`. `.env` is gitignored — copy
`.env.example` before the first run.

| Variable | Code default (`src/config.py`) | In `.env.example` | Purpose |
|----------|-------------------------------|-------------------|---------|
| `SERVICE_NAME` | `ai-service` (:8) | yes | Log/health identity |
| `DEBUG` | `False` (:9) | yes | Declared but never read by the code |
| `LOG_LEVEL` | `info` (:10) | yes | Root logger level |
| `LLM_BASE_URL` | `http://litellm:4000/v1` (:13) | yes | LiteLLM OpenAI-compatible base |
| `LLM_API_KEY` | `sk-smartbreeds-local` (:14) | yes | Sent as `Authorization: Bearer`; must equal `LITELLM_MASTER_KEY` |
| `LLM_VISION_MODEL` | `vision-model` (:15) | yes | LiteLLM alias for the multimodal model |
| `LLM_TEXT_MODEL` | `text-model` (:16) | yes | LiteLLM alias for text generation (RAG answers) |
| `LLM_TIMEOUT` | `300` (:17) | yes | httpx connect + read timeout, seconds |
| `LLM_TEMPERATURE` | `0.1` (:18) | yes | Sent on every chat completion |
| `CLASSIFICATION_ENABLED` | `True` (:22) | yes | `false` selects the VLM-only pipeline |
| `CLASSIFICATION_SERVICE_URL` | `http://classification-service:3004` (:23) | no | Classification base URL |
| `CLASSIFICATION_TIMEOUT` | `30` (:24) | no | httpx timeout for classification calls |
| `MAX_IMAGE_SIZE_MB` | `5` (:27) | yes | Decoded-bytes limit |
| `MAX_IMAGE_DIMENSION` | `1024` (:28) | yes | Resize target (thumbnail, aspect preserved) |
| `MIN_IMAGE_DIMENSION` | `224` (:29) | yes | Reject smaller images |
| `SUPPORTED_FORMATS` | `["jpeg","jpg","png","webp"]` (:30) | no | Allowed data-URI media subtypes |
| `LOW_CONFIDENCE_THRESHOLD` | `0.5` (:33) | yes | Only used by `analyze_breed(detect_crossbreed=False)` |
| `SPECIES_MIN_CONFIDENCE` | `0.10` (:34) | yes | Full pipeline species gate |
| `BREED_MIN_CONFIDENCE` | `0.05` (:35) | yes | Breed gate in both pipelines (low on purpose for crossbreeds) |
| `CHROMA_PERSIST_DIR` | `./data/chroma` (:38) | no | ChromaDB on-disk path |
| `CHROMA_COLLECTION_NAME` | `pet_knowledge` (:39) | no | Collection name |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` (:42) | no | sentence-transformers model id |
| `EMBEDDING_DIMENSION` | `384` (:43) | no | Stored on the embedder; not enforced |
| `CHUNK_SIZE` | `500` (:46) | no | Tokens per chunk |
| `CHUNK_OVERLAP` | `50` (:47) | no | Token overlap between chunks |
| `RAG_TOP_K` | `5` (:50) | no | Default `n_results` for `/api/v1/rag/query` |
| `RAG_MIN_RELEVANCE` | `0.3` (:51) | no | Declared but never read by the code |
| `KNOWLEDGE_BASE_DIR` | `./data/knowledge_base` (:54) | no | Root for bulk ingestion |

Root-level compose variables that affect this service: `COMPOSE_PROFILES`, `LITELLM_MASTER_KEY`,
`OLLAMA_BASE_URL`, `MISTRAL_API_KEY` (root `.env.example`). Switching to Mistral is config-only:
set `LLM_VISION_MODEL=vision-model-cloud`, `LLM_TEXT_MODEL=text-model-cloud`,
`CLASSIFICATION_ENABLED=false`, and provide `MISTRAL_API_KEY` for LiteLLM
(`srcs/litellm/config.yaml`).

### Values hardcoded outside configuration

These are **not** environment-driven, contrary to the repo-wide threshold convention:

| Value | Location | Meaning |
|-------|----------|---------|
| `0.35` | `src/services/ollama_client.py:31` | second-breed probability above which the LLM result is called a crossbreed |
| `0.75` | `src/services/ollama_client.py:32` | top-breed confidence below which the gap rule applies |
| `0.30` | `src/services/ollama_client.py:33` | max top-vs-second gap that still means crossbreed |
| `top_k=5` | `src/services/vision_orchestrator.py:83` | breed predictions requested from classification |
| `top_n_breeds=2` | `src/services/vision_orchestrator.py:150` | breeds requested from the VLM |
| `n_results=5` / `3` | `src/services/rag_service.py:261`, `:310` | chunks retrieved per breed / per parent breed |
| `500` / `300` / `300` | `src/services/rag_service.py:285-287`, `:332-334` | truncation of description / care / health context |

## Running

The service is built from `srcs/ai/Dockerfile`: `python:3.12.10-slim`, apt packages
`curl gcc g++ build-essential libjpeg-dev zlib1g-dev`, `pip install -r requirements.txt`, non-root
user `aiuser` (uid 1000), `EXPOSE 3003`,
`CMD uvicorn src.main:app --host 0.0.0.0 --port 3003 --workers 2`. There is no `HEALTHCHECK` in the
Dockerfile; the healthcheck is defined in compose.

`src/` and `tests/` are bind-mounted (docker-compose.yml:89-90), so application and test edits are
live. `requirements.txt` changes require `make build`.

```bash
cp srcs/ai/.env.example srcs/ai/.env      # required: compose has env_file: ./srcs/ai/.env

# local profile (GPU: ollama + classification-service)
make up COMPOSE_PROFILES=local
# cloud profile (LiteLLM → Mistral, no GPU; set CLASSIFICATION_ENABLED=false in srcs/ai/.env)
make up COMPOSE_PROFILES=cloud

make logs-ai-service                       # docker compose logs -f ai-service
make exec-ai_service                       # docker exec -it ft_transcendence_ai_service /bin/sh
make rag                                   # bulk-ingest the knowledge base
```

Note the underscore: `exec-%` expands to `ft_transcendence_$*` (Makefile:163-164), so the target is
`exec-ai_service`, while `logs-%` uses the compose service name, so it is `logs-ai-service`.

The Makefile sets `COMPOSE_PROFILES ?= cloud` (Makefile:9); the root `.env.example` ships
`COMPOSE_PROFILES=local`. Pass the profile explicitly if you care which stack comes up.

`ai-service` declares no `depends_on`, so it starts regardless of LiteLLM/Ollama/classification
state. It also downloads the `all-MiniLM-L6-v2` sentence-transformers model from the HuggingFace
hub during startup (`Embedder.__init__` runs in the FastAPI lifespan); there is no HF cache volume
for this container, so a fresh container needs outbound network access and will take longer to
become healthy (hence the 60s `start_period`).

### Reaching the service

There is no host port. From the host, go through the API Gateway (`localhost:8001`) or Nginx
(`localhost:8000` / `localhost:8443`) with a valid `access_token` cookie. The RAG endpoints are not
routed by the gateway at all — reach them with `docker exec` from inside the container, e.g.

```bash
docker exec ft_transcendence_ai_service curl -s http://localhost:3003/api/v1/rag/status
```

## Testing

104 tests, all unit tests with mocked I/O. No test touches the network, ChromaDB on disk, or a real
model. Because tests are bind-mounted and no cross-service hostname is needed,
`docker compose run --rm` works and no rebuild is required after editing or adding a test file.

```bash
# whole suite (104 tests)
docker compose run --rm ai-service python -m pytest tests/ -v

# one file
docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py -v

# one test
docker compose run --rm ai-service python -m pytest tests/test_rag_service.py::test_query_returns_rag_response -v

# coverage (pytest-cov is in requirements.txt, already installed in the image)
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=term

# via the repo orchestrators
./scripts/run-unit-tests.sh --ai
make test ai
```

`pytest.ini` sets `asyncio_mode = auto` (no `@pytest.mark.asyncio` needed, though existing tests use
it), `--strict-markers`, `testpaths = tests`, and declares the `integration` / `slow` / `unit`
markers. There is no `conftest.py`.

| File | Tests | Covers |
|------|-------|--------|
| `tests/test_ollama_client.py` | 23 | `analyze_breed` (both prompt modes), `_chat` payload shape, `_parse_response`, crossbreed post-processing, crossbreed-name map, `generate` |
| `tests/test_rag_service.py` | 18 | `get_breed_context`, `get_crossbreed_context`, `query`, `_build_sources`, `_format_context`, `add_documents`, `get_stats`, `enrich_breed` |
| `tests/test_image_processor.py` | 15 | data-URI parsing, size/dimension rules, resize, re-encode per format |
| `tests/test_rag_routes.py` | 9 | localhost dependency override, bulk ingestion (nested dirs, `.md`-only, per-file errors, 404, 503) |
| `tests/test_vision_orchestrator.py` | 8 | full-pipeline happy paths (purebred, crossbreed, cat), all four rejections, RAG graceful degradation |
| `tests/test_response_models.py` | 8 | pydantic validation of `BreedProbability`, `BreedAnalysis`, `EnrichedInfo`, `VisionAnalysisData` |
| `tests/test_document_processor.py` | 7 | metadata sanitisation and frontmatter/parameter precedence |
| `tests/test_embedder.py` | 6 | `embed`, `embed_batch`, empty-input guards (SentenceTransformer patched) |
| `tests/test_classification_client.py` | 5 | the three classification calls, connect-error and timeout mapping |
| `tests/test_ollama_contextual.py` | 5 | `analyze_with_context` prompt assembly (purebred, crossbreed, no-RAG) and error mapping |

Not covered: the VLM-only pipeline (`_analyze_vlm_only`), `src/routes/vision.py`, `src/main.py`,
`src/middleware/localhost.py` beyond dependency overrides.

End-to-end testing goes through `scripts/jupyter/test_ai_service.ipynb`, which authenticates against
the API Gateway and posts a real image to `/api/v1/vision/analyze`.

## Troubleshooting

**503 `VISION_SERVICE_UNAVAILABLE`.** Something the orchestrator called raised `ConnectionError`.
Candidates, in the order the pipeline hits them:
- `cloud` profile with `CLASSIFICATION_ENABLED=true` → `classification-service` does not exist in
  that profile; the DNS lookup fails.
- LiteLLM down or rejecting the key. `LLM_API_KEY` must equal `LITELLM_MASTER_KEY`
  (root `.env` / `.env.example`); a mismatch returns 401 from the proxy, which surfaces as a
  `ConnectionError` from `analyze_breed`/`generate` but as a 500 from `analyze_with_context` (see below).
- `local` profile with the model not pulled in Ollama, or inference exceeding `LLM_TIMEOUT` (300s).

**504 / client timeout at the gateway.** The gateway allows 300s for `/api/v1/vision`
(`srcs/api-gateway/routes/proxy.py:16-18`) and the service allows `LLM_TIMEOUT` (also 300s) for the
LLM. Nginx does **not**: `location /api` caps `proxy_read_timeout` at 30s
(`srcs/nginx/conf.d/default.conf.template:89`), so a vision request sent through ports 8000/8443
dies at 30s — go through the gateway on `localhost:8001` for slow analyses. If you add another slow
prefix on this service, add it to `SERVICE_TIMEOUTS` too.

**500 `INTERNAL_ERROR` on a valid-looking image.** Three known code paths produce this:
- The LLM returned prose instead of JSON → `_parse_response` raises `RuntimeError`
  (`src/services/ollama_client.py:199`). It only recovers JSON from a ```` ```json ```` fence.
- The LLM returned JSON missing `description`, `traits` or `health_observations` → `KeyError` in
  `vision_orchestrator.py:125-127`.
- `analyze_with_context` only maps `httpx.ConnectError` and `httpx.TimeoutException` to
  `ConnectionError` (`ollama_client.py:404-409`); an HTTP 4xx/5xx from LiteLLM raises
  `httpx.HTTPStatusError`, which is not caught and becomes a 500 rather than a 503.
- A non-image payload with a valid `data:image/...` header: PIL raises `UnidentifiedImageError`
  (an `OSError`, not a `ValueError`), so it escapes the 422 branch.

**422 with a sentence instead of an error code.** `ImageProcessor` raises `ValueError` with human
messages (`Invalid data URI format`, `Unsupported format: bmp`, `Image exceeds 5MB limit`,
`Image too small (min 224x224)`), while the route's `error_map` expects codes
(`INVALID_IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL`). The message ends up in `error.code`
and `error.message` falls back to `"Validation failed"` (`src/routes/vision.py:56-81`). Treat those
three codes as unreachable today.

**`BREED_DETECTION_FAILED`.** `BREED_MIN_CONFIDENCE` defaults to 0.05 precisely because crossbreeds
score low; if you still hit this, check the classification service's own output first
(`docker logs ft_transcendence_classification_service`). Startup logs the active thresholds:
`grep "VisionOrchestrator initialized" <(docker logs ft_transcendence_ai_service)`.

**`enriched_info` is always null.** RAG failures are swallowed by design
(`vision_orchestrator.py:108-110`). Either the collection is empty (`make rag` was never run — the
`ai-chroma-data` volume starts empty and `make downv` wipes it) or the embedder/ChromaDB raised.
Check `GET /api/v1/rag/status` from inside the container and look for
`RAG enrichment failed (graceful degradation)` in the logs.

**RAG endpoints return 200 with `success: false`.** `/api/v1/rag/query`, `/ingest` and `/status`
call `return error_response(code, message, status.HTTP_503_SERVICE_UNAVAILABLE)` when the service
singletons are `None` (`src/routes/rag.py:138-142`, `:198-202`, `:256-260`). `error_response` has no
status parameter — its third argument is `details` — so the 503 becomes payload data and the HTTP
status stays 200. Only `/api/v1/admin/rag/initialize` raises a real 503.

**Re-running `make rag` inflates `document_count`.** Chunk IDs embed `hash(content)`, and CPython
salts string hashing per process, so the same file ingested by a new container gets new IDs and is
stored again instead of being overwritten. Use `make downv` (drops `ai-chroma-data`) for a clean
knowledge base.

**403 on `/api/v1/admin/rag/initialize`.** The dependency allows only `127.0.0.1`, `localhost`,
`::1` and `172.*`. `scripts/init-rag-kb.sh` works because it runs `curl` inside the container
against `localhost`.

**Container is unhealthy right after `make up`.** The lifespan loads sentence-transformers before
serving; with a cold HuggingFace cache the first start can exceed the 60s `start_period`. Check
`make logs-ai-service` for `ai-service started successfully`.
