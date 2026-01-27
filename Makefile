.DEFAULT_GOAL := help

DOCKER_COMPOSE = docker compose
COMPOSE_FILE = docker-compose.yml
PROJECT_NAME = ft_transcendence

# ft_transcendence service names
TRANSCENDENCE_SERVICES = nginx frontend backend db

TRANSCENDENCE_VOLUMES = $(PROJECT_NAME)_db-data $(PROJECT_NAME)_frontend-data

TRANSCENDENCE_NETWORKS = $(PROJECT_NAME)_transcendence_network

.PHONY: all setup build up show stop start down restart re clean fclean help test test-coverage

# Default target
all: build up show logs

# Setup (simplified - no complex data directories needed)
setup:
	@echo "Setting up ft_transcendence environment..."
	@echo "Checking Docker and Docker Compose..."
	@docker --version >/dev/null 2>&1 || (echo "❌ Docker not found" && exit 1)
	@docker compose version >/dev/null 2>&1 || (echo "❌ Docker Compose not found" && exit 1)
	@echo "✅ Environment ready!"

# Build all images
build:
	@echo "Building ft_transcendence images..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --parallel
	@echo "✅ Images built successfully!"

# Start all services
up:
	@echo "Starting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d
	@echo ""
	@echo "✅ ft_transcendence is running!"
	@echo "🌐 Access the application at: https://localhost"
	@echo "📊 View logs with: make logs"
	@echo ""

up-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up $* -d

# Show system status
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

# Service management
stop:
	@echo "Stopping ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) stop

start:
	@echo "Starting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) start

down:
	@echo "Stopping and removing ft_transcendence containers..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down

restart:
	@echo "Restarting ft_transcendence..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart

# Logs management
logs:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f

logs-%:
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f $*

# Clean operations
clean:
	@echo "Cleaning ft_transcendence containers and networks..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v
	@echo "✅ Containers and networks cleaned!"

fclean:
	@echo "Full cleanup of ft_transcendence resources..."
	@echo "Stopping and removing containers..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v 2>/dev/null || true
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

# Rebuild everything soft
re: clean all

# Rebuild everything
ref: fclean all

# Development helpers
dev:
	@echo "Starting ft_transcendence in development mode..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up

# Execute commands in containers
exec-%:
	@docker exec -it $(PROJECT_NAME)_$* /bin/sh

migration:
	@echo "Running database migrations..."
	@scripts/run-migrations.sh

test:
	@echo "Running tests..."
	@scripts/init-and-test.sh

# Help target
help:
	@echo "ft_transcendence - Docker Management Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  all          - Build and start all services (default)"
	@echo "  up           - Start all services"
	@echo "  down         - Stop and remove containers"
	@echo "  restart      - Restart all services"
	@echo "  show         - Show system status"
	@echo ""
	@echo "Build targets:"
	@echo "  build        - Build all Docker images"
	@echo "  setup        - Setup environment"
	@echo ""
	@echo "Logs targets:"
	@echo "  logs         - View all logs"
	@echo "  logs-SERVICE - View logs for specific service"
	@echo ""
	@echo "Clean targets:"
	@echo "  clean        - Remove containers and networks"
	@echo "  fclean       - Full cleanup (images, volumes, etc.)"
	@echo "  re           - Soft rebuild (clean + all)"
	@echo "  ref          - Full rebuild (fclean + all)"
	@echo ""
	@echo "Development targets:"
	@echo "  dev          - Start in development mode (foreground)"
	@echo "  exec-SERVICE - Shell into service container"