.DEFAULT_GOAL := help

DOCKER_COMPOSE = docker compose
COMPOSE_FILE = docker-compose.yml
PROJECT_NAME = ft_transcendence

# Compose profiles: 'local' = GPU stack (ollama + classification-service),
# 'cloud' = LiteLLM-only (hosted API key, no GPU). Override: make up COMPOSE_PROFILES=cloud
COMPOSE_PROFILES ?= cloud
export COMPOSE_PROFILES

# Elastic stack image tag, shared by elasticsearch/logstash/kibana (the log
# shipper is Vector, pinned separately in docker-compose.yml)
STACK_VERSION ?= 8.17.0
export STACK_VERSION

# Profiles torn down by down/downv/purge, regardless of which profile is
# currently active — otherwise ELK/local-profile/tester containers survive teardown
# (an interrupted `run --rm tester` would also keep the networks in use).
DOWN_PROFILES = local,cloud,elk,test

# Actual container_name values from docker-compose.yml — NOT the compose service
# names. The two differ (service `api-gateway` runs as container
# `ft_transcendence_api_gateway`, and `ollama` has no prefix at all), so deriving
# one from the other silently matched nothing.
TRANSCENDENCE_CONTAINERS = ft_transcendence_nginx ft_transcendence_litellm ollama ft_transcendence_ai_service ft_transcendence_classification_service ft_transcendence_auth_service ft_transcendence_user_service ft_transcendence_redis ft_transcendence_db ft_transcendence_api_gateway ft_transcendence_recommendation_service ft_transcendence_elk_setup ft_transcendence_elasticsearch ft_transcendence_logstash ft_transcendence_kibana ft_transcendence_vector

TRANSCENDENCE_VOLUMES = $(PROJECT_NAME)_db-data $(PROJECT_NAME)_redis-data $(PROJECT_NAME)_ollama $(PROJECT_NAME)_models $(PROJECT_NAME)_ai-chroma-data $(PROJECT_NAME)_huggingface-cache $(PROJECT_NAME)_es-data $(PROJECT_NAME)_elk-certs $(PROJECT_NAME)_elk-snapshots $(PROJECT_NAME)_vector-data $(PROJECT_NAME)_nginx-ssl

# Compose prefixes each network in the `networks:` block with the project name.
# The old value named a `transcendence_network` that this compose file has never
# declared, so the removal loop was a no-op.
TRANSCENDENCE_NETWORKS = $(PROJECT_NAME)_proxy $(PROJECT_NAME)_backend-network

# Flags consumed as extra goals by 'make test' and forwarded to run-unit-tests.sh
TEST_FLAGS = gateway auth user ai classification recommendation init

.PHONY: all setup build up keys env trash show stop start down restart re clean fclean help test test-coverage gate test-rag elk elk-creds $(TEST_FLAGS)

# Default target
all: build up elk show logs

## init: Init target for setting up environment and running tests
init: build up migration seed superuser rag

## build: Build all images
build:
	@echo "Building ft_transcendence images..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --parallel
	@echo "✅ Images built successfully!"

## build-zero: Build all images with no cache
build-zero:
	@echo "Building ft_transcendence images with no cache..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --no-cache --parallel
	@echo "✅ Images built successfully with no cache!"

## build-%: Build specific service
build-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build $*

## build-zero-%: Build specific service with no cache
build-zero-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --no-cache $*

## env: Create every missing .env from its .env.example, with consistent random secrets (never overwrites)
env:
	@scripts/bootstrap-env.sh

## keys: Generate the JWT key pair if it is missing (idempotent; `make up` runs it for you)
keys:
	@srcs/auth-service/keys/generate-keys.sh

## up: Generate the JWT keys if missing, then start all services
up: keys
	@echo "Starting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d
	@echo ""
	@echo "✅ ft_transcendence is running!"
	@echo "🌐 Access the application at: https://localhost:8443"
	@echo "📊 View logs with: make logs"
	@echo ""

## up-dev: Like `up`, plus the API gateway on http://127.0.0.1:8001 (dev/test only)
# Declared explicitly so it wins over the `up-%` pattern rule below, which would
# otherwise read it as "start a service called dev". The plaintext port is for the
# Jupyter notebooks and curl debugging; the application itself only uses nginx.
up-dev: keys
	@echo "Starting ft_transcendence (dev: gateway also on http://127.0.0.1:8001)..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) -f docker-compose.dev.yml up -d
	@echo ""
	@echo "✅ ft_transcendence is running!"
	@echo "🌐 Application: https://localhost:8443"
	@echo "🔧 Dev-only plaintext gateway: http://127.0.0.1:8001 (never used by the app)"
	@echo ""

