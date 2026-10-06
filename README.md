# SmartBreeds Identifier & Health Monitor
This application utilizes AI-powered computer vision to identify and classify images of dogs and cats. It leverages deep learning models to provide accurate recognition and categorization of various breeds. Additionally, the user can chat with an AI to provide information about his pet, including birth date or age, weight, and health conditions. Based on this information, the AI can offer health monitoring suggestions and recommend top-quality products tailored to the specific breed.

## Getting started

### Prerequisites

- **Docker Engine with Compose v2** (`docker compose version` must work), plus `make`, `git`,
  `openssl`, `curl` and `python3` on the host. Linux or macOS; no GPU needed.
- **A Mistral API key.** The default stack sends every LLM call to Mistral. A free key from
  <https://console.mistral.ai/api-keys> is enough: the models are chosen to fit the free tier.
- **Free host ports** `8000`, `8443` (the app) and `5601` (Kibana).
- **At least 20 GB free in Docker's data root** (`docker info -f '{{.DockerRootDir}}'`). A
  from-scratch run uses about 13 GB (measured): ~15 GB of images as listed by `docker images`,
  ~1.4 GB of downloaded models. `make trash` checks this after its cleanup and stops if there is
  not enough space.
  RAM matters too: Elasticsearch is capped at 1 GB and the classifiers run on the CPU.
- Rootless Docker works (the usual setup on 42 machines).

### Start everything with one command

```bash
git clone git@github.com:Nihilantropy/ft_transcendence.git
cd ft_transcendence
MISTRAL_API_KEY=your-key make trash
```

You can also put the key in `.env` (`MISTRAL_API_KEY=your-key`) and run plain `make trash`.
Passing it on the command line stores it in `.env` for later runs.

When it finishes, you get:

| What | Where | Login |
|------|-------|-------|
| SmartBreeds | <https://localhost:8443> | register an account, or use the admin below |
| Admin account | — | `test_admin@example.com` / `Password123!` |
| Kibana (logs) | <https://localhost:5601> | user `elastic`, password printed at the end (`make elk-creds` reprints it). Pre-built dashboards under **Dashboards** → `SmartBreeds · …` |

Both use self-signed certificates, so your browser will show a warning. Accept it.

### What `make trash` does

It always uses the **cloud** profile (Mistral through LiteLLM, classifiers on CPU) plus the
**ELK** observability stack, whatever `COMPOSE_PROFILES` says.

| Step | Action |
|------|--------|
| 1 | Creates every missing `.env` from its `.env.example` (`make env`). It generates random secrets and keeps the shared ones consistent: the DB password across db/auth/user/recommendation, and the LiteLLM key across `.env` and `srcs/ai/.env`. Existing `.env` files are never overwritten. |
| 2 | **Stops with an error if `MISTRAL_API_KEY` is empty or Mistral rejects it.** It also checks for docker, compose, openssl, curl and python3. Nothing has been deleted at this point. |
| 3 | Deletes every project container, network, volume and image (`make purge PURGE_RMI=all`), prunes the Docker build cache, then checks that 20 GB is free. |
| 4 | Generates the JWT RS256 key pair if it is missing (`make keys`). |
| 5 | Builds every image with `--no-cache --pull`, then prunes the build cache it leaves behind. |
| 6 | Starts the stack and waits for every healthcheck. The first boot of classification-service downloads its models, which takes a few minutes. |
| 7 | Runs the migrations, seeds the product catalog and creates the admin account. |
| 8 | Ingests the breed knowledge base into ChromaDB (RAG). |
| 9 | Starts Elasticsearch, Logstash, Kibana and Vector, provisions their credentials into `.env`, and prints them. |

> ⚠️ **Step 3 wipes every volume.** That means all users, pets, analyses, RAG vectors, logs in
> Elasticsearch and the cached models. It also removes the public images the stack uses
> (`postgres`, `redis`, `litellm`, the Elastic images), so they are pulled again. Your `.env`
> files and JWT keys are kept. To restart without losing data, use `make down` / `make up`.

### Day to day

```bash
make up            # start the app (no rebuild, data kept)
make elk           # start the log stack as well
make down          # stop everything (data kept)
make logs          # follow all logs; make logs-ai-service for one service
make show          # containers, networks, volumes
make help          # every target
```

### The same steps by hand

