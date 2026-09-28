# Classification Service

FastAPI microservice that runs HuggingFace image classifiers (NSFW safety, animal species, dog/cat
breed) and post-processes breed probabilities into a purebred/crossbreed verdict. It exists so the
AI Service gets **structured, deterministic** predictions with numeric confidences instead of asking
an LLM to self-report a breed. It is stateless, has no database, no authentication, and no host port:
its only client is the AI Service over the internal Docker network. It runs **only in the `local`
compose profile** — the `cloud` profile has no GPU, so the AI Service falls back to a VLM-only
pipeline and this service is absent.

## Responsibilities

- Decode base64 images (with or without `data:` URI prefix) into PIL images — `src/services/image_utils.py:16`
- NSFW probability for an image — `src/models/nsfw_detector.py`
- Animal species top-K prediction, normalised to `dog` / `cat` when the raw label is recognised — `src/models/species_classifier.py`
- Dog **or** cat breed top-K prediction — `src/models/breed_classifier.py`
- Crossbreed heuristic over the breed probability distribution, including common crossbreed naming
  (Goldendoodle, Labradoodle, …) — `src/services/crossbreed_detector.py`
- Load all four models once at application startup and hold them in memory — `src/main.py:22-56`

Explicitly **not** its responsibility: enforcing rejection thresholds. This service returns numbers;
the AI Service's `VisionOrchestrator` decides what to reject (see Configuration).

## Architecture

| Property | Value | Source |
|---|---|---|
| Container | `ft_transcendence_classification_service` | `docker-compose.yml:105` |
| Image | `ft_transcendence-classification-service:latest` (~14 GB, CUDA wheels) | compose default naming |
| Internal port | 3004 (`EXPOSE 3004`, `uvicorn --port 3004`) | `Dockerfile:32,34` |
| Host port | **none** — not reachable from the host | `docker-compose.yml:101-131` |
| Network | `backend-network` only | `docker-compose.yml:124-125` |
| Compose profile | `local` only | `docker-compose.yml:106` |
| GPU | `runtime: nvidia`, 1 device reserved, capability `gpu` | `docker-compose.yml:110-117` |
| Persistent volume | `huggingface-cache` → `/app/.cache/huggingface` | `docker-compose.yml:122-123` |
| Healthcheck | `curl -f http://localhost:3004/health`, 30s interval, 10s timeout, 3 retries, 60s start period | `docker-compose.yml:126-131` |
| Restart policy | none declared | `docker-compose.yml:101-131` |
| `depends_on` | none | `docker-compose.yml:101-131` |

**Who calls it.** Only the AI Service, through `ClassificationClient`
(`srcs/ai/src/services/classification_client.py`). Base URL default
`http://classification-service:3004` (`srcs/ai/src/config.py:23`), per-request timeout
`CLASSIFICATION_TIMEOUT` default `30` seconds (`srcs/ai/src/config.py:24`), a fresh
`httpx.AsyncClient` per call, **no retries**. `httpx.ConnectError` and `httpx.TimeoutException` are
both re-raised as a Python `ConnectionError` (`classification_client.py:44-49`), which the AI
Service's vision route turns into HTTP 503 `VISION_SERVICE_UNAVAILABLE`
(`srcs/ai/src/routes/vision.py:83-92`).

The API Gateway has **no** route to this service — its routing table only knows auth, user, vision
and recommendation prefixes (`srcs/api-gateway/routes/proxy.py:41-47`). There is no way to reach
`/classify/*` from outside the backend network.

**What it calls.** Nothing at request time. At startup it pulls four models from the HuggingFace Hub
into `/app/.cache/huggingface` (backed by the `huggingface-cache` named volume), so the first boot
needs outbound internet; later boots are served from the volume. No PostgreSQL, no Redis, no
ChromaDB, no LiteLLM.

**Profile behaviour.**

| Profile | This service | Effect on the AI pipeline |
|---|---|---|
| `local` | runs (GPU) | Full pipeline: NSFW filter + HF species + HF breed, then RAG + LLM |
| `cloud` | **does not exist** | AI Service must run with `CLASSIFICATION_ENABLED=false` (VLM-only, **no NSFW filter**); leaving it `true` makes the orchestrator call a dead host → 503 |

