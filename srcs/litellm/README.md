# LiteLLM — Inference Gateway

Single OpenAI-compatible endpoint for every LLM call in the platform. The AI Service never
talks to a model backend directly: it POSTs OpenAI chat-completions to
`http://litellm:4000/v1` and the proxy resolves the requested *model alias* to either the
local Ollama container (GPU) or the hosted Mistral API. Switching inference backends is
therefore a configuration change — the alias in `srcs/ai/.env` — with no code change anywhere.
This directory contains a single config file, `config.yaml`; the container runs the upstream
`ghcr.io/berriai/litellm:main-stable` image with that file bind-mounted read-only.

## Responsibilities

- Expose one OpenAI-compatible API on port `4000` inside `backend-network` — `docker-compose.yml:28,36`
- Map four model aliases to concrete providers — `config.yaml:6-27`
- Inject provider credentials (`OLLAMA_BASE_URL`, `MISTRAL_API_KEY`) from the environment so no secret lives in the repo — `config.yaml:11,15,23,27`
- Authenticate callers with a single master key (`LITELLM_MASTER_KEY`) — `docker-compose.yml:30`
- Silently drop request parameters a given provider does not support (`drop_params: true`) — `config.yaml:29-30`

## Architecture

```
ai-service ──POST /v1/chat/completions──▶ litellm:4000 ──┬── local profile ──▶ ollama:11434  (qwen3-vl:8b, GPU)
           (Bearer LITELLM_MASTER_KEY)                   └── cloud profile ──▶ Mistral API   (needs MISTRAL_API_KEY)
```

| Property | Value | Source |
|----------|-------|--------|
| Container name | `ft_transcendence_litellm` | `docker-compose.yml:26` |
| Image | `ghcr.io/berriai/litellm:main-stable` (upstream, not built here) | `docker-compose.yml:27` |
| Command | `--config /app/config.yaml --port 4000` | `docker-compose.yml:28` |
| Host ports | **none** — internal only, reachable at `http://litellm:4000` | `docker-compose.yml:25-43` |
| Networks | `backend-network` | `docker-compose.yml:35-36` |
| Compose profile | none — runs in **both** `local` and `cloud` | `docker-compose.yml:25-43` |
| `depends_on` | none (it does not wait for `ollama`) | `docker-compose.yml:25-43` |
| Restart policy | `unless-stopped` | `docker-compose.yml:37` |
| Volumes | `./srcs/litellm/config.yaml:/app/config.yaml:ro` | `docker-compose.yml:33-34` |
| Healthcheck | `GET http://localhost:4000/health/liveliness` via `python -c urllib.request`, 30s interval / 10s timeout / 3 retries / 30s start period | `docker-compose.yml:38-43` |

**Callers:** the AI Service is the only consumer — `srcs/ai/src/services/ollama_client.py` is the
only HTTP client pointed at `LLM_BASE_URL` (`srcs/ai/src/config.py:13`). No other service or
script references port 4000.

**Persistence:** no `DATABASE_URL` and no database container are wired to the proxy
(`docker-compose.yml:29-34`), and `config.yaml` declares no virtual keys, so authentication is
the master key only and there is no stored spend/usage state.

## Model Aliases

| Alias | `litellm_params.model` | Backend | Credential | Profile |
|-------|------------------------|---------|------------|---------|
| `vision-model` | `ollama_chat/qwen3-vl:8b` | `api_base = OLLAMA_BASE_URL` | none | `local` only (needs the `ollama` container) |
| `text-model` | `ollama_chat/qwen3-vl:8b` | `api_base = OLLAMA_BASE_URL` | none | `local` only |
| `vision-model-cloud` | `mistral/mistral-medium-latest` | Mistral API | `MISTRAL_API_KEY` | `cloud` |
| `text-model-cloud` | `mistral/mistral-large-latest` | Mistral API | `MISTRAL_API_KEY` | `cloud` |

Source: `config.yaml:8-27`. The split between the two cloud aliases is deliberate and documented
in `config.yaml:17-19`: `mistral-large` is text-only, so the vision stage uses the vision-capable
`mistral-medium`, while text generation uses `mistral-large`.

The `local` aliases resolve `qwen3-vl:8b`, which is the model the Ollama container pulls at
startup (`srcs/ollama/models.txt`, pulled by `srcs/ollama/init.sh`).

### Which alias serves which call

