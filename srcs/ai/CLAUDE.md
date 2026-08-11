# CLAUDE.md - AI Service

## Overview

FastAPI vision pipeline for pet breed analysis. Internal port 3003, container
`ft_transcendence_ai_service`, no host port, `backend-network` only, no compose profile (runs in
both `local` and `cloud`). Stateless except for an embedded ChromaDB collection on the
`ai-chroma-data` volume. All LLM traffic goes to the LiteLLM proxy as OpenAI `chat/completions` —
there is no direct Ollama call anywhere in this codebase, despite the file and test names.

## Essential Commands

```bash
# tests (104). run --rm is fine: everything is mocked, no cross-service hostname needed.
docker compose run --rm ai-service python -m pytest tests/ -v
docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py -v
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=term  # pytest-cov is in the image

# from the repo root
make build                 # only needed for requirements.txt / Dockerfile changes
make up COMPOSE_PROFILES=local     # ollama + classification-service
make up COMPOSE_PROFILES=cloud     # LiteLLM → Mistral, no GPU
make logs-ai-service       # compose service name
make exec-ai_service       # NOTE the underscore: exec-% → ft_transcendence_$*
make rag                   # scripts/init-rag-kb.sh → POST /api/v1/admin/rag/initialize

# poke the internal-only endpoints (no host port exists)
docker exec ft_transcendence_ai_service curl -s http://localhost:3003/api/v1/rag/status
docker exec ft_transcendence_ai_service curl -s http://localhost:3003/health
```

## Code Map

| Path | Responsibility |
|------|----------------|
| `src/main.py` | Module-level `app` (no factory function), CORS, `/health`, lifespan that constructs every singleton and injects them into route modules |
| `src/config.py` | The single `Settings` class; every tunable lives here |
| `src/routes/vision.py` | `POST /api/v1/vision/analyze`, `GET /api/v1/vision/health`; exception→HTTP mapping |
| `src/routes/rag.py` | `router` (`/api/v1/rag`: query, ingest, status) + `admin_router` (`/api/v1/admin/rag/initialize`) |
| `src/services/vision_orchestrator.py` | Pipeline coordinator; branches full vs VLM-only, owns the rejection gates |
| `src/services/ollama_client.py` | `OllamaVisionClient` — OpenAI chat-completions client for LiteLLM; prompts, JSON parsing, crossbreed post-processing |
| `src/services/classification_client.py` | httpx client for `POST /classify/{content,species,breed}` on classification-service |
| `src/services/rag_service.py` | ChromaDB client, `query`, `add_documents`, `get_breed_context`, `get_crossbreed_context`, `enrich_breed`, `get_stats` |
| `src/services/document_processor.py` | Frontmatter parsing, header split, tiktoken chunking, ChromaDB metadata sanitisation |
| `src/services/embedder.py` | sentence-transformers wrapper: `embed`, `embed_batch` |
| `src/services/image_processor.py` | Data-URI parse, size/dimension validation, resize, re-encode |
| `src/middleware/localhost.py` | `require_localhost` FastAPI dependency (127.0.0.1/localhost/::1/`172.*`) |
| `src/models/requests.py` | `RAGQueryRequest`, `RAGIngestRequest` (+ dead `VisionAnalysisRequest`/`VisionAnalysisOptions`) |
| `src/models/responses.py` | Vision + RAG pydantic response models |
| `src/utils/responses.py` | `success_response(data)` / `error_response(code, message, details=None)` |
| `src/utils/logger.py` | JSON log formatter, mutes uvicorn/fastapi/httpx to WARNING |
| `data/knowledge_base/spiecies/` | 34 markdown docs (dogs/cats × purebreeds/crossbreeds/health). Mounted read-only. Directory name misspelled on purpose-by-accident — do not rename |
| `data/chroma/` | ChromaDB persistence mount point (`ai-chroma-data` volume) |
| `tests/` | 104 unit tests, no conftest.py |

## Request / Data Flow

```
POST /api/v1/vision/analyze
  routes/vision.py:analyze_image
    image_processor.process_image(request.image)            # ValueError → 422
    vision_orchestrator.analyze_image(processed)
      if not config.CLASSIFICATION_ENABLED → _analyze_vlm_only
      classification.check_content   → ValueError CONTENT_POLICY_VIOLATION
      classification.detect_species  → UNSUPPORTED_SPECIES | SPECIES_DETECTION_FAILED
      classification.detect_breed(top_k=5) → BREED_DETECTION_FAILED
      rag.get_breed_context | get_crossbreed_context   # try/except → None on any failure
      ollama.analyze_with_context(image_base64=, species=, breed_analysis=, rag_context=)
    VisionAnalysisData(**result) → VisionAnalysisResponse   # 200
```

VLM-only path (`_analyze_vlm_only`): `ollama.analyze_breed(image, detect_crossbreed=True,
top_n_breeds=2)` replaces stages 1-3; the LLM's `breed_probabilities` are turned into a
`breed_analysis` by `_process_crossbreed_result`, then the same RAG + `analyze_with_context` steps
run. No NSFW check, no species allow-list.

