.DEFAULT_GOAL := help

DOCKER_COMPOSE = docker compose
COMPOSE_FILE = docker-compose.yml
PROJECT_NAME = ft_transcendence

# Compose profiles: 'local' = GPU stack (ollama + classification-service),
# 'cloud' = LiteLLM-only (hosted API key, no GPU). Override: make up COMPOSE_PROFILES=cloud
COMPOSE_PROFILES ?= cloud
export COMPOSE_PROFILES

# Elastic stack image tag, shared by elasticsearch/logstash/kibana/filebeat
STACK_VERSION ?= 8.17.0
export STACK_VERSION

# Profiles torn down by down/downv/purge, regardless of which profile is
# currently active — otherwise ELK/local-profile containers survive teardown.
DOWN_PROFILES = local,cloud,elk

# ft_transcendence service names
TRANSCENDENCE_SERVICES = nginx litellm ollama ai-service classification-service auth-service user-service redis db api-gateway recommendation-service elasticsearch logstash kibana filebeat elk-setup

TRANSCENDENCE_VOLUMES = $(PROJECT_NAME)_db-data $(PROJECT_NAME)_redis-data $(PROJECT_NAME)_ollama $(PROJECT_NAME)_models $(PROJECT_NAME)_ai-chroma-data $(PROJECT_NAME)_huggingface-cache $(PROJECT_NAME)_es-data $(PROJECT_NAME)_elk-certs $(PROJECT_NAME)_elk-snapshots $(PROJECT_NAME)_filebeat-data

TRANSCENDENCE_NETWORKS = $(PROJECT_NAME)_transcendence_network

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
	@echo "🌐 Access the application at: https://localhost"
	@echo "📊 View logs with: make logs"
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
	@echo "Stopping and removing containers..."
	@COMPOSE_PROFILES=$(DOWN_PROFILES) $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v 2>/dev/null || true
	@echo "Removing ft_transcendence containers..."
	@for service in $(TRANSCENDENCE_SERVICES); do \
		docker rm -f $(PROJECT_NAME)_$$service 2>/dev/null || true; \
	done
	@echo "Removing ft_transcendence images..."
	@for service in $(TRANSCENDENCE_SERVICES); do \
		docker rmi -f $(PROJECT_NAME)_$$service 2>/dev/null || true; \
		docker rmi -f $$service 2>/dev/null || true; \
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