| AI Service call site | Alias variable | Used for |
|----------------------|----------------|----------|
| `OllamaVisionClient.analyze_breed()` / `.analyze_with_context()` (`srcs/ai/src/services/ollama_client.py:95,402`) | `LLM_VISION_MODEL` | Vision pipeline: breed detection (VLM-only path) and contextual image analysis |
| `OllamaVisionClient.generate()` (`srcs/ai/src/services/ollama_client.py:368`), called by `RAGService.query()` (`srcs/ai/src/services/rag_service.py:90`) | `LLM_TEXT_MODEL` | Text answer generation for the RAG query endpoint (`POST /api/v1/rag/query`), which the API Gateway deliberately does not route (`srcs/api-gateway/routes/proxy.py:38,45`) |

## API Surface Used by This Repo

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/chat/completions` | `Authorization: Bearer <LITELLM_MASTER_KEY>` | All inference. Called as `LLM_BASE_URL` + `/chat/completions`, i.e. `http://litellm:4000/v1/chat/completions` — `srcs/ai/src/services/ollama_client.py:22,58` |
| `GET` | `/health/liveliness` | none | Container healthcheck — `docker-compose.yml:39` |

Other routes provided by the upstream LiteLLM image are not used anywhere in this repo.

### Request the AI Service sends

Built in `srcs/ai/src/services/ollama_client.py:46-62`:

```json
{
  "model": "<LLM_VISION_MODEL or LLM_TEXT_MODEL>",
  "messages": [ ... ],
  "temperature": 0.1,
  "stream": false
}
```

- Header: `Authorization: Bearer <LLM_API_KEY>`, added only when `LLM_API_KEY` is non-empty (`:48`).
- Multimodal messages use OpenAI content parts — a `text` part plus an `image_url` part whose URL
  is a `data:image/jpeg;base64,...` URI; an incoming data-URI prefix is stripped and re-added (`:37-44`).
- Client timeout: `httpx.Timeout(LLM_TIMEOUT, connect=LLM_TIMEOUT)` — read and connect both use the
  same value, default 300s (`:55`, `srcs/ai/src/config.py:17`). No retry logic.
- Response is read as `choices[0].message.content` (`:62`); a non-2xx status raises via
  `raise_for_status()`.

## Configuration

### Container environment (`docker-compose.yml:29-32`)

| Variable | Compose default | Purpose |
|----------|-----------------|---------|
| `LITELLM_MASTER_KEY` | `sk-smartbreeds-local` | Bearer token the proxy requires from callers. Must equal the AI Service `LLM_API_KEY` |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | `api_base` for `vision-model` / `text-model` (`config.yaml:11,15`). Only meaningful in the `local` profile |
| `MISTRAL_API_KEY` | empty | `api_key` for `vision-model-cloud` / `text-model-cloud` (`config.yaml:23,27`). Required in the `cloud` profile |

All three come from the root compose-level `.env` (template: root `.env.example:10,13,17`), which
Docker Compose reads automatically for `${VAR}` interpolation. The `:-default` fallbacks in
`docker-compose.yml` apply when the variable is unset.

### Caller-side settings (AI Service)

Defaults hardcoded in `srcs/ai/src/config.py:13-18`; overridable through `srcs/ai/.env`
(template: `srcs/ai/.env.example:1-9`).

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_BASE_URL` | `http://litellm:4000/v1` | Proxy endpoint |
| `LLM_API_KEY` | `sk-smartbreeds-local` | Must match `LITELLM_MASTER_KEY` |
| `LLM_VISION_MODEL` | `vision-model` | Alias for image calls |
| `LLM_TEXT_MODEL` | `text-model` | Alias for text calls |
| `LLM_TIMEOUT` | `300` | Connect and read timeout in seconds |
| `LLM_TEMPERATURE` | `0.1` | Sampling temperature sent on every request |

The defaults line up out of the box: `sk-smartbreeds-local` on both sides, and the `local` aliases.

### Proxy settings

| Key | Value | Effect |
|-----|-------|--------|
| `litellm_settings.drop_params` | `true` (`config.yaml:30`) | Parameters unsupported by the resolved provider are dropped instead of erroring |

## Profile Matrix

| | `local` | `cloud` |
|---|---------|---------|
| `litellm` container | runs | runs |
| `ollama` container | runs (GPU, `docker-compose.yml:49`) | not started |
| `classification-service` | runs (GPU, `docker-compose.yml:106`) | not started |
| Aliases to select in `srcs/ai/.env` | `vision-model` / `text-model` | `vision-model-cloud` / `text-model-cloud` |
| `MISTRAL_API_KEY` | not needed | required |
| `CLASSIFICATION_ENABLED` (`srcs/ai/src/config.py:22`) | `true` | must be `false` — the classification service is absent, and the vision LLM performs species/breed detection with **no NSFW filter** |

Because the proxy has no `profiles:` key it starts in both modes; selecting a backend is purely a
matter of which alias the AI Service asks for.

## Running