Dependency wiring is **not** FastAPI DI. `lifespan` in `src/main.py:49-54` assigns module-level
globals: `vision.image_processor`, `vision.vision_orchestrator`, `rag.rag_service`,
`rag.document_processor`. If you add a service, wire it the same way, and remember the routes must
tolerate it being `None` before startup.

## Conventions & Patterns

- **Every tunable goes in `src/config.py`** and is read off the injected `config`/`settings`
  object. Do not read `os.environ` and do not add a module-level constant. (Existing violations are
  listed in Gotchas — match the convention, not those.)
- **Constructor injection**: every service takes `config` (and its collaborators) as constructor
  arguments; `src/main.py` is the only module that touches `src.config` at all — it imports the
  `Settings` class and builds its own instance (`main.py:18`). The `settings` singleton at
  `config.py:60` is imported by nothing.
- **Errors as exception types, not return codes.** The orchestrator raises `ValueError("CODE")` for
  business rejections and `ConnectionError` for dependency failures; `routes/vision.py` is the only
  place that maps them to HTTP.
- **RAG is best-effort.** Any new enrichment step must be wrapped in `try/except Exception` and
  degrade to `None` — never fail the request because retrieval failed.
- **Response envelopes**: RAG routes return `success_response(...)` / raise
  `HTTPException(detail=error_response(...))`. The vision route builds its envelope inline. Keep
  the `{success, data, error, timestamp}` shape either way.
- **Logging is `logging.getLogger(__name__)`** with the JSON formatter installed globally; log the
  decision at each pipeline gate, as the existing stages do.