## up-%: Start specific service (generates the JWT keys first if missing)
up-%: keys
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up $* -d

## show: Show system status
show:
	@echo "============= ft_transcendence Status ============="
	@echo "Containers:"
	@docker ps --filter "name=$(PROJECT_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "Networks:"
	@docker network ls --filter "name=$(PROJECT_NAME)" --format "table {{.Name}}\t{{.Driver}}"
	@echo ""
	@echo "Volumes:"
	@docker volume ls --filter "name=$(PROJECT_NAME)" --format "table {{.Name}}\t{{.Driver}}"
	@echo "=================================================="

## stop: Stop all services
stop:
	@echo "Stopping ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) stop

## stop-%: Stop specific service
stop-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) stop $*

## start: Start stopped services
start:
	@echo "Starting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) start

## start-%: Start specific service
start-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) start $*

## down: Stop and remove containers
down:
	@echo "Stopping and removing ft_transcendence containers..."
	@COMPOSE_PROFILES=$(DOWN_PROFILES) $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down

## downv: Stop and remove containers and volumes
downv:
	@echo "Stopping and removing ft_transcendence containers and volumes..."
	@COMPOSE_PROFILES=$(DOWN_PROFILES) $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v

## downv-%: Stop and remove specific service containers
downv-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v $*

## down-%: Stop and remove specific service containers
down-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down $*

## restart: Restart services
restart:
	@echo "Restarting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart

## restart-%: Restart specific service
restart-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart $*

## logs: View logs for all services
logs:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f

## logs-%: View logs for specific service
logs-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f $*

## purge: Full cleanup of containers, images, volumes, networks
# PURGE_RMI=local (default) removes only the images compose built; `make trash` passes
# PURGE_RMI=all to also remove the pulled ones (postgres, redis, litellm, elastic, ...).
PURGE_RMI ?= local
purge:
	@echo "Full cleanup of ft_transcendence resources..."
	@echo "Stopping and removing containers, volumes and locally built images..."
	@# --rmi local (the default) removes exactly the images compose built for this project,
	@# whatever they are tagged. The previous loop guessed tag names (and got
	@# them wrong), then fell back to `docker rmi -f $$service` on bare names
	@# like `redis` and `nginx` — which deleted the host's unrelated
	@# redis:latest / nginx:latest. Errors are no longer sent to /dev/null:
	@# hiding them is what let a failed teardown look like a successful one.
	@COMPOSE_PROFILES=$(DOWN_PROFILES) $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v --rmi $(PURGE_RMI) --remove-orphans || true
	@echo "Removing any leftover ft_transcendence containers..."
	@for container in $(TRANSCENDENCE_CONTAINERS); do \
		docker rm -f $$container 2>/dev/null || true; \
	done
	@echo "Removing ft_transcendence volumes..."
	@for volume in $(TRANSCENDENCE_VOLUMES); do \
		docker volume rm $$volume 2>/dev/null || true; \
	done
	@echo "Removing ft_transcendence networks..."
	@for network in $(TRANSCENDENCE_NETWORKS); do \
		docker network rm $$network 2>/dev/null || true; \
	done
	@echo "Removing dangling images and build cache..."
	@docker image prune -f --filter "label=project=$(PROJECT_NAME)" 2>/dev/null || true
	@echo "✅ Full cleanup completed!"

