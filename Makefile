# ft_transcendence Makefile - Refactored from Inception structure
# Docker management for ft_transcendence project

# Docker compose configuration
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

# Rebuild everything
re: fclean all

# Development helpers
dev:
	@echo "Starting ft_transcendence in development mode..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up

# Execute commands in containers
exec-%:
	@docker exec -it $(PROJECT_NAME)_$* /bin/sh

# Database management
db-shell:
	@docker exec -it $(PROJECT_NAME)_database sqlite3 /data/transcendence.db

db-backup:
	@mkdir -p backups
	@docker exec $(PROJECT_NAME)_database sqlite3 /data/transcendence.db ".backup /data/backup.db"
	@docker cp $(PROJECT_NAME)_database:/data/backup.db ./backups/transcendence_$(shell date +%Y%m%d_%H%M%S).db
	@echo "✅ Database backed up to ./backups/"

# Health checks
health:
	@echo "Checking ft_transcendence health..."
	@curl -f -k https://localhost/health 2>/dev/null && echo "✅ Application healthy" || echo "❌ Application unhealthy"

# Testing targets
TESTABLE_SERVICES = auth-service user-service api-gateway

test:
	@echo "Running tests for all microservices..."
	@for service in $(TESTABLE_SERVICES); do \
		echo ""; \
		echo "========================================"; \
		echo "Testing $$service..."; \
		echo "========================================"; \
		cd srcs/$$service && npm test || exit 1; \
	done
	@echo ""
	@echo "✅ All tests passed!"

test-%:
	@echo "Running tests for $*..."
	@if [ ! -f "srcs/$*/package.json" ]; then \
		echo "❌ Service $* not found or has no package.json"; \
		exit 1; \
	fi
	@if ! grep -q '"test"' "srcs/$*/package.json" 2>/dev/null; then \
		echo "❌ Service $* has no test script configured"; \
		exit 1; \
	fi
	@cd srcs/$* && npm test

test-coverage:
	@echo "Running tests with coverage for all microservices..."
	@for service in $(TESTABLE_SERVICES); do \
		echo ""; \
		echo "========================================"; \
		echo "Coverage for $$service..."; \
		echo "========================================"; \
		cd srcs/$$service && npm run test:coverage || exit 1; \
	done
	@echo ""
	@echo "✅ All tests with coverage completed!"

test-coverage-%:
	@echo "Running tests with coverage for $*..."
	@if [ ! -f "srcs/$*/package.json" ]; then \
		echo "❌ Service $* not found or has no package.json"; \
		exit 1; \
	fi
	@if ! grep -q '"test:coverage"' "srcs/$*/package.json" 2>/dev/null; then \
		echo "❌ Service $* has no test:coverage script configured"; \
		exit 1; \
	fi
	@cd srcs/$* && npm run test:coverage

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
	@echo "  re           - Full rebuild (fclean + all)"
	@echo ""
	@echo "Development targets:"
	@echo "  dev          - Start in development mode (foreground)"
	@echo "  exec-SERVICE - Shell into service container"
	@echo "  db-shell     - SQLite shell"
	@echo "  db-backup    - Backup database"
	@echo "  health       - Check application health"
	@echo ""
	@echo "Testing targets:"
	@echo "  test                - Run all tests for all microservices"
	@echo "  test-SERVICE        - Run tests for specific service (e.g., make test-auth-service)"
	@echo "  test-coverage       - Run all tests with coverage"
	@echo "  test-coverage-SERVICE - Run tests with coverage for specific service"
	@echo ""
	@echo "Services: nginx, backend, frontend, database"
	@echo "Testable services: auth-service, user-service, api-gateway"