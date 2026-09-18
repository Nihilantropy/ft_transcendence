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
# currently active — otherwise ELK/local-profile containers survive teardown.
DOWN_PROFILES = local,cloud,elk

# Actual container_name values from docker-compose.yml — NOT the compose service
# names. The two differ (service `api-gateway` runs as container
# `ft_transcendence_api_gateway`, and `ollama` has no prefix at all), so deriving
# one from the other silently matched nothing.
TRANSCENDENCE_CONTAINERS = ft_transcendence_nginx ft_transcendence_litellm ollama ft_transcendence_ai_service ft_transcendence_classification_service ft_transcendence_auth_service ft_transcendence_user_service ft_transcendence_redis ft_transcendence_db ft_transcendence_api_gateway ft_transcendence_recommendation_service ft_transcendence_elk_setup ft_transcendence_elasticsearch ft_transcendence_logstash ft_transcendence_kibana ft_transcendence_vector

TRANSCENDENCE_VOLUMES = $(PROJECT_NAME)_db-data $(PROJECT_NAME)_redis-data $(PROJECT_NAME)_ollama $(PROJECT_NAME)_models $(PROJECT_NAME)_ai-chroma-data $(PROJECT_NAME)_huggingface-cache $(PROJECT_NAME)_es-data $(PROJECT_NAME)_elk-certs $(PROJECT_NAME)_elk-snapshots $(PROJECT_NAME)_vector-data

# Compose prefixes each network in the `networks:` block with the project name.
# The old value named a `transcendence_network` that this compose file has never
# declared, so the removal loop was a no-op.
TRANSCENDENCE_NETWORKS = $(PROJECT_NAME)_proxy $(PROJECT_NAME)_backend-network

# Flags consumed as extra goals by 'make test' and forwarded to run-unit-tests.sh
TEST_FLAGS = gateway auth user ai classification recommendation init

.PHONY: all setup build up show stop start down restart re clean fclean help test test-coverage elk elk-creds $(TEST_FLAGS)

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

## up: Start all services
up:
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
up-dev:
	@echo "Starting ft_transcendence (dev: gateway also on http://127.0.0.1:8001)..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) -f docker-compose.dev.yml up -d
	@echo ""
	@echo "✅ ft_transcendence is running!"
	@echo "🌐 Application: https://localhost:8443"
	@echo "🔧 Dev-only plaintext gateway: http://127.0.0.1:8001 (never used by the app)"
	@echo ""

## up-%: Start specific service
up-%:
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
purge:
	@echo "Full cleanup of ft_transcendence resources..."
	@echo "Stopping and removing containers, volumes and locally built images..."
	@# --rmi local removes exactly the images compose built for this project,
	@# whatever they are tagged. The previous loop guessed tag names (and got
	@# them wrong), then fell back to `docker rmi -f $$service` on bare names
	@# like `redis` and `nginx` — which deleted the host's unrelated
	@# redis:latest / nginx:latest. Errors are no longer sent to /dev/null:
	@# hiding them is what let a failed teardown look like a successful one.
	@COMPOSE_PROFILES=$(DOWN_PROFILES) $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v --rmi local --remove-orphans || true
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

$(TEST_FLAGS):
	@:

## help: Help target
help: Makefile
	@sed -n 's/^##//p' $<