- **Prompts live in `_build_*_prompt` methods** on `OllamaVisionClient` and always demand
  "Return ONLY valid JSON" with an explicit schema, because `_parse_response` only accepts raw JSON
  or a ```` ```json ```` fence.

## Gotchas

- **`OllamaVisionClient` does not talk to Ollama.** It POSTs OpenAI `chat/completions` to
  `LLM_BASE_URL` (LiteLLM). Class name, file name, `test_ollama_*.py` and several log/error strings
  ("Failed to connect to Ollama", "Ollama service timeout") are stale naming. Tests assert on those
  strings — changing a message breaks `test_ollama_contextual.py`.
- **Images are multimodal message parts**, not an Ollama `images` array:
  `[{"type":"text",...},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,..."}}]`
  built by `_image_content` (`ollama_client.py:37-44`), which always re-labels the payload as
  `image/jpeg` regardless of the real format.
- **Method names**: the embedder exposes `embed()` / `embed_batch()` (not `embed_text`).
  `analyze_with_context` takes `image_base64=`, not `image=`.
- **`analyze_with_context` swallows only `ConnectError` and `TimeoutException`**
  (`ollama_client.py:404-409`). A 4xx/5xx from LiteLLM (e.g. wrong `LLM_API_KEY`) raises
  `httpx.HTTPStatusError` and surfaces as a 500, while the same failure inside `analyze_breed` /
  `generate` becomes a 503. Do not "fix" one side without checking the tests on the other.
- **`routes/vision.py` `error_map` keys are unreachable.** `ImageProcessor` raises `ValueError`
  with prose (`"Image exceeds 5MB limit"`), so `INVALID_IMAGE_FORMAT`, `IMAGE_TOO_LARGE` and
  `IMAGE_TOO_SMALL` never appear; the prose lands in `error.code`.
- **`error_response()` has no status argument.** `routes/rag.py:138-142`, `:198-202`, `:256-260`
  pass `status.HTTP_503_SERVICE_UNAVAILABLE` as the `details` parameter and `return` (not `raise`),
  so those branches answer **HTTP 200** with `success: false`.
- **`require_localhost` accepts any `172.*` client**, i.e. every container on the Docker bridge —
  it is a network-boundary guard, not loopback-only.
- **Chunk IDs are `f"chunk_{i}_{hash(content) % 10000}"`** (`rag_service.py:180`). String hashing
  is salted per process, so re-ingesting the same file after a restart duplicates it, and two
  chunks can collide within one run.
- **`uvicorn --workers 2`** (Dockerfile:35): the lifespan runs twice, so two SentenceTransformer
  instances load and two `chromadb.PersistentClient` handles open the same directory.
- **`detect_species` accepts a `top_k` argument that the orchestrator never passes**
  (`vision_orchestrator.py:69`), so the classification default applies.
- **Dead config**: `RAG_MIN_RELEVANCE` and `DEBUG` are never read. `LOW_CONFIDENCE_THRESHOLD` is
  only used on the `analyze_breed(detect_crossbreed=False)` branch, which no pipeline takes.
- **Dead models**: `VisionAnalysisRequest` / `VisionAnalysisOptions` in `src/models/requests.py`
  are shadowed by a local `VisionAnalysisRequest` in `routes/vision.py`. The route's version has no
  data-URI validator — validation happens later in `ImageProcessor`.
- **`routes/vision.py` uses `datetime.utcnow()`** (deprecated on the image's Python 3.12) while
  `utils/responses.py` uses `datetime.now(UTC)`. Timestamps differ in format across endpoints.
- **`enriched_info` is `Optional`** in the response model but the LLM output keys
  (`description`, `traits`, `health_observations`) are indexed directly at
  `vision_orchestrator.py:125-127` — a missing key is a `KeyError` → 500.
- **`/api/v1/rag*` is not routed by the API Gateway** (`SERVICE_ROUTES` in
  `srcs/api-gateway/routes/proxy.py:40-48`). Adding an endpoint here does not make it reachable
  from the host; adding a slow one also needs an entry in `SERVICE_TIMEOUTS`.

## Testing Notes

- `pytest.ini`: `asyncio_mode = auto`, `--strict-markers`, `testpaths = tests`, markers
  `integration` / `slow` / `unit`. **No `conftest.py`** — fixtures are per-file.
- `docker compose run --rm ai-service ...` is always sufficient. `src/` and `tests/` are
  bind-mounted (docker-compose.yml:89-90), so **no rebuild** is needed for code or new test files;
  only `requirements.txt` / Dockerfile changes require `make build`.
- **LLM/classification mocking**: patch the class in the module under test, e.g.
  `patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock)`, where `mock` is an
  `AsyncMock` with `__aenter__`/`__aexit__` wired and `post` returning a plain `Mock` whose
  `.json()` yields `{"choices":[{"message":{"content": "<json string>"}}]}`. See
  `_make_mock_http_client` in `tests/test_ollama_client.py:22-30`.
- **Orchestrator tests** pass a bare `Mock()` config with only `SPECIES_MIN_CONFIDENCE` and
  `BREED_MIN_CONFIDENCE` set. `config.CLASSIFICATION_ENABLED` is therefore an auto-created truthy
  Mock attribute, which is why they exercise the full pipeline. To test `_analyze_vlm_only` you
  must set `config.CLASSIFICATION_ENABLED = False` explicitly.
- **Defensive mocking is the house style**: rejection tests still `AsyncMock` the downstream stages
  (RAG, LLM) so a threshold change turns into a failed assertion instead of an `AttributeError`.
- **Route tests** (`tests/test_rag_routes.py`) assign the module globals directly
  (`rag.rag_service = mock`) and build `TestClient(app)` **without** the `with` block, so the
  lifespan never runs and never overwrites the mocks. If you switch to `with TestClient(app)`, real
  models load. `require_localhost` is bypassed via
  `app.dependency_overrides[require_localhost] = ...` and cleared in the fixture teardown.
- `test_initialize_service_not_initialized` sets `rag.rag_service = None` and never restores it —
  it relies on later fixtures re-assigning the globals. Keep new route tests fixture-driven.
- `RAGService` is constructed under `patch('chromadb.PersistentClient')`, then
  `rag_service._collection.query` is replaced per test with a hand-built ChromaDB result dict
  (`ids`/`documents`/`metadatas`/`distances`, each a list-of-lists).
- `Embedder` tests patch `src.services.embedder.SentenceTransformer`; never let a test download a
  model.
- `scripts/run-unit-tests.sh:119-121` still claims 37 tests for this service; the real collection is
  104. The number is cosmetic (it only feeds a printed total), but do not treat it as ground truth.

## Config & Thresholds

`src/config.py` is the only place a tunable may be declared, and `.env.example` documents the
subset intended to be overridden per deployment. `.env` is gitignored — never read defaults from
it. Pipeline gates:

| Threshold | Default | Read at |
|-----------|---------|---------|
| `SPECIES_MIN_CONFIDENCE` | 0.10 | `config.py:34`, used `vision_orchestrator.py:73` |
| `BREED_MIN_CONFIDENCE` | 0.05 | `config.py:35`, used `vision_orchestrator.py:85` and `:154` |
| `LOW_CONFIDENCE_THRESHOLD` | 0.5 | `config.py:33`, used `ollama_client.py:105` (unused branch) |
| `LLM_TIMEOUT` | 300 | `config.py:17` — must stay ≤ the gateway's 300s `SERVICE_TIMEOUTS` entry |
| `CLASSIFICATION_TIMEOUT` | 30 | `config.py:24` |

Values that violate the convention and should be migrated to `config.py` if you touch them:
`ollama_client.py:31-33` (`0.35` crossbreed second-breed probability, `0.75` purebred confidence,
`0.30` purebred gap), `vision_orchestrator.py:83` (`top_k=5`), `vision_orchestrator.py:150`
(`top_n_breeds=2`), `rag_service.py:261`/`:310` (`n_results` 5 / 3), `rag_service.py:285-287` and
`:332-334` (500/300/300-character context truncation).

Profile-dependent settings: `CLASSIFICATION_ENABLED` must be `false` in the `cloud` profile (the
classification-service container is `profiles: ["local"]`), and `LLM_VISION_MODEL` /
`LLM_TEXT_MODEL` must switch to the `*-cloud` aliases defined in `srcs/litellm/config.yaml`.
`LLM_API_KEY` must equal the root `LITELLM_MASTER_KEY`.
