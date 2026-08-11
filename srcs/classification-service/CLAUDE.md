# CLAUDE.md - Classification Service

## Overview

FastAPI service wrapping four HuggingFace image classifiers (NSFW, species, dog breed, cat breed)
plus a crossbreed heuristic. Stateless, no auth, no DB, internal port 3004, no host port, container
`ft_transcendence_classification_service`. Its only client is the AI Service (`ClassificationClient`);
the API Gateway has no route to it. Compose profile **`local` only** — it does not exist in `cloud`,
where the AI Service runs a VLM-only pipeline instead.

## Essential Commands

```bash
# Tests (28). No cross-service calls → `run --rm` is fine. Explicit profile avoids surprises.
COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/ -v
COMPOSE_PROFILES=local docker compose run --rm classification-service \
  python -m pytest tests/test_crossbreed_detector.py -v
COMPOSE_PROFILES=local docker compose run --rm classification-service \
  python -m pytest tests/ --cov=src --cov-report=term-missing   # pytest-cov is in requirements.txt

# Repo orchestrators (bare `docker compose run --rm` form)
./scripts/run-unit-tests.sh --classification
make test classification

# Rebuild — MANDATORY after any src/ or tests/ edit (no bind mount for this service)
docker compose build classification-service

# Run / inspect (Makefile defaults COMPOSE_PROFILES=cloud at Makefile:9 → be explicit)
make up COMPOSE_PROFILES=local
COMPOSE_PROFILES=local docker compose up -d classification-service
COMPOSE_PROFILES=local docker compose logs -f classification-service
docker exec -it ft_transcendence_classification_service /bin/sh

# GPU / device check
docker exec ft_transcendence_classification_service \
  python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
COMPOSE_PROFILES=local docker compose logs classification-service | grep -E "Using device|CrossbreedDetector initialized"
```

## Code Map

| Path | Responsibility |
|---|---|
| `src/main.py` | FastAPI app, CORS, `GET /health`, lifespan: resolve device → construct the 4 models + `CrossbreedDetector` → assign them onto `src.routes.classify` module attributes |
| `src/config.py` | Pydantic `Settings` singleton `settings`; every threshold and model id lives here |
| `src/routes/classify.py` | `APIRouter(prefix="/classify")`; request schemas; module-level service globals; the only error mapping in the service |
| `src/models/nsfw_detector.py` | `NSFWDetector.predict(PIL) -> {is_safe, nsfw_probability}` |
| `src/models/species_classifier.py` | `SpeciesClassifier.predict(PIL, top_k) -> {species, confidence, top_predictions}` + `SPECIES_MAPPING` label normalisation |
| `src/models/breed_classifier.py` | `BreedClassifierBase.predict(PIL, top_k) -> [{breed, probability}]`; `DogBreedClassifier` / `CatBreedClassifier` subclasses differing only in default model id and log label |
| `src/services/crossbreed_detector.py` | `process_breed_result(list) -> breed_analysis` + `identify_common_name(list) -> str|None` (10-entry table) |
| `src/services/image_utils.py` | `ImageUtils.decode_base64` (raises `ValueError`), `preprocess_for_model` (used only by tests, but its `torchvision` import is a hard runtime dependency) |
| `tests/conftest.py` | Lifespan-free app factory + `Mock`s for all five injected components |
| `tests/test_*.py` | See README table; 13 of 28 tests instantiate real HF models on CPU |
| `Dockerfile` | python:3.12.10-slim, requirements, **separately pinned** torch/torchvision cu128, non-root `classifier`, `uvicorn src.main:app --port 3004` |
| `.env.example` | Template for the gitignored `.env` injected via compose `env_file` |

## Request / Data Flow

```
POST /classify/{content,species,breed}
  → pydantic request model validates (bad shape ⇒ 422 FastAPI default)
  → ImageUtils.decode_base64(request.image)          ValueError ⇒ 422 INVALID_IMAGE
  → module-global model .predict(pil_image)          any Exception ⇒ 500 CLASSIFICATION_ERROR
  → (/breed only) crossbreed_detector.process_breed_result(probs)
  → plain dict returned (no response_model, no envelope)
```

Models are constructed once in the lifespan (`main.py:37-41`) and injected by assignment
(`main.py:44-48`) into `src/routes/classify.py`, where the handlers read them as module globals at
call time (`classify.py:52,86,116-125`). Nothing is resolved through `Depends`.

Upstream contract, consumed by `srcs/ai/src/services/vision_orchestrator.py`:

| This service returns | Orchestrator reads | Line |
|---|---|---|
| `/classify/content` → `is_safe` | rejects with `CONTENT_POLICY_VIOLATION` when false | `vision_orchestrator.py:62` |
| `/classify/species` → `species`, `confidence` | `UNSUPPORTED_SPECIES` if not dog/cat, `SPECIES_DETECTION_FAILED` below its own threshold | `vision_orchestrator.py:69-75` |
| `/classify/breed` → `breed_analysis.confidence` | `BREED_DETECTION_FAILED` below its own threshold | `vision_orchestrator.py:85-87` |
| `breed_analysis.is_likely_crossbreed`, `.crossbreed_analysis.detected_breeds`, `.primary_breed` | RAG query selection, then the LLM prompt | `vision_orchestrator.py:98-101`, `ollama_client.py:425-447` |

The whole `breed_analysis` object is validated against `BreedAnalysis`
(`srcs/ai/src/models/responses.py:19-25`). Renaming or dropping a key there breaks the AI Service's
response validation, not just a log line.

## Conventions & Patterns

- **Thresholds are never hardcoded in logic.** They live in `src/config.py` and reach consumers via
  the `settings` object (`CrossbreedDetector.__init__(config)` copies them into instance attributes,
  `crossbreed_detector.py:16-19`). The one violation is `nsfw_detector.py:61` — do not add more.
- **Dependency injection by module attribute**, not `Depends`. A new model means: construct it in
  `main.py` lifespan, assign `classify.<name> = ...`, declare `<name> = None` at
  `classify.py:33-37`, and add a `Mock` fixture wired in `tests/conftest.py`.
- **Error mapping lives only in the route handlers**: `except ValueError → 422 {"code":
  "INVALID_IMAGE"}`, `except Exception → 500 {"code": "CLASSIFICATION_ERROR"}`, both with a dict
  `detail`. Model and service classes raise plain exceptions and never build HTTP responses.
- **Label normalisation**: species labels are lower-cased then passed through `SPECIES_MAPPING`;
  breed labels are lower-cased with spaces and hyphens replaced by `_`
  (`breed_classifier.py:66`). Display names in `crossbreed_analysis.detected_breeds` go the other
  way — `_` → space, `.title()` (`crossbreed_detector.py:80-83`).
- **Rounding**: classifiers round to 3 decimals, the crossbreed detector re-rounds everything it
  emits to 2 (`crossbreed_detector.py:116,121,124`).
- **`torch.topk` is always clamped** with `min(top_k, len(probs))` (`species_classifier.py:74`,
  `breed_classifier.py:60`) — keep this when adding classifiers.
- Inference always inside `with torch.no_grad():`, model `.eval()` and `.to(device)` at construction.
- Routes return bare dicts; there is no `response_model` and no platform `{success, data, error}`
  envelope in this service. Do not "fix" this without updating `ClassificationClient`.

## Gotchas

- **No source bind mount.** `docker-compose.yml:122-123` mounts only `huggingface-cache`; `src/` and
  `tests/` are baked in at `Dockerfile:23-24`. Every edit — including new test files — needs
  `docker compose build classification-service`. This differs from ai-service/api-gateway, which do
  hot-mount their code.
- **`make up` alone does not start this service.** `Makefile:9` sets `COMPOSE_PROFILES ?= cloud` and
  exports it, which overrides the root `.env`. Use `COMPOSE_PROFILES=local`.
- **`NSFW_REJECTION_THRESHOLD` is decorative.** `is_safe` is decided by a literal `0.5`
  (`nsfw_detector.py:61`); the route merely appends the configured threshold to the payload
  (`classify.py:56`), and the orchestrator ignores that field. Changing the env var changes nothing
  observable.
- **NSFW probability is read positionally** as softmax index 1 (`nsfw_detector.py:58`) instead of
  looking up `id2label`. The code comments acknowledge the assumption. Swapping `NSFW_MODEL` for a
  model with different label ordering silently inverts the safety verdict.
- **`SPECIES_MIN_CONFIDENCE` and `BREED_MIN_CONFIDENCE` in this service's config are dead.** Nothing
  reads them (`grep "settings\." src/` returns only NSFW/log/model/device/service keys). The
  effective thresholds are the identically named vars in `srcs/ai/src/config.py`. Do not "tune" them
  here and expect behaviour to change.
- **`DOG_BREED_MODEL` disagrees between layers**: `.env.example:9` says `prithivMLmods/Dog-Breed-120`,
  `config.py:17` defaults to `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit`. The
  env value wins in Docker. `tests/test_breed_classifier.py:66` calls `top_k=120` and asserts the
  probabilities sum to ~1, which assumes a ≤120-class model.
