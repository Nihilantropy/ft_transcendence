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
```bash
# Run all tests
docker compose run --rm recommendation-service pytest tests/ -v

# Run unit tests only
docker compose run --rm recommendation-service pytest tests/unit/ -v

# Run with coverage
docker compose run --rm recommendation-service pytest tests/ --cov=src --cov-report=html

# Single test file
docker compose run --rm recommendation-service pytest tests/unit/test_models.py -v
```

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
