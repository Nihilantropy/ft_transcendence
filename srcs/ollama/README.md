# Ollama Model Runtime

Self-hosted, GPU-accelerated LLM server that holds the local multimodal model used by the vision
pipeline. It runs **only in the `local` compose profile**. Nothing in the application calls it
directly: the AI Service speaks OpenAI chat-completions to the **LiteLLM proxy**, and LiteLLM is the
only component configured with an Ollama endpoint. Swapping local inference for a hosted provider is
therefore a LiteLLM/config change, not a code change.

This directory is not a build context — there is no Dockerfile. The upstream `ollama/ollama` image is
used as-is, with the entrypoint replaced by `init.sh` so that the models listed in `models.txt` are
pulled automatically on container start.

## Responsibilities

- Serve the local model over Ollama's HTTP API on `11434`.
- Pull every model listed in `models.txt` on each container start (`init.sh`).
- Keep model blobs on a persistent volume so restarts do not re-download them.
- Own the GPU reservation for LLM inference (the classification-service holds a separate one).

## Architecture

```
local profile:   ai-service ──► litellm:4000 ──(OLLAMA_BASE_URL)──► ollama:11434 ──► GPU
cloud profile:   ai-service ──► litellm:4000 ──────────────────────► Mistral API   (no ollama container)
```

- The AI Service reads only `LLM_BASE_URL` / `LLM_VISION_MODEL` / `LLM_TEXT_MODEL`
  (`srcs/ai/src/config.py:13-18`). There is **no** `OLLAMA_BASE_URL` in the AI Service's code,
  `.env.example` or `.env`.
- `OLLAMA_BASE_URL` is consumed by exactly two places: the `litellm` service environment
  (`docker-compose.yml:31`, default `http://ollama:11434`) and the two local model entries in
  `srcs/litellm/config.yaml:11,15`.
- `litellm` runs in **both** profiles and declares **no** `depends_on: ollama`
  (`docker-compose.yml:25-43`), so it starts and stays up even when the Ollama container is absent.

### Model routing (`srcs/litellm/config.yaml`)

| LiteLLM alias | Backing model | Profile |
|---------------|---------------|---------|
| `vision-model` | `ollama_chat/qwen3-vl:8b` @ `OLLAMA_BASE_URL` (`config.yaml:8-11`) | `local` |
| `text-model` | `ollama_chat/qwen3-vl:8b` @ `OLLAMA_BASE_URL` (`config.yaml:12-15`) | `local` |
| `vision-model-cloud` | `mistral/mistral-medium-latest` (`config.yaml:20-23`) | `cloud` |
| `text-model-cloud` | `mistral/mistral-large-latest` (`config.yaml:24-27`) | `cloud` |

Selecting `*-cloud` aliases in `srcs/ai/.env` bypasses this container entirely.

### Compose block (`docker-compose.yml:45-77`)

| Fact | Value |
|------|-------|
| Compose service | `ollama` |
| Container name | `ollama` — **not** prefixed with `ft_transcendence_` (`:47`) |
| Image | `ollama/ollama:0.15.4` (`:48`) |
| Profiles | `["local"]` (`:49`) — absent from the `cloud` stack |
| Entrypoint | `["/workspace/init.sh"]` (`:51`), overriding the image default |
| GPU | `runtime: nvidia` (`:50`) + `deploy.resources.reservations.devices` with `count: all` (`:57-63`) |
| Network | `backend-network` (`:75-76`) |
| Host port | `11434:11434` (`:68-69`) — published on the host |
| Restart | `unless-stopped` (`:77`) |
| Logging | json-file, 5 MB × 2 files (`:70-74`) |
| Healthcheck | **none declared** |

Publishing `11434` to the host means the raw, unauthenticated Ollama API is reachable from the
machine running Docker, outside the API Gateway's JWT and rate-limit path. Every other backend
service in this stack is internal-only.

### Volumes