### Pipeline position

```
AI Service (VisionOrchestrator)          Classification Service (this)
  stage 1  check_content(image)   ──►    POST /classify/content
  stage 2  detect_species(image)  ──►    POST /classify/species
  stage 3  detect_breed(image, species) ─► POST /classify/breed
  stage 4  RAG (ChromaDB)                 (not involved)
  stage 5  LLM via LiteLLM proxy          (not involved)
```

The three calls are sequential and the orchestrator aborts early on rejection
(`srcs/ai/src/services/vision_orchestrator.py:61-88`), so stage 3 is skipped when stage 2 fails.

## API Reference

Router prefix is `/classify` (`src/routes/classify.py:10`) and the app includes the router with no
additional prefix (`src/main.py:88`). No trailing slashes. **No authentication on any endpoint** —
the only protection is network isolation.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness; used by the compose healthcheck |
| POST | `/classify/content` | none | NSFW probability for an image |
| POST | `/classify/species` | none | Species top-K prediction |
| POST | `/classify/breed` | none | Breed top-K + crossbreed analysis |

CORS is wide open (`allow_origins=["*"]`, credentials allowed) — `src/main.py:67-73`.

### GET /health

```json
{"status": "healthy", "service": "classification-service", "port": 3004}
```

`service` and `port` echo `SERVICE_NAME` / `SERVICE_PORT` (`src/main.py:80-84`). The endpoint only
answers after the lifespan has finished loading all four models, so an in-progress model download
looks like a connection failure, not a 503.

### POST /classify/content

Request (`src/routes/classify.py:14-16`):

```json
{"image": "<base64 image, data URI prefix optional>"}
```

Success 200 (`src/models/nsfw_detector.py:60-63`, `src/routes/classify.py:56`):

```json
{"is_safe": true, "nsfw_probability": 0.012, "threshold": 0.7}
```

- `nsfw_probability` is softmax index 1 of the model output, rounded to 3 decimals (`nsfw_detector.py:58,62`).
- `is_safe` is `nsfw_probability < 0.5` — a **hardcoded** cut (`nsfw_detector.py:61`).
- `threshold` echoes `NSFW_REJECTION_THRESHOLD` but is *not* what produced `is_safe`, and the AI
  Service ignores it: the orchestrator only reads `is_safe`
  (`srcs/ai/src/services/vision_orchestrator.py:62`).

### POST /classify/species

Request (`src/routes/classify.py:19-22`):

```json
{"image": "<base64>", "top_k": 3}
```

`top_k` defaults to 3, constrained `1 <= top_k <= 10`.

Success 200 (`src/models/species_classifier.py:90-94`):

```json
{
  "species": "dog",
  "confidence": 0.951,
  "top_predictions": [
    {"label": "dog", "confidence": 0.951},
    {"label": "cat", "confidence": 0.021},
    {"label": "fox", "confidence": 0.008}
  ]
}
```

- Labels are lower-cased model labels; `species` is `top_predictions[0].label` passed through
  `SPECIES_MAPPING` (`species_classifier.py:10-19`), which maps `canis-lupus-familiaris`,
  `canis lupus familiaris`, `canis`, `dog` → `dog` and the `felis-*` equivalents → `cat`. Any other
  label is returned verbatim, and the AI Service rejects it as `UNSUPPORTED_SPECIES`
  (`vision_orchestrator.py:70-72`).
- Confidences are rounded to 3 decimals; `torch.topk` is clamped with `min(top_k, len(probs))`
  (`species_classifier.py:74`).

### POST /classify/breed

Request (`src/routes/classify.py:25-29`):

```json
{"image": "<base64>", "species": "dog", "top_k": 5}
```

`species` is a `Literal["dog", "cat"]` — anything else is a FastAPI validation error (422).
`top_k` defaults to 5, constrained `1 <= top_k <= 10`.

Success 200 — the raw classifier output is passed through `CrossbreedDetector.process_breed_result`
(`src/routes/classify.py:122-127`):

```json
{
  "breed_analysis": {
    "primary_breed": "golden_retriever",
    "confidence": 0.89,
    "is_likely_crossbreed": false,
    "breed_probabilities": [
      {"breed": "golden_retriever", "probability": 0.89},
      {"breed": "labrador_retriever", "probability": 0.06}
    ],
    "crossbreed_analysis": null
  }
}
```