- **`DEVICE` is missing from `.env.example`** even though the compose block comments say it is
  controlled there (`docker-compose.yml:119`). Without it, `config.py:12` default `auto` applies and
  a missing GPU degrades to CPU silently.
- **Crossbreed logic only ever looks at the top two entries.** `top_k` affects the length of
  `breed_probabilities` and nothing else. A single-element list can never be flagged as a crossbreed
  (`crossbreed_detector.py:65`).
- **Crossbreed replaces `confidence` with the mean of the top two** (`crossbreed_detector.py:116`),
  so a crossbreed verdict *lowers* the number the AI Service threshold is compared against.
- **`primary_breed` is rewritten on a crossbreed** to the common name or `<a>_<b>_mix`
  (`crossbreed_detector.py:110-113`) — downstream RAG lookups receive that synthetic string, not a
  model label.
- **`decode_base64` splits on the first comma** (`image_utils.py:30-31`) whenever one is present,
  not only for `data:` URIs.
- **Startup is the slow path.** Four models load in the lifespan (60–90s per `main.py:35`, plus
  download on a cold `huggingface-cache`). `/health` does not answer before that, and the service has
  no `restart:` policy, so a lifespan exception leaves the container stopped.
- **`torchvision` is required at runtime** purely because `image_utils.py:5` imports it at module
  scope for `preprocess_for_model`, which only tests call. Removing the import would drop a
  multi-GB dependency; removing the *function* alone would not.

## Testing Notes

- `tests/conftest.py` builds a **new** `FastAPI()` without `lifespan=`, re-declares `/health`, sets
  `classify.<component> = Mock()` for all five components, then includes the router. That ordering is
  convention only — handlers read the module globals at call time — but keep it, and keep the app
  lifespan-free, or the fixture will download and load real models.
- Those assignments mutate the real `src.routes.classify` module and are never restored. They persist
  for the pytest session; do not write a test that expects the pristine `None` globals.
- Three test files (`test_nsfw_detector.py`, `test_species_classifier.py`, `test_breed_classifier.py`,
  13 tests) construct the **real** classes on `device="cpu"` using ids from `settings`. They need the
  HF cache or network. `docker compose run --rm` attaches the same `huggingface-cache` volume, so a
  warm cache keeps them fast. Changing a model id in `.env` changes what these tests download.
- Mock shape drift to watch: `conftest.py:38-42` returns `top_predictions` entries keyed `species`,
  while the real `SpeciesClassifier` returns them keyed `label`
  (`species_classifier.py:80`). `test_classify_routes.py` only asserts the list length, so the
  mismatch is invisible — do not copy the fixture shape as if it were the contract.
- `run --rm` is always sufficient here (no cross-service hostnames). `docker exec` is only needed for
  GPU/device introspection, and requires the container to be up under the `local` profile.
- No `pytest.ini`/`pyproject.toml`; rootdir is `/app` and `tests/__init__.py` makes `tests` a package,
  which is what allows `from src...` imports.
- `pytest`, `pytest-asyncio` and `pytest-cov` are all in `requirements.txt` — no on-the-fly installs
  needed. Coverage target is `--cov=src`.

## Config & Thresholds

All tunables are `Settings` fields in `src/config.py` and are supplied as environment variables
through the compose `env_file` (`./srcs/classification-service/.env`, gitignored; `.env.example` is
the template). Rule: **never hardcode a confidence, probability or gap value in logic** — add a field
to `Settings`, mirror it in `.env.example`, and pass `settings` into the component that needs it
(the `CrossbreedDetector(settings)` constructor is the model to copy).

Live in this service: `CROSSBREED_PROBABILITY_THRESHOLD` (`config.py:26`),
`PUREBRED_CONFIDENCE_THRESHOLD` (`config.py:27`), `PUREBRED_GAP_THRESHOLD` (`config.py:28`),
`CROSSBREED_MIN_SECOND_BREED` (`config.py:29`), `DEVICE` (`config.py:12`), the four model ids
(`config.py:15-18`), `LOG_LEVEL` (`config.py:11`).

Echoed but not enforced: `NSFW_REJECTION_THRESHOLD` (`config.py:21`).
Unused here, enforced by the AI Service instead: `SPECIES_MIN_CONFIDENCE` (`config.py:22`),
`BREED_MIN_CONFIDENCE` (`config.py:23`).

Cross-service pairing: this service's `CROSSBREED_MIN_SECOND_BREED` and the AI Service's
`BREED_MIN_CONFIDENCE` form a two-stage gate — flagging a crossbreed here changes the confidence the
AI Service later compares against, so they must be tuned together.