| Mount | Target | Notes |
|-------|--------|-------|
| `ollama` (named volume `ft_transcendence_ollama`) | `/root/.ollama` | Model blobs + manifests; survives `make down`, destroyed by `make downv` |
| `models` (named volume `ft_transcendence_models`) | `/models` | Not referenced by `init.sh`; the only other mention of `/models` is the commented-out `open-webui` block (`docker-compose.yml:136`) |
| `./srcs/ollama/` (bind, **rw**) | `/workspace` | Supplies `init.sh` and `models.txt` |

## Files

| File | Role |
|------|------|
| `init.sh` | Container entrypoint: starts the server, pulls models, then blocks |
| `models.txt` | One model tag per line; `#` comments and blank lines are skipped |
| `README.md` | This document (also visible inside the container at `/workspace/README.md`) |

### `models.txt`

```
qwen3-vl:8b
```

`qwen3-vl:8b` is multimodal (vision + text) and is the target of both the `vision-model` and
`text-model` LiteLLM aliases.

### `init.sh` startup sequence

1. `/bin/ollama serve &` — start the server in the background (`init.sh:4`).
2. `sleep 5` — fixed wait, **not** a readiness poll (`init.sh:8`).
3. Read `/workspace/models.txt` line by line; skip empty lines and lines beginning with `#`; run
   `/bin/ollama pull "$model"` for the rest (`init.sh:11-17`).
4. `wait` — block on the background server process so the container stays alive (`init.sh:20`).

Consequences worth knowing:

- The container is "up" long before it can answer inference requests. On a cold volume the first
  `pull` downloads several GB, and there is no healthcheck to express that, so `docker compose ps`
  reports the container as running regardless.
- The pull loop runs on **every** start, so `models.txt` is re-read after each restart.
- If the `pull` step fails (no network, bad tag), the script continues to `wait` and the server keeps
  serving whatever models are already in the volume — the failure only shows up in the logs.

## Configuration