```bash
make env                         # create the .env files, then set MISTRAL_API_KEY in .env
make keys                        # JWT key pair
make build                       # images
make up                          # stack, cloud profile
make migration seed superuser    # database schema, product catalog, admin account
make rag                         # RAG knowledge base
make elk                         # observability stack
```

### Configuration files

All of these are gitignored and generated from the tracked `.env.example` next to them. Never
commit them.

| File | Holds |
|------|-------|
| `.env` | `COMPOSE_PROFILES`, `MISTRAL_API_KEY`, `LITELLM_MASTER_KEY`, and the ELK credentials (added by `make elk`) |
| `srcs/db/.env` | Postgres database, user and password: the source for every service's DB password |
| `srcs/auth-service/.env` | Django secret, JWT lifetimes, 2FA encryption key, optional 42 OAuth app, cookies |
| `srcs/user-service/.env` | Django secret, DB connection |
| `srcs/ai/.env` | LLM aliases and key (must equal `LITELLM_MASTER_KEY`), image limits, thresholds |
| `srcs/classification-service/.env` | HuggingFace model IDs, NSFW and crossbreed thresholds |
| `srcs/recommendation-service/.env` | DB URL, feature weights |
| `srcs/api-gateway/.env` | Service URLs, Redis, rate limit |
| `srcs/nginx/.env` | `HOST_DOMAIN` added to the TLS certificate |
| `srcs/auth-service/keys/*.pem` | JWT key pair (`make keys`) |

Optional: **"Log in with 42"** needs an intra application. See
[srcs/auth-service/README.md](srcs/auth-service/README.md#create-the-42-application-and-fill-env).
Without one, the button says it is unavailable and everything else works.

Running a local LLM on a GPU instead of Mistral (`COMPOSE_PROFILES=local`) is a different setup,
described in [CLAUDE.md](CLAUDE.md) under "Compose Profiles".

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `MISTRAL_API_KEY is empty` / `Mistral rejected MISTRAL_API_KEY` | Set a valid key in `.env`, or pass `MISTRAL_API_KEY=… make trash`. |
| `… differs from srcs/db/.env POSTGRES_PASSWORD` (or the LiteLLM key) | Two `.env` files disagree. Fix the value, or delete the files involved and re-run `make trash` to regenerate them. |
| `bind source path does not exist` (jwt-public.pem) | Run `make keys`. If it reports a directory where a key should be, `sudo rm -rf` that path, then retry. |
| `port is already allocated` | Free 8000, 8443 or 5601, or stop the other project using them. |
| Step 6 waits a long time on classification-service | Normal on the first boot: it downloads ~1.3 GB of models and loads them on CPU (healthcheck grace period: 5 min). |
| Analyses fail with 429 / rate limit | Mistral free-tier limits. LiteLLM already retries and falls back to a second model, so wait a minute. |
| `Only N GB free in Docker's data root` | Free space where Docker stores its data: `docker system df` shows what uses it; `docker builder prune -af` and `docker image prune -a` usually reclaim the most. |
| `elk-setup failed` / `cannot allocate the .security index` | Usually a nearly full disk: Elasticsearch stops allocating shards below 1 GB free. Free space as above, then `make elk`. Otherwise `docker logs ft_transcendence_elk_setup`; details in [srcs/elk/README.md](srcs/elk/README.md). |

## Features
- Image upload functionality for users to submit pictures of dogs and cats.
- AI-powered image recognition to classify the breed of the animal in the image.
- Ai-generated descriptions and information about the identified breed.
- Ai-powered pedegree analisys and validation.
- Health monitoring suggestions based on breed characteristics.
- Top quality production suggestions for food, toys, and accessories tailored to the identified breed.

## Target Audience
- Luxury pet owners looking to identify and learn more about their pets.
- Veterinarians seeking quick breed identification and health monitoring tools.
- Luxury pet product retailers aiming to provide personalized recommendations.

## Technologies Used
- Docker for containerization and deployment.
- Nginx for reverse proxy.
- Redis for caching and session management.
- ollama backend server for AI model hosting.
  - multimodal model: qwen3-vl:8b for image recognition, analysis and description generation.
- React for frontend development.
- Tailwind CSS for styling and responsive design.
- Django for api-gateway routing.
- Django for backend micro-service.
- PostgreSQL for database management.
- Blockchain integration for pedigree validation and tracking. (backlog feature)