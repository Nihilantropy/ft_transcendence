# CLAUDE.md - AI Service

## Overview

FastAPI vision pipeline for pet breed analysis. Internal port 3003, container
`ft_transcendence_ai_service`, no host port, `backend-network` only, no compose profile (runs in
both `local` and `cloud`). Stateless except for an embedded ChromaDB collection on the
`ai-chroma-data` volume. All LLM traffic goes to the LiteLLM proxy as OpenAI `chat/completions` —
there is no direct Ollama call anywhere in this codebase, despite the file and test names.

## Essential Commands

```bash
# tests (188). run --rm is fine: everything is mocked, no cross-service hostname needed.
docker compose run --rm ai-service python -m pytest tests/ -v
docker compose run --rm ai-service python -m pytest tests/test_vision_orchestrator.py -v
docker compose run --rm ai-service python -m pytest tests/ --cov=src --cov-report=term  # pytest-cov is in the image

# from the repo root
make build                 # only needed for requirements.txt / Dockerfile changes
make up COMPOSE_PROFILES=local     # ollama + classification-service
make up COMPOSE_PROFILES=cloud     # LiteLLM → Mistral, no GPU
make logs-ai-service       # compose service name
make exec-ai_service       # NOTE the underscore: exec-% → ft_transcendence_$*
make rag                   # scripts/init-rag-kb.sh → POST /api/v1/admin/rag/initialize (force a KB sync now; retries on 409)
make test-rag              # e2e: probe .md added / modified / deleted at runtime (needs the stack up)

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
| `src/services/rag_service.py` | ChromaDB client, `query`, `add_documents` (upsert, stable IDs), `get_indexed_files`, `delete_document`, `get_breed_context`, `get_crossbreed_context`, `enrich_breed`, `get_stats` |
| `src/services/knowledge_sync.py` | `sync_knowledge_base` (KB dir ↔ ChromaDB: new / modified / deleted files, file lock), `run_periodic_sync`, `start_periodic_sync` |
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
| `tests/` | 188 unit tests, no conftest.py |

## Request / Data Flow

```
POST /api/v1/vision/analyze
  routes/vision.py:analyze_image
    image_processor.process_image(request.image)            # ValueError → 422
    vision_orchestrator.analyze_image(processed, language, user_context)
      if not config.CLASSIFICATION_ENABLED → _analyze_vlm_only
      classification.check_content   → ValueError CONTENT_POLICY_VIOLATION
      classification.detect_species  → UNSUPPORTED_SPECIES | SPECIES_DETECTION_FAILED
      classification.detect_breed(top_k=5) → BREED_DETECTION_FAILED
      rag.get_breed_context | get_crossbreed_context   # try/except → None on any failure
      ollama.analyze_with_context(image_base64=, species=, breed_analysis=, rag_context=,
                                  language=, user_context=)   # owner notes: this stage ONLY
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
  "Return ONLY valid JSON" with an explicit schema. `_parse_response` is lenient on purpose — whole
  text, then a ```json / ``` fence, then the outermost `{...}`, all with `strict=False` (small
  hosted models emit literal newlines inside strings) — and raises `RuntimeError` on failure, never
  a `ValueError`, which the route would turn into a 422. Keep demanding JSON in the prompt anyway:
  the leniency recovers from sloppy formatting, not from a model that answers in prose.

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
- **`ImageProcessor` raises `ValueError` with the `error_map` codes directly**
  (`INVALID_IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL`), never prose — `routes/vision.py`
  uses `str(e)` as `error.code`, so the exception message IS the code. Undecodable base64 and
  unopenable image bytes (PIL `UnidentifiedImageError`/`OSError`) also map to
  `INVALID_IMAGE_FORMAT`. Keep new validation failures in this file raising a code, not a message.
- **`error_response()` has no status argument.** `routes/rag.py:109-113`, `:169-173`, `:227-231`
  pass `status.HTTP_503_SERVICE_UNAVAILABLE` as the `details` parameter and `return` (not `raise`),
  so those branches answer **HTTP 200** with `success: false`.
- **`require_localhost` accepts any `172.*` client**, i.e. every container on the Docker bridge —
  it is a network-boundary guard, not loopback-only.
- **Chunk IDs are `"<source_file>::<index>"`, written with `upsert`** (`RAGService._chunk_id`).
  They must stay reproducible across processes — never put `hash()` (salted per process) in them.
  `add_documents` is called once per document, so the index is the position inside that file.
- **The knowledge base syncs itself** (`src/services/knowledge_sync.py`): once at startup, then
  every `RAG_SYNC_INTERVAL_MINUTES`, and on `POST /api/v1/admin/rag/initialize`. All three run the
  same `sync_knowledge_base`; the manifest is the `source_file` + `content_hash` metadata in
  ChromaDB, never process memory. A non-blocking `flock` on `<CHROMA_PERSIST_DIR>/.ingest.lock`
  keeps the timer and the endpoint from overlapping (and would hold across processes); the
  endpoint turns a busy lock into 409 `INGESTION_IN_PROGRESS`, the timer skips the round. The run
  goes through `asyncio.to_thread`; calling it straight from an `async def` blocks the only worker
  for the whole ingestion (measured through the thread: 20 files ingested in 2 s, `/health` never
  slower than 55 ms meanwhile).
- **torch is installed from the PyTorch CPU index in the Dockerfile, before `requirements.txt`.**
  Do not move it into `requirements.txt` or drop the `--index-url`: plain pip resolves the CUDA
  build (+3.2 GB `nvidia/`, +0.9 GB `triton`) and the image grows from ~2.9 GB to 10.5 GB for a
  GPU nothing here uses — torch only runs the embedder.
