#!/bin/bash
# Run Django/FastAPI migrations in correct order
# Auth service MUST run first (creates auth_schema.users)
# User service runs second (depends on auth_schema.users)
# Recommendation service runs last (depends on user-service)

set -e

echo "=== SmartBreeds Migration Script ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Wait for database to be ready
echo -e "${YELLOW}[1/5] Waiting for database to be ready...${NC}"
until docker exec ft_transcendence_db pg_isready -U smartbreeds_user -d smartbreeds > /dev/null 2>&1; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo -e "${GREEN}✓ Database ready${NC}"
echo ""

# Wait for auth-service to be healthy
echo -e "${YELLOW}[2/5] Waiting for auth-service to be healthy...${NC}"
max_attempts=30
attempt=0
until docker exec ft_transcendence_auth_service curl -f http://localhost:3001/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo -e "${RED}✗ Auth service failed to become healthy${NC}"
    exit 1
  fi
  echo "Auth service not ready, waiting... (attempt $attempt/$max_attempts)"
  sleep 2
done
echo -e "${GREEN}✓ Auth service healthy${NC}"
echo ""

# Run auth-service migrations (MUST be first)
echo -e "${YELLOW}[3/5] Running auth-service migrations...${NC}"
docker exec ft_transcendence_auth_service python manage.py makemigrations
docker exec ft_transcendence_auth_service python manage.py migrate
echo -e "${GREEN}✓ Auth service migrations complete${NC}"
echo ""

# Wait for user-service to be available
echo -e "${YELLOW}[4/5] Waiting for user-service to be available...${NC}"
max_attempts=30
attempt=0
until docker exec ft_transcendence_user_service python --version > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo -e "${RED}✗ User service failed to become available${NC}"
    exit 1
  fi
  echo "User service not ready, waiting... (attempt $attempt/$max_attempts)"
  sleep 2
done
echo -e "${GREEN}✓ User service available${NC}"
echo ""

# Run user-service migrations (depends on auth_schema.users)
echo -e "${YELLOW}[5/5] Running user-service migrations...${NC}"
docker exec ft_transcendence_user_service python manage.py makemigrations
docker exec ft_transcendence_user_service python manage.py migrate
echo -e "${GREEN}✓ User service migrations complete${NC}"
echo ""

# Wait for recommendation-service to be healthy
echo -e "${YELLOW}[6/6] Waiting for recommendation-service to be healthy...${NC}"
max_attempts=30
attempt=0
until docker exec ft_transcendence_recommendation_service curl -f http://localhost:3005/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo -e "${RED}✗ recommendation service failed to become healthy${NC}"
    exit 1
  fi
  echo "Recommendation service not ready, waiting... (attempt $attempt/$max_attempts)"
  sleep 2
done
echo -e "${GREEN}✓ Recommendation service healthy${NC}"
echo ""

# Run recommendation-service migrations (depends on user-service)
echo -e "${YELLOW}[6/6] Running recommendation-service migrations...${NC}"
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < srcs/recommendation-service/migrations/001_create_schema.sql
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql
echo -e "${GREEN}✓ Recommendation service migrations complete (smartbreeds)${NC}"
echo ""

echo -e "${GREEN}=== All migrations completed successfully ===${NC}"