```bash
make up                                 # whole stack, profile from Makefile / root .env
make up COMPOSE_PROFILES=cloud          # Mistral backend, no GPU containers
docker compose up litellm -d            # this container only
make logs-litellm                       # docker compose logs -f litellm
make exec-litellm                       # shell into ft_transcendence_litellm
```

- Config is bind-mounted read-only, so editing `config.yaml` needs only
  `docker compose restart litellm` — no image rebuild.
- Changing `LITELLM_MASTER_KEY`, `OLLAMA_BASE_URL` or `MISTRAL_API_KEY` in the root `.env` requires
  `docker compose up -d litellm` (recreate) since they are container environment variables. Update
  the AI Service `LLM_API_KEY` at the same time or every call returns 401.
- In the `local` profile the `ollama` container must be up **and** must have finished pulling
  `qwen3-vl:8b` (`srcs/ollama/init.sh`) before the first inference succeeds; there is no
  `depends_on` between the two services.

## Testing

There is no test suite in this directory. The client contract against the proxy is covered by
AI Service unit tests with `httpx` fully mocked (no live proxy involved):

| File | `def test_` count | Coverage |
|------|-------------------|----------|
| `srcs/ai/tests/test_ollama_client.py` | 23 | Payload construction, data-URI handling, JSON/markdown response parsing, crossbreed post-processing, error mapping |
| `srcs/ai/tests/test_ollama_contextual.py` | 5 | `analyze_with_context()` prompt building and error paths |

Both fixtures point at a dummy URL `http://test-litellm:4000/v1`
(`test_ollama_client.py:13`, `test_ollama_contextual.py:13`).

```bash
docker compose run --rm ai-service python -m pytest tests/test_ollama_client.py tests/test_ollama_contextual.py -v
```

Manual checks against a running stack (no host port — commands must run inside the network):

```bash
# Liveness, exactly what the healthcheck does
docker exec ft_transcendence_litellm python -c \
  "import urllib.request; print(urllib.request.urlopen('http://localhost:4000/health/liveliness').read())"

# End-to-end alias resolution from the caller's point of view
docker exec ft_transcendence_ai_service curl -s -X POST http://litellm:4000/v1/chat/completions \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>" -H "Content-Type: application/json" \
  -d '{"model":"text-model","messages":[{"role":"user","content":"ping"}],"stream":false}'

# The alias set actually loaded by the AI Service
docker exec ft_transcendence_ai_service curl -s http://localhost:3003/health   # reports llm_url, vision_model, text_model
```

## Troubleshooting

| Symptom | Cause | Where |
|---------|-------|-------|
| Every LLM call fails with `ConnectionError: Failed to connect to Ollama` | The AI Service maps **any** `httpx.HTTPError` — including a 401/404 from the proxy — onto that message. Check the proxy's own logs to see the real status | `srcs/ai/src/services/ollama_client.py:113-115,370-372` |
| 401 from the proxy | `LITELLM_MASTER_KEY` (container env) differs from `LLM_API_KEY` (AI Service). They default to the same `sk-smartbreeds-local`, so a drift means one side was overridden | `docker-compose.yml:30`, `srcs/ai/src/config.py:14` |
| Cloud aliases fail to authenticate | `MISTRAL_API_KEY` is empty (its compose default) | `docker-compose.yml:32`, `config.yaml:23,27` |
| Local aliases fail while running the `cloud` profile | The `ollama` container is not started in `cloud`, so `OLLAMA_BASE_URL` points to a non-existent host. Switch the AI Service to the `*-cloud` aliases | `docker-compose.yml:49`, `config.yaml:11,15` |
| Vision call fails against a text-only cloud model | `text-model-cloud` maps to `mistral-large-latest`, which is text-only. Image requests must use `vision-model-cloud` | `config.yaml:17-27` |
| First `local` request hangs for minutes | Ollama is still pulling `qwen3-vl:8b`, and/or the 8B model is loading into VRAM. `LLM_TIMEOUT` defaults to 300s | `srcs/ollama/init.sh`, `srcs/ai/src/config.py:17` |
| Requests time out at ~30s when made through Nginx | Nginx applies `proxy_read_timeout 30s` on `/api`, well below the 300s LLM timeout | `srcs/nginx/conf.d/default.conf.template:89` |
| Container restarts / healthcheck fails at boot | The proxy failed to load `/app/config.yaml` — a YAML syntax error or an unresolvable `os.environ/...` reference. Read `docker compose logs litellm` | `docker-compose.yml:28,33-34` |
| A new alias is not recognised | `config.yaml` is mounted read-only but is read at startup; restart the container after editing | `docker-compose.yml:33-34` |
| An unexpected parameter is ignored rather than rejected | `drop_params: true` silently removes provider-unsupported parameters | `config.yaml:30` |