- **`uvicorn --workers 1`, and it must stay 1** (Dockerfile). ChromaDB is embedded
  (`PersistentClient`) and keeps its vector index in process memory. With 2 workers, the one that
  did not ingest never saw the new vectors and kept returning the ones the other had deleted —
  with no metadata, so `get_breed_context` / `query` died on `'NoneType' object has no attribute
  'get'` (enrichment silently `null`, `/api/v1/rag/query` 500) until a restart. `count()` reads
  SQLite and looked fine in both, which is why `/api/v1/rag/status` never showed it. More workers
  need ChromaDB as a server (`HttpClient`), not a bigger `--workers`.
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
- **Sync and re-ingestion tests use a real ChromaDB on `tmp_path`** with a fake embedder
  (`tests/test_knowledge_sync.py`, the `chroma_rag_service` fixture in `tests/test_rag_service.py`):
  duplicates, orphans and deletions are properties of the store, a mocked collection cannot show
  them. Route tests keep a `Mock` service; its fixture points `CHROMA_PERSIST_DIR` at `tmp_path`
  because the endpoint takes the file lock there.
- `RAGService` is constructed under `patch('chromadb.PersistentClient')`, then
  `rag_service._collection.query` is replaced per test with a hand-built ChromaDB result dict
  (`ids`/`documents`/`metadatas`/`distances`, each a list-of-lists).
- `Embedder` tests patch `src.services.embedder.SentenceTransformer`; never let a test download a
  model.
- `scripts/run-unit-tests.sh:119-121` still claims 37 tests for this service; the real collection is
  188. The number is cosmetic (it only feeds a printed total), but do not treat it as ground truth.

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
(`top_n_breeds=2`).

**Breed context is a vector search restricted by metadata** (`rag_service.py::_build_context`).
Two searches run on every analysis: the chunks of the breed (`where breed == <classifier breed>`,
or `parent_breeds` for a mix; top `RAG_BREED_TOP_K`, reassembled in file order into `description`)
and the health documents of the species (`doc_type: health` + `species`; queried with
"<Breed> common health problems" and, separately, with the owner notes; best `RAG_HEALTH_TOP_K`
documents into `health_info`). The filter decides what is eligible, the embedding only ranks
inside it: ranking the whole collection put the right document's health section in the prompt
for 6 breeds out of 20. **There is no relevance threshold on purpose** — measured, a neutral note
scores as high as a note describing a symptom, so the LLM decides what applies. Consequences: a
breed document **must** declare `breed:` in its frontmatter (crossbreeds: `parent_breeds: [a, b]`)
or the vision pipeline never sees it; a breed without a document still gets the health documents
(`description` is then empty). `enriched_info.matches` lists the retrieved documents with their
cosine similarity — the frontend shows it, and the orchestrator logs it as `RAG context: ...`.

**A knowledge base fact about a visible feature is applied by the code, not by the model's prose**
(`ollama_client.py::_matched_facts`). The prompt makes the model fill `context_check`: for each
fact tied to one value of a visible feature, the value in the context, the value on this animal,
and whether they match. That comparison is reliable (measured 16/16 on a blue and a pink dog
against a "blue coat" fact); the model's own wording of the fact is not — it reported it 6 times
out of 8, and after a rewording of the prompt it swapped the cause for a likelier one ("may have
been dyed") 4 times out of 6. So for every `match: true` the code quotes the passage of the
retrieved context that mentions `value_in_context` (`_quote_context`), puts it first in
`health_observations`, and translates it with `translate_texts` when the report is not in
English. An entry the model marks `usual_for_breed: true` is skipped: a healthy animal matches its
own breed standard, and "Standard: shades of gold" used to open the health observations.
Two shapes of a wrong check are repaired in code, both seen on a blue dog (3 in 10 with the
collaborators' demo document): same value on both sides yet `match: false`, and only the usual
value checked ("golden" vs "blue") — then the passage about what the animal shows is quoted, if
the context has one. Every analysis logs `context_check: [...]`, the model's raw comparison.
`context_check` never leaves the client. Do not move this back into the prompt.

**Embedding model: `google/embeddinggemma-2`**, text encoder only (`embedder.py`), 768-d, cosine.
It replaced `all-MiniLM-L6-v2` because owner notes arrive in the user's language: Italian notes
found the right health document 2 times out of 8 with MiniLM, 8 out of 8 with this one. It needs
`sentence-transformers>=6` and `torchvision` (its processor imports it even for text), is ~1.5 GB
and is cached in the `huggingface-cache` volume (first boot downloads it — hence the 300 s
`start_period`). Queries and documents are encoded with different prompts (`SearchQuery` /
`Document`). The collection records the model in its metadata: changing `EMBEDDING_MODEL` drops
and rebuilds it at startup (`_open_collection`), ~2 min on CPU for the 383 chunks.

Profile-dependent settings: keep `CLASSIFICATION_ENABLED=true` in **both** profiles —
classification-service runs in every stack, on CPU by default. `LLM_VISION_MODEL` /
`LLM_TEXT_MODEL` default to the `*-cloud` aliases (the default deployment); a GPU machine on the
`local` profile sets `vision-model` / `text-model`. `LLM_API_KEY` must equal the root
`LITELLM_MASTER_KEY`. On the Mistral free tier the cloud aliases resolve to `ministral-*` models
— see `srcs/litellm/config.yaml` for why the larger ones are unusable there.