Environment variables set on the container (`docker-compose.yml:52-56`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `NVIDIA_VISIBLE_DEVICES` | `all` | Expose host GPUs to the container runtime |
| `NVIDIA_DRIVER_CAPABILITIES` | `compute,utility` | Driver capabilities required for CUDA + `nvidia-smi` |
| `CUDA_VISIBLE_DEVICES` | `0` | Restrict inference to the first GPU |
| `LOG_LEVEL` | `info` | Set in compose; not referenced by `init.sh` |

Compose-level variables that affect this service (root `.env.example`; the real root `.env` is
gitignored):

| Variable | `.env.example` value | Effect |
|----------|---------------------|--------|
| `COMPOSE_PROFILES` | `local` (`.env.example:7`) | The container only exists when this includes `local` |
| `OLLAMA_BASE_URL` | `http://ollama:11434` (`.env.example:13`) | Endpoint LiteLLM uses; compose falls back to the same value if unset (`docker-compose.yml:31`) |

Related AI Service defaults (hardcoded in `srcs/ai/src/config.py`, overridable via `srcs/ai/.env`):

| Setting | Default | Line |
|---------|---------|------|
| `LLM_BASE_URL` | `http://litellm:4000/v1` | `:13` |
| `LLM_VISION_MODEL` | `vision-model` | `:15` |
| `LLM_TEXT_MODEL` | `text-model` | `:16` |
| `LLM_TIMEOUT` | `300` seconds | `:17` |
| `LLM_TEMPERATURE` | `0.1` | `:18` |

The API Gateway raises its default 30 s proxy timeout to 300 s for `/api/v1/vision`
(`srcs/api-gateway/routes/proxy.py:16-18`, fallback at `:114-116`) precisely because local inference
is slow.

## Running

Requires an NVIDIA GPU with the driver and `nvidia-container-toolkit` installed on the host — the
service declares `runtime: nvidia`, so compose fails to create the container without it.

```bash
# Whole stack, local profile (Makefile exports COMPOSE_PROFILES)
make up COMPOSE_PROFILES=local

# Just this container
docker compose --profile local up ollama -d

# Logs (watch the model pull on first start)
make logs-ollama

# The cloud profile does not start this container at all
make up COMPOSE_PROFILES=cloud
```

There is no ordering dependency to satisfy: nothing declares `depends_on: ollama`.

### Adding or changing a model

1. Add the tag on its own line in `models.txt`.
2. `docker compose --profile local restart ollama` (or `up -d`) — `init.sh` re-reads the file and pulls.
3. Point a LiteLLM alias at it in `srcs/litellm/config.yaml` (`model: ollama_chat/<tag>`), then
   restart `litellm`.
4. If you want the AI Service to use a new alias, set `LLM_VISION_MODEL` / `LLM_TEXT_MODEL` in
   `srcs/ai/.env`.

Note that `make exec-ollama` does not work: the `exec-%` target expands to
`ft_transcendence_ollama`, while the container is named `ollama`.

## Operations

```bash
# Installed models
docker exec ollama ollama list

# GPU visibility and VRAM usage
docker exec ollama nvidia-smi

# Server reachability from inside the backend network
docker exec ft_transcendence_litellm python -c \
  "import urllib.request; print(urllib.request.urlopen('http://ollama:11434/api/tags').status)"

# Remove a model from the volume
docker exec ollama ollama rm <model-tag>

# Inspect the model volume
docker volume inspect ft_transcendence_ollama
```

## Testing

This directory has no test suite. Coverage of the LLM path lives in the AI Service, and every test
there mocks the HTTP layer — no test starts this container.

```bash
# LLM client + orchestrator tests (all mocked, no GPU, no Ollama needed)
docker compose run --rm ai-service python -m pytest tests/test_ollama_client.py \
  tests/test_ollama_contextual.py tests/test_vision_orchestrator.py -v
```

Real end-to-end verification of local inference is manual, through the Jupyter notebook
`scripts/jupyter/test_ai_service.ipynb`, which drives the pipeline via the API Gateway.

## Troubleshooting

| Symptom | Cause visible in the configuration | Check |
|---------|-----------------------------------|-------|
| `no such service: ollama` / container missing | Running the `cloud` profile; the service is gated by `profiles: ["local"]` | `docker compose --profile local ps ollama` |
| LiteLLM returns a connection error for `vision-model` | Ollama not started, still pulling, or `OLLAMA_BASE_URL` points elsewhere | `make logs-ollama`; `docker exec ollama ollama list` |
| `model not found` from LiteLLM | The tag in `srcs/litellm/config.yaml` does not match anything in `models.txt` / the volume | Compare `ollama ls` output against `config.yaml:10,14` |
| First requests fail right after `up` | `init.sh` sleeps a fixed 5 s and then pulls; there is no healthcheck to gate consumers | Wait for the pull to finish in `make logs-ollama` |
| Very slow generation, GPU idle | Container fell back to CPU (driver/toolkit missing) | `docker exec ollama nvidia-smi`; verify `runtime: nvidia` and the device reservation (`docker-compose.yml:50, 57-63`) |
| Requests time out around 300 s | `LLM_TIMEOUT` (`srcs/ai/src/config.py:17`) and the gateway's vision override (`proxy.py:16-18`) both cap at 300 s | Raise both, or use a smaller model |
| Gateway 503 on `/api/v1/vision` | Inference exceeded the proxy timeout | See the vision entry in `SERVICE_TIMEOUTS` (`srcs/api-gateway/routes/proxy.py:16-18`) |
| Models re-download after a cleanup | `make downv` removes `ft_transcendence_ollama` | Use `make down` (no `-v`) to keep the model cache |
| CUDA out-of-memory | The classification-service reserves the same GPU in the `local` profile (`docker-compose.yml:110-117`) | `nvidia-smi` on the host; stop one of the two GPU services |
