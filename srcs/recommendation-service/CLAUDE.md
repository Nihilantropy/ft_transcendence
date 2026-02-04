# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

FastAPI microservice for content-based product recommendations. Uses a 15-dimensional
feature vector with weighted cosine similarity to match pet profiles to products.

**Port:** 3005 (internal, accessed via API Gateway)

**Volume mount:** Full source (`./srcs/recommendation-service:/app`) — no `--reload` flag.
Code changes require `docker compose restart recommendation-service`.

## Commands

### Testing

```bash
# Unit tests (30 tests) — run --rm works fine for these
docker compose run --rm recommendation-service python -m pytest tests/unit/ -v

# Integration tests (23 tests) — MUST use docker exec (need other services reachable by hostname)
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v

# All tests (53 total)
docker exec ft_transcendence_recommendation_service python -m pytest tests/ -v
```

**Integration test prereqs:** `docker compose up -d` first. Tests hit API Gateway at
`http://api-gateway:8001` — that hostname only resolves inside the backend-network.

### Seed Data

```bash
# Seed products (run once after migrations)
docker exec ft_transcendence_recommendation_service python scripts/test_seed_products.py
```

## Architecture

### Project Structure

```
src/
  main.py                      # FastAPI app, lifespan (DB init)
  config.py                    # Pydantic Settings, weight vector
  routes/
    recommendations.py         # GET /api/v1/recommendations/food
    admin.py                   # CRUD /api/v1/admin/products
  schemas/
    recommendations.py         # PetProfile, RecommendationItem, NutritionalHighlights
    products.py                # ProductCreate, ProductUpdate, ProductResponse
  services/
    user_service_client.py     # HTTP client → user-service (direct, not via gateway)
    product_service.py         # SQLAlchemy product queries
    feature_engineering.py     # PetFeatureExtractor, ProductFeatureExtractor (15-dim vectors)
    similarity_engine.py       # Weighted cosine similarity, ranking
  models/
    product.py                 # SQLAlchemy Product model
  utils/
    database.py                # Async SQLAlchemy engine/session
    responses.py               # success_response / error_response helpers
scripts/
  seed_products.py             # Seed 14 sample products (8 dog, 6 cat)
tests/
  unit/                        # 30 tests — mock all external deps
  integration/                 # 23 tests — hit real API Gateway, real DB
migrations/                    # Raw SQL (not Alembic)
```

### Cross-Service Field Name Contract

**CRITICAL:** User-service Pet model fields have no unit suffixes:
- `age` (int) — NOT `age_months`
- `weight` (float) — NOT `weight_kg`

`PetCreateSerializer` fields: `[name, species, breed, age, weight, health_conditions]`
DRF silently drops any field not in this list. Sending `age_months` results in `age: null`.

`recommendations.py` maps these at the boundary after fetching from user-service:
```python
pet_data["age_months"] = pet_data.get("age")
pet_data["weight_kg"] = pet_data.get("weight")
```

### Recommendation Pipeline

1. Fetch pet profile from user-service (direct HTTP, X-User-ID header)
2. Load active products filtered by species
3. Extract 15-dim feature vectors (pet + each product)
4. Weighted cosine similarity (health conditions at 40% weight)
5. Filter by `min_score`, take top `limit`, attach match reasons + nutritional highlights

### API Endpoints

- `GET /api/v1/recommendations/food?pet_id=UUID&limit=N&min_score=F` — ranked recommendations
- `GET /api/v1/admin/products` — list products (species filter, limit)
- `POST /api/v1/admin/products` — create product
- `GET /api/v1/admin/products/{id}` — get product
- `PUT /api/v1/admin/products/{id}` — update product
- `DELETE /api/v1/admin/products/{id}` — soft delete (sets is_active=False)

## Current State

**Status:** 53 passing tests (30 unit + 23 integration)