Crossbreed case (`crossbreed_detector.py:79-116`):

```json
{
  "breed_analysis": {
    "primary_breed": "goldendoodle",
    "confidence": 0.41,
    "is_likely_crossbreed": true,
    "breed_probabilities": [{"breed": "golden_retriever", "probability": 0.47}, {"breed": "poodle", "probability": 0.36}],
    "crossbreed_analysis": {
      "detected_breeds": ["Golden Retriever", "Poodle"],
      "common_name": "Goldendoodle",
      "confidence_reasoning": "Multiple breeds with high probabilities (...). Low top-breed confidence (0.47)"
    }
  }
}
```

Field rules:

| Field | Rule | Source |
|---|---|---|
| `breed` labels | model label, lower-cased, spaces and hyphens → `_` | `breed_classifier.py:66` |
| `probability` | 3 decimals from the classifier, re-rounded to **2** in the response | `breed_classifier.py:67`, `crossbreed_detector.py:124` |
| `is_likely_crossbreed` | see rules below | `crossbreed_detector.py:65-76` |
| `confidence` (crossbreed) | mean of the top two probabilities | `crossbreed_detector.py:116` |
| `primary_breed` (crossbreed) | mapped common name lower-snake-cased, else `<top>_<second>_mix` | `crossbreed_detector.py:110-113` |
| `common_name` | lookup in a 10-entry table, `null` when the pair is unknown | `crossbreed_detector.py:143-154` |
| empty input list | `primary_breed: "unknown"`, `confidence: 0.0`, `crossbreed_analysis: null` | `crossbreed_detector.py:46-53` |

Crossbreed rules (either one is sufficient; both need a second prediction to exist):

1. `second.probability > CROSSBREED_PROBABILITY_THRESHOLD` — `crossbreed_detector.py:67`
2. `top.probability < PUREBRED_CONFIDENCE_THRESHOLD` **and** `top - second < PUREBRED_GAP_THRESHOLD`
   **and** `second.probability > CROSSBREED_MIN_SECOND_BREED` — `crossbreed_detector.py:71-76`

Only the top two entries influence the verdict; a larger `top_k` only lengthens
`breed_probabilities`.

This object is deserialised by the AI Service into the `BreedAnalysis` Pydantic model
(`srcs/ai/src/models/responses.py:19-25`), so every key above is a hard contract.

### Error responses

| Status | Body | Cause |
|---|---|---|
| 422 | `{"detail": [...]}` (FastAPI default) | Request-schema violation: missing `image`, `species` not `dog`/`cat`, `top_k` outside 1–10 |
| 422 | `{"detail": {"code": "INVALID_IMAGE", "message": "..."}}` | `ImageUtils.decode_base64` raised `ValueError` — bad base64 or unparseable image (`image_utils.py:45-47`, `classify.py:60-65`) |
| 500 | `{"detail": {"code": "CLASSIFICATION_ERROR", "message": "Content check failed" / "Species detection failed" / "Breed detection failed"}}` | Any other exception during inference (`classify.py:66-71,96-101,135-140`) |

Note: these bodies are **not** the platform-standard `{success, data, error, timestamp}` envelope
used by the API Gateway; this service returns raw FastAPI `HTTPException` payloads. Nothing outside
the AI Service consumes them, and the AI Service treats any non-2xx as a pipeline failure via
`raise_for_status()` (`classification_client.py:41`).

## Data Model

Stateless. No database, no migrations, no schema in PostgreSQL. The only persisted state is the
HuggingFace model cache in the `huggingface-cache` named volume mounted at
`/app/.cache/huggingface`. In-memory state is the four loaded models plus the `CrossbreedDetector`,
held as module-level attributes of `src/routes/classify.py` and assigned during lifespan startup
(`src/main.py:44-48`).

## Configuration

Values come from environment variables injected by compose `env_file`
(`./srcs/classification-service/.env`, gitignored — copy from `.env.example`). Pydantic Settings is
case-insensitive and also honours a local `.env` file when the service is run outside Docker
(`src/config.py:35-37`).

