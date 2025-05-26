# ft_transcendence Makefile
# Single command to run the entire application

.PHONY: all build up down restart logs clean fclean re help

# Default target
all: up

# Build all Docker images
build:
	@echo "Building Docker images..."
	@docker compose build

# Start all services
up:
	@echo "Starting ft_transcendence..."
	@docker compose up -d
	@echo ""
	@echo "✅ ft_transcendence is running!"
	@echo "🌐 Access the application at: https://localhost"
	@echo "📊 View logs with: make logs"
	@echo ""

# Stop all services
down:
	@echo "Stopping ft_transcendence..."
	@docker compose down

# Restart all services
restart: down up

# View logs
logs:
	@docker compose logs -f

# View logs for specific service
logs-%:
	@docker compose logs -f $*

# Clean up containers and networks
clean:
	@echo "Cleaning up containers and networks..."
	@docker compose down -v

# Full clean including images (only ft_transcendence project)
fclean: clean
	@echo "Removing ft_transcendence Docker images..."
	@docker compose down --rmi all -v
	@echo "Cleaning up any remaining ft_transcendence images..."
	@docker images --filter "reference=ft_transcendence*" -q | xargs -r docker rmi -f 2>/dev/null || true
	@docker images --filter "reference=*ft_transcendence*" -q | xargs -r docker rmi -f 2>/dev/null || true
	@echo "Removing unused networks and volumes for this project..."
	@docker network prune -f --filter "label=com.docker.compose.project=ft_transcendence" 2>/dev/null || true
	@docker volume prune -f --filter "label=com.docker.compose.project=ft_transcendence" 2>/dev/null || true

# Rebuild everything
re: fclean build up

# Development helpers
dev:
	@echo "Starting in development mode..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Execute commands in containers
exec-%:
	@docker compose exec $* /bin/sh

# Database management
db-shell:
	@docker compose exec database sqlite3 /data/transcendence.db

db-backup:
	@mkdir -p backups
	@docker compose exec database sqlite3 /data/transcendence.db ".backup /data/backup.db"
	@docker cp ft_transcendence_database:/data/backup.db ./backups/transcendence_$(shell date +%Y%m%d_%H%M%S).db
	@echo "Database backed up to ./backups/"

# Security check
security-check:
	@echo "Running security checks..."
	@docker compose exec backend sh -c "grep -r 'password' /app --exclude-dir=node_modules --exclude-dir=.git || true"
	@echo "Checking for exposed ports..."
	@docker compose ps

# Help
help:
	@echo "ft_transcendence - Docker Management"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  all/up       - Start all services (default)"
	@echo "  down         - Stop all services"
	@echo "  restart      - Restart all services"
	@echo "  logs         - View all logs"
	@echo "  logs-SERVICE - View logs for specific service"
	@echo ""
	@echo "Maintenance targets:"
	@echo "  build        - Build Docker images"
	@echo "  clean        - Remove containers and volumes"
	@echo "  fclean       - Full clean including images (project only)"
	@echo "  re           - Full rebuild"
	@echo ""
	@echo "Development targets:"
	@echo "  dev          - Start in development mode"
	@echo "  exec-SERVICE - Shell into service container"
	@echo "  db-shell     - SQLite shell"
	@echo "  db-backup    - Backup database"
	@echo ""
	@echo "Services: nginx, backend, frontend, database"