## trash: From-scratch start: cloud (Mistral) profile + ELK. Checks MISTRAL_API_KEY, then deletes
##        every volume, image and the build cache, checks free disk, creates missing .env files and
##        JWT keys, rebuilds, seeds, starts ELK
# The profile is forced: this target is defined as "the Mistral stack", whatever the
# command line or .env says. The key is checked BEFORE the purge, so a missing key
# never costs you your data.
trash: override COMPOSE_PROFILES := cloud
trash:
	@echo "[1/9] .env files"
	@scripts/bootstrap-env.sh
	@echo "[2/9] Prerequisites and MISTRAL_API_KEY"
	@scripts/preflight.sh
	@echo "[3/9] Deleting every ft_transcendence container, volume, network and image"
	@$(MAKE) --no-print-directory purge PURGE_RMI=all
	@# --no-cache builds still WRITE a full set of cache layers that nothing reuses; left alone they
	@# piled up to 40+ GB, filled the disk, and Elasticsearch then refused to allocate any shard.
	@echo "      Pruning the Docker build cache"
	@docker builder prune -af
	@scripts/preflight.sh --disk
	@echo "[4/9] JWT keys"
	@$(MAKE) --no-print-directory keys
	@echo "[5/9] Building images from scratch (no cache, fresh base images)"
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --no-cache --pull
	@# The build just wrote ~13 GB of cache that only a later incremental `make build` could reuse;
	@# `make trash` is a cold start by definition, so drop it rather than leave it on the disk.
	@docker builder prune -af
	@echo "[6/9] Starting the stack and waiting for healthchecks (first boot downloads ~1.3 GB of models)"
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d --wait --wait-timeout 900
	@echo "[7/9] Migrations, product catalog, admin account"
	@scripts/run-migrations.sh
	@scripts/seed-db.sh
	@scripts/create-superuser.sh
	@echo "[8/9] RAG knowledge base"
	@scripts/init-rag-kb.sh
	@echo "[9/9] Observability (Elasticsearch, Logstash, Kibana, Vector)"
	@scripts/init-elk.sh
	@echo ""
	@echo "✅ SmartBreeds is running from scratch (cloud profile + ELK)"
	@echo "   App:    https://localhost:8443   (self-signed certificate: accept the browser warning)"
	@echo "   Admin:  test_admin@example.com / Password123!"
	@echo "   Kibana: https://localhost:5601   (user 'elastic', password: make elk-creds)"

## re: Rebuild everything soft
re: down all

## ref: Rebuild everything
ref: purge all

## exec-%: Execute commands in containers
exec-%:
	@docker exec -it $(PROJECT_NAME)_$* /bin/sh

## migration: Migrate database
migration:
	@echo "Running database migrations..."
	@scripts/run-migrations.sh

## seed: Seed initial data
seed:
	@echo "Seeding initial data..."
	@scripts/seed-db.sh

## rag: Setup RAG knowledge base
rag:
	@echo "Starting RAG setup..."
	@scripts/init-rag-kb.sh

## e2e: Real vision analysis on the bundled test images, through nginx over verified HTTPS
# Needs the stack up (incl. classification-service) and MISTRAL_API_KEY in the root .env.
# Registers and then deletes a throwaway user. Stdlib-only Python: no venv required.
e2e:
	@python3 scripts/e2e-vision.py

## test-rag: Knowledge base auto-ingestion end to end (also part of `make gate`)
# Needs the stack up. Adds, modifies and deletes a probe .md in the knowledge base
# directory and checks ai-service picks each change up without a restart.
test-rag:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --profile test run --rm --build tester pytest e2e/test_rag_autoingest.py -v

## superuser: Create superuser
superuser:
	@echo "Creating superuser..."
	@scripts/create-superuser.sh

## test: Run unit tests (args: make test auth user ai classification recommendation)
test:
	@echo "Running tests..."
	@scripts/init-and-test.sh $(foreach a,$(wordlist 2,99,$(MAKECMDGOALS)),--$(a))

## elk: Start the ELK logging stack (generates credentials on first run)
elk:
	@scripts/init-elk.sh

## elk-creds: Reprint the ELK stack credentials
elk-creds:
	@scripts/init-elk.sh --creds-only

## test-integration: Run integration tests
test-integration:
	@echo "Running integration tests..."
	@scripts/run-integration-tests.sh

## gate: Merge gate — unit + integration + e2e on the running stack. Must be green before any merge;
##       paste the last lines into the PR.
gate: keys
	@echo "Starting the stack and waiting for healthchecks (classification can take ~5 min cold)..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d --build --wait --wait-timeout 600
	@# The gate must test HEAD, not what is already running: --build picks up baked-in code, and
	@# these FastAPI services bind-mount their code but run without --reload, so they are restarted.
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d --force-recreate --no-deps --wait --wait-timeout 600 api-gateway ai-service recommendation-service
	@# nginx resolves api-gateway once at startup: after the gateway is recreated (new IP) it
	@# would keep proxying to the old address and answer 502, so restart it too.
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart nginx
	@scripts/run-migrations.sh
	@scripts/seed-db.sh
	@scripts/create-superuser.sh
	@scripts/run-unit-tests.sh
	@scripts/run-integration-tests.sh
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --profile test run --rm --build tester
	@echo ""
	@echo "✅ GATE PASSED — $$(git rev-parse --abbrev-ref HEAD) @ $$(git rev-parse --short HEAD)$$(git diff --quiet HEAD || echo ' (uncommitted changes)')"

$(TEST_FLAGS):
	@:

## help: Help target
help: Makefile
	@sed -n 's/^##//p' $<