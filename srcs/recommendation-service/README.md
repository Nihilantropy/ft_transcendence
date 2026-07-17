# Recommendation Service

ML-powered food recommendation service using content-based filtering.

## Features

- Weighted cosine similarity for pet-product compatibility
- Health condition prioritization (40% weight)
- Explainable recommendations with match reasons
- Evolution path to supervised learning

## Technology Stack

- FastAPI 0.110+ (async API)
- scikit-learn 1.4+ (similarity algorithm)
- NumPy 1.26+ (vector operations)
- SQLAlchemy 2.0+ (async ORM)
- PostgreSQL 15+ (product catalog)

## Development

### Setup
```bash
# Build and start service
docker compose build recommendation-service
docker compose up recommendation-service -d

# Validate environment
docker exec ft_transcendence_recommendation_service python scripts/validate_env.py
```

### Testing

**Unit Tests (30 tests)** - Run automatically, isolated, fast:
```bash
# Run all unit tests (recommended)
docker compose run --rm recommendation-service pytest tests/unit/ -v

# Run with coverage
docker compose run --rm recommendation-service pytest tests/unit/ --cov=src --cov-report=html

# Single test file
docker compose run --rm recommendation-service pytest tests/unit/test_models.py -v
```

**Integration Tests (25 tests)** - Run manually, requires all services running:
```bash
# Prerequisites:
# 1. All services running: make up
# 2. Migrations applied: make migration
# 3. Seed data loaded: docker exec ft_transcendence_recommendation_service python scripts/seed_products.py
# 4. Admin user created: docker exec ft_transcendence_auth_service python manage.py createsuperuser

# Run all integration tests
docker compose run --rm recommendation-service pytest tests/integration/ -v

# Run specific test file
docker compose run --rm recommendation-service pytest tests/integration/test_recommendations_e2e.py -v

# See tests/integration/README.md for details
```

**⚠️ IMPORTANT:** Do NOT run `pytest tests/ -v` - this runs both unit and integration tests together, which is not recommended.

### Migrations
```bash
# Run migrations
make migration

# Or manually
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < srcs/recommendation-service/migrations/001_create_schema.sql
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql
```

## API Endpoints

### Recommendations
- `GET /api/v1/recommendations/food?pet_id=123` - Get food recommendations

### Admin (requires admin role)
- `POST /api/v1/admin/products` - Create product
- `PUT /api/v1/admin/products/{id}` - Update product
- `DELETE /api/v1/admin/products/{id}` - Delete product
- `GET /api/v1/admin/products` - List products

## Architecture

See `docs/plans/2026-02-02-recommendation-service-design.md` for detailed design.