| Variable | `.env.example` | `config.py` default | Read at | Purpose |
|---|---|---|---|---|
| `SERVICE_NAME` | `classification-service` | same (`config.py:9`) | `main.py:25,82` | Logging + `/health` payload |
| `SERVICE_PORT` | `3004` | same (`config.py:10`) | `main.py:51,83` | **Reported only.** The real listen port is the `--port 3004` in `Dockerfile:34` |
| `LOG_LEVEL` | `INFO` | same (`config.py:11`) | `main.py:16` | Root logging level (upper-cased) |
| `DEVICE` | *(absent)* | `auto` (`config.py:12`) | `main.py:28-31` | `auto` → CUDA if `torch.cuda.is_available()` else CPU; or force `cuda` / `cpu` |
| `NSFW_MODEL` | `Falconsai/nsfw_image_detection` | same (`config.py:15`) | `main.py:37` | NSFW model id |
| `SPECIES_MODEL` | `dima806/animal_151_types_image_detection` | same (`config.py:16`) | `main.py:38` | Species model id (151 animal types, `species_classifier.py:23`) |
| `DOG_BREED_MODEL` | `prithivMLmods/Dog-Breed-120` | `wesleyacheng/dog-breeds-multiclass-image-classification-with-vit` (`config.py:17`) | `main.py:39` | **The two disagree** — the env value wins wherever `.env` is present |
| `CAT_BREED_MODEL` | `dima806/cat_breed_image_detection` | same (`config.py:18`) | `main.py:40` | Cat breed model id |
| `NSFW_REJECTION_THRESHOLD` | `0.70` | `0.70` (`config.py:21`) | `classify.py:56` | Echoed in the `/classify/content` response only; `is_safe` uses a hardcoded `0.5` |
| `SPECIES_MIN_CONFIDENCE` | `0.60` | `0.60` (`config.py:22`) | **nowhere in this service** | Dead config here; the live species threshold is the AI Service's own `SPECIES_MIN_CONFIDENCE` (`srcs/ai/src/config.py`) |
| `BREED_MIN_CONFIDENCE` | `0.40` | `0.40` (`config.py:23`) | **nowhere in this service** | Dead config here; the live breed threshold is the AI Service's `BREED_MIN_CONFIDENCE` |
| `CROSSBREED_PROBABILITY_THRESHOLD` | `0.35` | `0.35` (`config.py:26`) | `crossbreed_detector.py:16,67` | Rule 1: second breed above this ⇒ crossbreed |
| `PUREBRED_CONFIDENCE_THRESHOLD` | `0.75` | `0.75` (`config.py:27`) | `crossbreed_detector.py:17,71` | Rule 2: top breed must be below this to consider a mix |
| `PUREBRED_GAP_THRESHOLD` | `0.30` | `0.30` (`config.py:28`) | `crossbreed_detector.py:18,73` | Rule 2: max gap between top two |
| `CROSSBREED_MIN_SECOND_BREED` | `0.05` | `0.05` (`config.py:29`) | `crossbreed_detector.py:19,75` | Rule 2: noise floor for the second breed |
| `TRANSFORMERS_CACHE` | `/app/.cache/huggingface` | same (`config.py:32`) | consumed by HuggingFace via the process environment, not by this code | Model cache path |
| `HF_HOME` | `/app/.cache/huggingface` | same (`config.py:33`) | consumed by HuggingFace via the process environment | HF home |

`TRANSFORMERS_CACHE` and `HF_HOME` are also set in the compose `environment:` block
(`docker-compose.yml:118-121`), which takes precedence over `env_file`.

The active crossbreed thresholds are logged at startup —
`grep "CrossbreedDetector initialized"` in the logs (`crossbreed_detector.py:21-27`).

## Running

The service only exists in the `local` profile, and the Makefile defaults `COMPOSE_PROFILES` to
`cloud` (`Makefile:9`), while the root `.env.example` suggests `local` (`.env.example:7`). Because
the Makefile exports the variable, a bare `make up` starts the cloud stack **without** this service.
Be explicit:

```bash
# From the repo root — start the whole local (GPU) stack
make up COMPOSE_PROFILES=local

# Or just this service
COMPOSE_PROFILES=local docker compose up -d classification-service

# Logs / shell
COMPOSE_PROFILES=local docker compose logs -f classification-service
docker exec -it ft_transcendence_classification_service /bin/sh

# Rebuild after ANY change to src/ or tests/ (no source bind mount for this service)
docker compose build classification-service
```

Prerequisites:

- NVIDIA runtime available to Docker (`runtime: nvidia`, `docker-compose.yml:110`). With
  `DEVICE=auto` the service silently falls back to CPU if CUDA is unavailable, which makes inference
  much slower but still functional.
- Outbound internet on first start to populate the `huggingface-cache` volume.
- No other service needs to be up: there are no `depends_on` entries and no outbound service calls.
- The AI Service must have `CLASSIFICATION_ENABLED=true` for this service to be exercised
  (`srcs/ai/src/config.py:22`, `srcs/ai/.env.example:14`).

Startup takes 60–90 seconds when models must be loaded (`src/main.py:35`), longer on the first run
because the weights are downloaded. The healthcheck's 60s `start_period` may therefore be exceeded
and the container can flip to `unhealthy` before the first successful probe; with three 30s retries
it recovers once `/health` answers.

Verify the device actually chosen:

```bash
docker exec ft_transcendence_classification_service \
  python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
COMPOSE_PROFILES=local docker compose logs classification-service | grep "Using device"
```

## Testing

28 tests, no service dependencies, so `docker compose run --rm` is sufficient (targeting the service
explicitly on the command line activates its `local` profile; the prefix below removes all doubt):

```bash
# All 28 tests
COMPOSE_PROFILES=local docker compose run --rm classification-service python -m pytest tests/ -v

# One file
COMPOSE_PROFILES=local docker compose run --rm classification-service \
  python -m pytest tests/test_crossbreed_detector.py -v

# One test
COMPOSE_PROFILES=local docker compose run --rm classification-service \
  python -m pytest tests/test_crossbreed_detector.py::test_empty_probabilities -v

# Coverage (pytest-cov==6.0.0 is already in requirements.txt)
COMPOSE_PROFILES=local docker compose run --rm classification-service \
  python -m pytest tests/ --cov=src --cov-report=term-missing

# Via the repo test orchestrators (they use the bare `docker compose run --rm` form)
./scripts/run-unit-tests.sh --classification
make test classification
```

There is no `pytest.ini` / `pyproject.toml` in this service; pytest runs with rootdir `/app`, which
is why `from src...` imports resolve.

| File | Tests | Loads real models? | Covers |
|---|---|---|---|
| `tests/test_classify_routes.py` | 5 | no (mocked) | All three routes: happy paths, invalid `species` → 422, invalid base64 → 422 |
| `tests/test_crossbreed_detector.py` | 6 | no | Rule 1, purebred, rule 2, common-name lookup incl. reversed order, empty list, noise-rejection regression |
| `tests/test_image_utils.py` | 4 | no | Base64 with/without data URI, invalid base64 raises `ValueError`, `preprocess_for_model` tensor shape/dtype |
| `tests/test_nsfw_detector.py` | 3 | **yes** (CPU) | Real `NSFWDetector` init and prediction bounds on a solid-colour image |
| `tests/test_species_classifier.py` | 4 | **yes** (CPU) | Real init, top-K length, descending order |
| `tests/test_breed_classifier.py` | 6 | **yes** (CPU) | Real dog/cat init, top-K, descending order, probabilities sum to ~1 with `top_k=120` |

The 13 model-backed tests instantiate the real HuggingFace models on CPU using the ids from the
current environment. `docker compose run` mounts the same `huggingface-cache` volume, so they are
fast when the cache is warm and slow (download) when it is not.

`tests/__init__.py` exists, so `tests` is a package; `tests/conftest.py` builds a FastAPI app
**without** the lifespan so no models are loaded for route tests.

## Troubleshooting

**AI Service returns 503 `VISION_SERVICE_UNAVAILABLE`.** The orchestrator could not reach this
service (`classification_client.py:44-49` → `vision.py:83-92`). Either the stack is running the
`cloud` profile (this service does not exist there) while the AI Service still has
`CLASSIFICATION_ENABLED=true`, or the container is still loading models, or it exited during
startup. Check `COMPOSE_PROFILES=local docker compose ps classification-service`.

**Container never becomes healthy.** `/health` is only served after the lifespan finishes loading
four models (`src/main.py:36-51`); the compose `start_period` is 60s and the code itself budgets
60–90s. Watch `... logs -f classification-service` for `All models loaded successfully`.

**Container exits right after start.** An exception inside the lifespan (HF Hub unreachable, model
id typo, out-of-memory on the GPU, corrupted cache) aborts uvicorn startup. This service has **no**
`restart:` policy in compose, so it stays stopped. The failing model id is in the last
`Loading ...` log line before the traceback.

**Everything answers 500 `CLASSIFICATION_ERROR`.** Every route wraps inference in a broad
`except Exception` that maps any non-`ValueError` failure to 500 with a fixed message
(`classify.py:66-71,96-101,135-140`), so the real cause is only visible in the service logs.

**422 `INVALID_IMAGE`.** `ImageUtils.decode_base64` failed. It strips everything before the first
comma when one is present (`image_utils.py:30-31`), so a base64 payload that itself contains a comma
or a truncated upload lands here. Non-RGB/L modes are converted to RGB automatically
(`image_utils.py:40-41`).

**Predictions run on CPU although a GPU is present.** `DEVICE=auto` falls back silently
(`main.py:28-29`). Confirm with the `Using device: ...` log line, and check that the NVIDIA runtime
and the `deploy.resources.reservations.devices` block are effective on the host.

**Low breed confidence / `BREED_DETECTION_FAILED` at the AI Service.** This service does not reject
anything by confidence — the rejection happens in `VisionOrchestrator` against the AI Service's
`BREED_MIN_CONFIDENCE`. Breed models trained on purebreds spread probability mass across a
crossbreed, and the crossbreed path replaces `confidence` with the mean of the top two
(`crossbreed_detector.py:116`), which lowers it further. Tune the AI Service threshold and
`CROSSBREED_MIN_SECOND_BREED` together.

**A code change has no effect.** There is no bind mount for `src/` or `tests/` in the compose block
(`docker-compose.yml:122-123` mounts only the HF cache) — the Dockerfile bakes both in
(`Dockerfile:23-24`). Run `docker compose build classification-service`.

**torch / torchvision import errors after a rebuild.** They are pinned in the Dockerfile, not in
`requirements.txt`:

```dockerfile
RUN pip3 install \
    torch==2.11.0+cu128 \
    torchvision==0.26.0+cu128 \
    --index-url https://download.pytorch.org/whl/cu128
```

(`Dockerfile:17-20`). The pair must stay version-matched (torch 2.11 ↔ torchvision 0.26). The
comment at `Dockerfile:14-16` records why: these stable CUDA-12.8 wheels replaced an unpinned
nightly that broke when torch and torchvision drifted out of sync on the nightly index; `cu128`
carries both Ada (sm_89) and Blackwell (sm_120) kernels. `torchvision` is a hard runtime import —
`src/services/image_utils.py:5` imports it at module load, and that module is imported by the
routes.

## Build facts

| Item | Value | Source |
|---|---|---|
| Base image | `python:3.12.10-slim` | `Dockerfile:1` |
| System deps | `curl`, `build-essential` | `Dockerfile:4-7` |
| Python deps | `requirements.txt` (FastAPI 0.128.0, uvicorn 0.32.0, transformers 4.46.3, pillow 11.0.0, pydantic 2.10.3, pydantic-settings 2.6.1, httpx 0.28.1, pytest 8.3.4, pytest-asyncio 0.24.0, pytest-cov 6.0.0, sentencepiece 0.2.1) | `requirements.txt` |
| Outside requirements | `torch==2.11.0+cu128`, `torchvision==0.26.0+cu128` from `https://download.pytorch.org/whl/cu128` | `Dockerfile:17-20` |
| Copied into image | `src/`, `tests/` | `Dockerfile:23-24` |
| User | non-root `classifier`, uid 1000; owns `/app` and `/app/.cache/huggingface` | `Dockerfile:27-30` |
| Exposed port | 3004 | `Dockerfile:32` |
| CMD | `uvicorn src.main:app --host 0.0.0.0 --port 3004` | `Dockerfile:34` |
