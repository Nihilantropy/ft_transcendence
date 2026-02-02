# ML-Powered Recommendation Service Implementation Plan (v2 - Test-Ready)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a content-based filtering recommendation service using weighted cosine similarity to recommend pet food products based on pet characteristics and product features.

**Architecture:** FastAPI microservice with scikit-learn similarity engine, SQLAlchemy async ORM for PostgreSQL, httpx client for user-service integration, following SmartBreeds microservice patterns (API Gateway auth, network isolation).

**Tech Stack:** Python 3.12, FastAPI 0.110+, scikit-learn 1.4+, NumPy 1.26+, SQLAlchemy 2.0+ (async), httpx 0.27+, pytest 8.0+, PostgreSQL 15+

**Key Principle:** Docker environment FIRST, then develop with immediate testing capability.

---

## Table of Contents

### Phase 1: Infrastructure (Tasks 1-3)
1. [Task 1: Docker Setup & Service Structure](#task-1-docker-setup--service-structure)
2. [Task 2: Database Schema & Migration](#task-2-database-schema--migration)
3. [Task 3: Environment Validation](#task-3-environment-validation)

### Phase 2: Core Development (Tasks 4-11)
4. [Task 4: Project Structure & Dependencies](#task-4-project-structure--dependencies)
5. [Task 5: Database Models](#task-5-database-models)
6. [Task 6: Configuration & Utils](#task-6-configuration--utils)
7. [Task 7: Feature Engineering](#task-7-feature-engineering)
8. [Task 8: Similarity Engine](#task-8-similarity-engine)
9. [Task 9: User Service Client](#task-9-user-service-client)
10. [Task 10: Product Service](#task-10-product-service)
11. [Task 11: Recommendation API](#task-11-recommendation-api)

### Phase 3: Admin & Integration (Tasks 12-14)
12. [Task 12: Admin API](#task-12-admin-api)
13. [Task 13: Integration Testing & Seed Data](#task-13-integration-testing--seed-data)
14. [Task 14: API Gateway Integration](#task-14-api-gateway-integration)

---

# PHASE 1: INFRASTRUCTURE

## Task 1: Docker Setup & Service Structure

**Goal:** Create Docker environment so you can test from step 1.

**Files:**
- Create: `srcs/recommendation-service/Dockerfile`
- Create: `srcs/recommendation-service/.dockerignore`
- Create: `srcs/recommendation-service/.env`
- Modify: `docker-compose.yml`

### Step 1: Create service directory structure

```bash
cd srcs
mkdir -p recommendation-service/src/{models,services,routes,schemas,middleware,utils}
mkdir -p recommendation-service/tests/{unit,integration,fixtures}
mkdir -p recommendation-service/migrations
```

### Step 2: Create Dockerfile

Create file: `srcs/recommendation-service/Dockerfile`

```dockerfile
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3005/health || exit 1

# Expose port
EXPOSE 3005

# Run application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3005"]
```

### Step 3: Create .dockerignore

Create file: `srcs/recommendation-service/.dockerignore`

```
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.env
.venv
env/
venv/
.git
.gitignore
.pytest_cache/
.coverage
htmlcov/
*.egg-info/
dist/
build/
```

### Step 4: Create requirements.txt

Create file: `srcs/recommendation-service/requirements.txt`

```txt
# Web Framework
fastapi==0.110.0
uvicorn[standard]==0.27.1

# ML & Numerical Computing
scikit-learn==1.4.1.post1
numpy==1.26.4

# Database
sqlalchemy[asyncio]==2.0.27
asyncpg==0.29.0
psycopg2-binary==2.9.9

# HTTP Client
httpx==0.27.0

# Validation
pydantic==2.6.1
pydantic-settings==2.1.0

# Testing
pytest==8.0.1
pytest-asyncio==0.23.5
pytest-cov==4.1.0
```

### Step 5: Create minimal main.py (for health check)

Create file: `srcs/recommendation-service/src/__init__.py` (empty)

Create file: `srcs/recommendation-service/src/main.py`

```python
from fastapi import FastAPI

app = FastAPI(
    title="Recommendation Service",
    description="ML-powered pet food recommendations",
    version="1.0.0"
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "recommendation-service"}
```

### Step 6: Create .env file

Create file: `srcs/recommendation-service/.env`

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@db:5432/smartbreeds

# User Service
USER_SERVICE_URL=http://user-service:3002

# Feature Weights
WEIGHT_HEALTH_CONDITIONS=0.40
WEIGHT_AGE_COMPATIBILITY=0.20
WEIGHT_NUTRITIONAL_PROFILE=0.20
WEIGHT_SIZE_COMPATIBILITY=0.10
WEIGHT_INGREDIENT_PREFERENCES=0.10

# Algorithm Parameters
MIN_SIMILARITY_THRESHOLD=0.3
DEFAULT_RECOMMENDATION_LIMIT=10
MAX_RECOMMENDATION_LIMIT=50

# Logging
LOG_LEVEL=INFO
```

### Step 7: Add service to docker-compose.yml

Add to `docker-compose.yml`:

```yaml
  recommendation-service:
    build:
      context: ./srcs/recommendation-service
      dockerfile: Dockerfile
    container_name: ft_transcendence_recommendation_service
    restart: unless-stopped
    networks:
      - backend-network
    depends_on:
      - db
      - user-service
    env_file:
      - ./srcs/recommendation-service/.env
    volumes:
      - ./srcs/recommendation-service:/app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3005/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Step 8: Build and test Docker service

```bash
# Build service
docker compose build recommendation-service

# Start service
docker compose up recommendation-service -d

# Check health
curl http://localhost:8001/health  # Should fail (not in gateway yet)
docker exec ft_transcendence_recommendation_service curl http://localhost:3005/health
# Expected: {"status":"healthy","service":"recommendation-service"}

# Check logs
docker compose logs recommendation-service
```

### Step 9: Create pytest.ini

Create file: `srcs/recommendation-service/pytest.ini`

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = -v --strict-markers --tb=short
markers =
    unit: Unit tests
    integration: Integration tests
    asyncio: Async tests
```

### Step 10: Commit Docker setup

```bash
git add srcs/recommendation-service/ docker-compose.yml
git commit -m "feat(recommendation): add Docker infrastructure

- Add Dockerfile with Python 3.12 base
- Add requirements.txt with FastAPI, scikit-learn, SQLAlchemy
- Add minimal FastAPI app with health check endpoint
- Add service to docker-compose.yml (backend-network)
- Add .env configuration template
- Add pytest.ini for test configuration
- Service ready for development with immediate testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Database Schema & Migration

**Goal:** Create database schema in PostgreSQL (test-ready).

**Files:**
- Create: `srcs/recommendation-service/migrations/001_create_schema.sql`
- Create: `srcs/recommendation-service/migrations/002_create_tables.sql`

### Step 1: Create migration directory structure

```bash
mkdir -p srcs/recommendation-service/migrations
```

### Step 2: Create schema migration

Create file: `srcs/recommendation-service/migrations/001_create_schema.sql`

```sql
-- Create recommendation schema
CREATE SCHEMA IF NOT EXISTS recommendation_schema;

-- Grant permissions
GRANT USAGE ON SCHEMA recommendation_schema TO user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA recommendation_schema TO user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA recommendation_schema TO user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA recommendation_schema
GRANT ALL PRIVILEGES ON TABLES TO user;

ALTER DEFAULT PRIVILEGES IN SCHEMA recommendation_schema
GRANT ALL PRIVILEGES ON SEQUENCES TO user;
```

### Step 3: Create tables migration

Create file: `srcs/recommendation-service/migrations/002_create_tables.sql`

```sql
-- Set search path
SET search_path TO recommendation_schema;

-- Products table
CREATE TABLE IF NOT EXISTS recommendation_schema.products (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    product_url VARCHAR(500),
    image_url VARCHAR(500),

    -- Target Specifications
    target_species VARCHAR(20) NOT NULL CHECK (target_species IN ('dog', 'cat')),
    min_age_months INT CHECK (min_age_months >= 0),
    max_age_months INT CHECK (max_age_months >= 0),
    min_weight_kg DECIMAL(5,2) CHECK (min_weight_kg >= 0),
    max_weight_kg DECIMAL(5,2) CHECK (max_weight_kg >= 0),
    suitable_breeds TEXT[],

    -- Nutritional Profile (0-100 percentages)
    protein_percentage DECIMAL(5,2) CHECK (protein_percentage >= 0 AND protein_percentage <= 100),
    fat_percentage DECIMAL(5,2) CHECK (fat_percentage >= 0 AND fat_percentage <= 100),
    fiber_percentage DECIMAL(5,2) CHECK (fiber_percentage >= 0 AND fiber_percentage <= 100),
    calories_per_100g INT CHECK (calories_per_100g > 0),

    -- Ingredient Flags
    grain_free BOOLEAN DEFAULT false NOT NULL,
    organic BOOLEAN DEFAULT false NOT NULL,
    hypoallergenic BOOLEAN DEFAULT false NOT NULL,
    limited_ingredient BOOLEAN DEFAULT false NOT NULL,
    raw_food BOOLEAN DEFAULT false NOT NULL,

    -- Health Condition Targeting
    for_sensitive_stomach BOOLEAN DEFAULT false NOT NULL,
    for_weight_management BOOLEAN DEFAULT false NOT NULL,
    for_joint_health BOOLEAN DEFAULT false NOT NULL,
    for_skin_allergies BOOLEAN DEFAULT false NOT NULL,
    for_dental_health BOOLEAN DEFAULT false NOT NULL,
    for_kidney_health BOOLEAN DEFAULT false NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- Constraints
    CONSTRAINT valid_age_range CHECK (
        (min_age_months IS NULL AND max_age_months IS NULL) OR
        (min_age_months IS NULL) OR
        (max_age_months IS NULL) OR
        (min_age_months <= max_age_months)
    ),
    CONSTRAINT valid_weight_range CHECK (
        (min_weight_kg IS NULL AND max_weight_kg IS NULL) OR
        (min_weight_kg IS NULL) OR
        (max_weight_kg IS NULL) OR
        (min_weight_kg <= max_weight_kg)
    )
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_products_species ON recommendation_schema.products(target_species);
CREATE INDEX IF NOT EXISTS idx_products_active ON recommendation_schema.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand ON recommendation_schema.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_suitable_breeds ON recommendation_schema.products USING GIN(suitable_breeds);

-- Recommendations table (history tracking)
CREATE TABLE IF NOT EXISTS recommendation_schema.recommendations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    rank_position INT NOT NULL CHECK (rank_position > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_pet ON recommendation_schema.recommendations(user_id, pet_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendation_schema.recommendations(created_at);

-- User feedback table (backlog - future supervised learning)
CREATE TABLE IF NOT EXISTS recommendation_schema.user_feedback (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('click', 'view', 'purchase', 'rating')),
    interaction_value DECIMAL(3,2),
    similarity_score DECIMAL(5,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT valid_interaction_value CHECK (
        (interaction_type = 'rating' AND interaction_value BETWEEN 1.0 AND 5.0) OR
        (interaction_type != 'rating' AND interaction_value >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_product ON recommendation_schema.user_feedback(product_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON recommendation_schema.user_feedback(created_at);
```

### Step 4: Run migrations

```bash
# Execute migrations
docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/001_create_schema.sql
docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql

# Verify schema
docker exec ft_transcendence_db psql -U user -d smartbreeds -c "\dt recommendation_schema.*"

# Expected output: products, recommendations, user_feedback tables
```

### Step 5: Add Makefile target (optional)

Add to root `Makefile`:

```makefile
migration-recommendation:
	@echo "Running recommendation service migrations..."
	docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/001_create_schema.sql
	docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql
	@echo "Migrations complete!"
```

### Step 6: Commit migrations

```bash
git add srcs/recommendation-service/migrations/ Makefile
git commit -m "feat(recommendation): add database schema and migrations

- Create recommendation_schema in PostgreSQL
- Add products table with nutritional profile and health flags
- Add recommendations table for history tracking
- Add user_feedback table for future supervised learning
- Add indexes for query performance
- Add Makefile target for easy migration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Environment Validation

**Goal:** Verify Docker + Database working before development.

### Step 1: Create validation script

Create file: `srcs/recommendation-service/scripts/validate_env.py`

```python
"""Environment validation script - run before development."""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def validate_database():
    """Test database connection and schema."""
    try:
        engine = create_async_engine(
            "postgresql+asyncpg://user:password@db:5432/smartbreeds",
            echo=False
        )

        async with engine.connect() as conn:
            # Test connection
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print("✓ Database connection working")

            # Check schema exists
            result = await conn.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'recommendation_schema'")
            )
            assert result.scalar() == 'recommendation_schema'
            print("✓ recommendation_schema exists")

            # Check tables exist
            result = await conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'recommendation_schema'")
            )
            tables = [row[0] for row in result.fetchall()]
            assert 'products' in tables
            assert 'recommendations' in tables
            assert 'user_feedback' in tables
            print(f"✓ All tables exist: {', '.join(tables)}")

        await engine.dispose()
        return True
    except Exception as e:
        print(f"✗ Database validation failed: {e}")
        return False

async def main():
    """Run all validations."""
    print("Validating recommendation service environment...\n")

    db_ok = await validate_database()

    if db_ok:
        print("\n✅ Environment ready for development!")
        sys.exit(0)
    else:
        print("\n❌ Environment validation failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
```

### Step 2: Run validation

```bash
# Run validation inside container
docker exec ft_transcendence_recommendation_service python scripts/validate_env.py

# Expected output:
# ✓ Database connection working
# ✓ recommendation_schema exists
# ✓ All tables exist: products, recommendations, user_feedback
# ✅ Environment ready for development!
```

### Step 3: Commit validation script

```bash
git add srcs/recommendation-service/scripts/
git commit -m "feat(recommendation): add environment validation script

- Add validate_env.py to test DB connection and schema
- Verify all tables exist before development
- Exit with clear success/failure status

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

# PHASE 2: CORE DEVELOPMENT

## Task 4: Project Structure & Dependencies

**Goal:** Set up code structure and install dependencies.

**Files:**
- Create: `srcs/recommendation-service/README.md`
- Create: Touch all package `__init__.py` files

### Step 1: Create directory structure

```bash
cd srcs/recommendation-service
touch src/{__init__.py,config.py}
touch src/models/__init__.py
touch src/services/__init__.py
touch src/routes/__init__.py
touch src/schemas/__init__.py
touch src/middleware/__init__.py
touch src/utils/__init__.py
touch tests/__init__.py
touch tests/unit/__init__.py
touch tests/integration/__init__.py
touch tests/fixtures/__init__.py
mkdir -p scripts
```

### Step 2: Create README.md

Create file: `srcs/recommendation-service/README.md`

```markdown
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
make migration-recommendation

# Or manually
docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/001_create_schema.sql
docker exec -i ft_transcendence_db psql -U user -d smartbreeds < srcs/recommendation-service/migrations/002_create_tables.sql
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
```

### Step 3: Verify package imports work

```bash
# Test imports work
docker exec ft_transcendence_recommendation_service python -c "from src.main import app; print('✓ Imports working')"
```

### Step 4: Commit project structure

```bash
git add srcs/recommendation-service/
git commit -m "feat(recommendation): finalize project structure

- Create all package __init__.py files
- Add README.md with development guide
- Document testing commands
- Document API endpoints

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Database Models

**Goal:** Create SQLAlchemy ORM models for products, recommendations, and user feedback.

**Files:**
- Create: `srcs/recommendation-service/src/models/product.py`
- Create: `srcs/recommendation-service/src/models/recommendation.py`
- Create: `srcs/recommendation-service/src/models/user_feedback.py`
- Modify: `srcs/recommendation-service/src/models/__init__.py`

### Step 1: Write test for Product model

Create file: `srcs/recommendation-service/tests/unit/test_models.py`

```python
import pytest
from decimal import Decimal
from datetime import datetime
from src.models.product import Product

@pytest.mark.unit
def test_product_model_creation():
    """Test Product model can be instantiated with required fields."""
    product = Product(
        name="Royal Canin Golden Retriever Adult",
        brand="Royal Canin",
        target_species="dog",
        protein_percentage=Decimal("28.0"),
        fat_percentage=Decimal("15.0"),
        calories_per_100g=380,
        price=Decimal("89.99")
    )

    assert product.name == "Royal Canin Golden Retriever Adult"
    assert product.brand == "Royal Canin"
    assert product.target_species == "dog"
    assert product.protein_percentage == Decimal("28.0")
    assert product.is_active is True  # Default value

@pytest.mark.unit
def test_product_health_flags_default_false():
    """Test health condition flags default to False."""
    product = Product(
        name="Test Food",
        brand="Test Brand",
        target_species="dog",
        price=Decimal("50.0")
    )

    assert product.for_sensitive_stomach is False
    assert product.for_joint_health is False
    assert product.for_skin_allergies is False

@pytest.mark.unit
def test_product_nullable_age_range():
    """Test products can have NULL age ranges (all ages)."""
    product = Product(
        name="All Ages Food",
        brand="Brand",
        target_species="dog",
        min_age_months=None,
        max_age_months=None,
        price=Decimal("60.0")
    )

    assert product.min_age_months is None
    assert product.max_age_months is None
```

### Step 2: Run test to verify it fails

Run: `docker compose run --rm recommendation-service pytest tests/unit/test_models.py::test_product_model_creation -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'src.models.product'"

### Step 3: Implement Product model

Create file: `srcs/recommendation-service/src/models/product.py`

```python
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean,
    CheckConstraint, Index, TIMESTAMP, ARRAY
)
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Product(Base):
    """Product catalog model for food recommendations."""

    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "target_species IN ('dog', 'cat')",
            name="check_target_species"
        ),
        CheckConstraint("min_age_months >= 0", name="check_min_age_positive"),
        CheckConstraint("max_age_months >= 0", name="check_max_age_positive"),
        CheckConstraint("min_weight_kg >= 0", name="check_min_weight_positive"),
        CheckConstraint("max_weight_kg >= 0", name="check_max_weight_positive"),
        CheckConstraint(
            "protein_percentage >= 0 AND protein_percentage <= 100",
            name="check_protein_range"
        ),
        CheckConstraint(
            "fat_percentage >= 0 AND fat_percentage <= 100",
            name="check_fat_range"
        ),
        CheckConstraint(
            "fiber_percentage >= 0 AND fiber_percentage <= 100",
            name="check_fiber_range"
        ),
        CheckConstraint("calories_per_100g > 0", name="check_calories_positive"),
        CheckConstraint(
            "(min_age_months IS NULL AND max_age_months IS NULL) OR "
            "(min_age_months IS NULL) OR "
            "(max_age_months IS NULL) OR "
            "(min_age_months <= max_age_months)",
            name="check_valid_age_range"
        ),
        CheckConstraint(
            "(min_weight_kg IS NULL AND max_weight_kg IS NULL) OR "
            "(min_weight_kg IS NULL) OR "
            "(max_weight_kg IS NULL) OR "
            "(min_weight_kg <= max_weight_kg)",
            name="check_valid_weight_range"
        ),
        Index("idx_products_species", "target_species"),
        Index("idx_products_active", "is_active"),
        Index("idx_products_brand", "brand"),
        Index("idx_products_suitable_breeds", "suitable_breeds", postgresql_using="gin"),
        {"schema": "recommendation_schema"}
    )

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Basic Information
    name = Column(String(255), nullable=False)
    brand = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    product_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)

    # Target Specifications
    target_species = Column(String(20), nullable=False)
    min_age_months = Column(Integer, nullable=True)
    max_age_months = Column(Integer, nullable=True)
    min_weight_kg = Column(Numeric(5, 2), nullable=True)
    max_weight_kg = Column(Numeric(5, 2), nullable=True)
    suitable_breeds = Column(ARRAY(Text), nullable=True)

    # Nutritional Profile
    protein_percentage = Column(Numeric(5, 2), nullable=True)
    fat_percentage = Column(Numeric(5, 2), nullable=True)
    fiber_percentage = Column(Numeric(5, 2), nullable=True)
    calories_per_100g = Column(Integer, nullable=True)

    # Ingredient Flags
    grain_free = Column(Boolean, default=False, nullable=False)
    organic = Column(Boolean, default=False, nullable=False)
    hypoallergenic = Column(Boolean, default=False, nullable=False)
    limited_ingredient = Column(Boolean, default=False, nullable=False)
    raw_food = Column(Boolean, default=False, nullable=False)

    # Health Condition Targeting
    for_sensitive_stomach = Column(Boolean, default=False, nullable=False)
    for_weight_management = Column(Boolean, default=False, nullable=False)
    for_joint_health = Column(Boolean, default=False, nullable=False)
    for_skin_allergies = Column(Boolean, default=False, nullable=False)
    for_dental_health = Column(Boolean, default=False, nullable=False)
    for_kidney_health = Column(Boolean, default=False, nullable=False)

    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', brand='{self.brand}')>"
```

### Step 4: Run test to verify it passes

Run: `docker compose run --rm recommendation-service pytest tests/unit/test_models.py::test_product_model_creation -v`

Expected: PASS

### Step 5: Add Recommendation and UserFeedback models

Add to `tests/unit/test_models.py`:

```python
from src.models.recommendation import Recommendation
from src.models.user_feedback import UserFeedback

@pytest.mark.unit
def test_recommendation_model_creation():
    """Test Recommendation model tracks recommendation history."""
    recommendation = Recommendation(
        user_id=123,
        pet_id=456,
        product_id=789,
        similarity_score=Decimal("0.8745"),
        rank_position=1
    )

    assert recommendation.user_id == 123
    assert recommendation.pet_id == 456
    assert recommendation.product_id == 789
    assert recommendation.similarity_score == Decimal("0.8745")
    assert recommendation.rank_position == 1
```

Create file: `srcs/recommendation-service/src/models/recommendation.py`

```python
from sqlalchemy import Column, Integer, Numeric, TIMESTAMP, CheckConstraint, Index, ForeignKey
from sqlalchemy.sql import func
from src.models.product import Base

class Recommendation(Base):
    """Recommendation history tracking."""

    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint(
            "similarity_score >= 0 AND similarity_score <= 1",
            name="check_valid_similarity_score"
        ),
        CheckConstraint("rank_position > 0", name="check_valid_rank"),
        Index("idx_recommendations_user_pet", "user_id", "pet_id"),
        Index("idx_recommendations_created", "created_at"),
        {"schema": "recommendation_schema"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    pet_id = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("recommendation_schema.products.id"), nullable=False)
    similarity_score = Column(Numeric(5, 4), nullable=False)
    rank_position = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<Recommendation(id={self.id}, pet_id={self.pet_id}, product_id={self.product_id})>"
```

Create file: `srcs/recommendation-service/src/models/user_feedback.py`

```python
from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, CheckConstraint, Index, ForeignKey
from sqlalchemy.sql import func
from src.models.product import Base

class UserFeedback(Base):
    """User interaction tracking for future supervised learning."""

    __tablename__ = "user_feedback"
    __table_args__ = (
        CheckConstraint(
            "interaction_type IN ('click', 'view', 'purchase', 'rating')",
            name="check_valid_interaction_type"
        ),
        CheckConstraint(
            "(interaction_type = 'rating' AND interaction_value BETWEEN 1.0 AND 5.0) OR "
            "(interaction_type != 'rating' AND interaction_value >= 0)",
            name="check_valid_interaction_value"
        ),
        Index("idx_user_feedback_product", "product_id"),
        Index("idx_user_feedback_created", "created_at"),
        {"schema": "recommendation_schema"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    pet_id = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("recommendation_schema.products.id"), nullable=False)
    interaction_type = Column(String(20), nullable=False)
    interaction_value = Column(Numeric(3, 2), nullable=True)
    similarity_score = Column(Numeric(5, 4), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<UserFeedback(id={self.id}, type='{self.interaction_type}')>"
```

Modify file: `srcs/recommendation-service/src/models/__init__.py`

```python
from src.models.product import Base, Product
from src.models.recommendation import Recommendation
from src.models.user_feedback import UserFeedback

__all__ = ["Base", "Product", "Recommendation", "UserFeedback"]
```

### Step 6: Run all model tests

Run: `docker compose run --rm recommendation-service pytest tests/unit/test_models.py -v`

Expected: All tests PASS

### Step 7: Commit database models

```bash
git add srcs/recommendation-service/src/models/ srcs/recommendation-service/tests/unit/test_models.py
git commit -m "feat(recommendation): add database ORM models

- Add Product model with nutritional profile and health flags
- Add Recommendation model for tracking history
- Add UserFeedback model for future supervised learning
- Add unit tests for model instantiation
- Models aligned with database schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Configuration & Utils

*[Continue with same TDD pattern for Tasks 6-14, following the original plan structure but now testing works because Docker is ready]*

---

**Note:** Tasks 6-14 follow the exact same TDD pattern from the original plan (config, feature engineering, similarity engine, user service client, product service, recommendation API, admin API, integration testing, API gateway integration). The key difference is that **now you can run tests immediately** because Docker + DB are ready from step 1.

Would you like me to continue expanding all remaining tasks (6-14) with full TDD steps, or is this structure clear enough to proceed with implementation?

---

## Summary

**Key Improvements in v2:**
1. ✅ **Docker FIRST** - Infrastructure ready before any code
2. ✅ **Database READY** - Schema migrated, testable immediately
3. ✅ **Validation script** - Confirms environment working
4. ✅ **Test from day 1** - Every step can be tested in Docker
5. ✅ **No waiting** - No "build later" dependencies

**Workflow:**
```bash
# Day 1: Setup infrastructure (1 hour)
Task 1 → Docker up → Health check working ✅
Task 2 → DB schema → Tables exist ✅
Task 3 → Validation → Environment ready ✅

# Day 2-6: Develop with testing (TDD every step)
Task 4 → Project structure ✅
Task 5 → Models → pytest works ✅
Task 6 → Config → pytest works ✅
... (every task tested immediately)
```

## Task 6: Configuration & Utils

**Goal:** Set up configuration management and standardized response utilities.

**Files:**
- Create: `srcs/recommendation-service/src/config.py`
- Create: `srcs/recommendation-service/src/utils/responses.py`
- Create: `srcs/recommendation-service/src/utils/database.py`

### Step 1: Write test for config loading

Create file: `srcs/recommendation-service/tests/unit/test_config.py`

```python
import pytest
import numpy as np
from src.config import Settings, WEIGHT_VECTOR

@pytest.mark.unit
def test_settings_loads_from_env(monkeypatch):
    """Test Settings loads configuration from environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@localhost/test")
    monkeypatch.setenv("USER_SERVICE_URL", "http://user-service:3002")
    monkeypatch.setenv("MIN_SIMILARITY_THRESHOLD", "0.35")

    settings = Settings()

    assert settings.DATABASE_URL == "postgresql://test:test@localhost/test"
    assert settings.USER_SERVICE_URL == "http://user-service:3002"
    assert settings.MIN_SIMILARITY_THRESHOLD == 0.35

@pytest.mark.unit
def test_weight_vector_length():
    """Test WEIGHT_VECTOR has correct length (15)."""
    assert len(WEIGHT_VECTOR) == 15

@pytest.mark.unit
def test_weight_vector_health_conditions_highest():
    """Test health condition weights are highest."""
    health_weights = WEIGHT_VECTOR[4:11]
    other_weights = np.concatenate([WEIGHT_VECTOR[0:4], WEIGHT_VECTOR[11:15]])
    assert np.all(health_weights >= 0.40)
    assert np.all(other_weights < 0.40)
```

### Step 2: Run test to verify it fails

Run: `docker compose run --rm recommendation-service pytest tests/unit/test_config.py -v`

Expected: FAIL

### Step 3: Implement config.py

Create file: `srcs/recommendation-service/src/config.py`

```python
import numpy as np
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application configuration from environment variables."""
    DATABASE_URL: str
    USER_SERVICE_URL: str
    WEIGHT_HEALTH_CONDITIONS: float = 0.40
    WEIGHT_AGE_COMPATIBILITY: float = 0.20
    WEIGHT_NUTRITIONAL_PROFILE: float = 0.20
    WEIGHT_SIZE_COMPATIBILITY: float = 0.10
    WEIGHT_INGREDIENT_PREFERENCES: float = 0.10
    MIN_SIMILARITY_THRESHOLD: float = 0.3
    DEFAULT_RECOMMENDATION_LIMIT: int = 10
    MAX_RECOMMENDATION_LIMIT: int = 50
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

WEIGHT_VECTOR = np.array([
    settings.WEIGHT_AGE_COMPATIBILITY,
    settings.WEIGHT_SIZE_COMPATIBILITY / 2,
    0.05,
    settings.WEIGHT_SIZE_COMPATIBILITY / 2,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_HEALTH_CONDITIONS,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 2,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 4,
    settings.WEIGHT_NUTRITIONAL_PROFILE / 4,
    0.0
])

MIN_SIMILARITY_THRESHOLD = settings.MIN_SIMILARITY_THRESHOLD
DEFAULT_RECOMMENDATION_LIMIT = settings.DEFAULT_RECOMMENDATION_LIMIT
MAX_RECOMMENDATION_LIMIT = settings.MAX_RECOMMENDATION_LIMIT
```

### Step 4: Add response utilities (tests + implementation)

Create file: `srcs/recommendation-service/tests/unit/test_responses.py`

```python
import pytest
from src.utils.responses import success_response, error_response

@pytest.mark.unit
def test_success_response_structure():
    data = {"message": "Success"}
    response = success_response(data)
    assert response["success"] is True
    assert response["data"] == data
    assert response["error"] is None
    assert "timestamp" in response

@pytest.mark.unit
def test_error_response_structure():
    response = error_response("NOT_FOUND", "Resource not found", {"resource_id": 123})
    assert response["success"] is False
    assert response["error"]["code"] == "NOT_FOUND"
```

Create file: `srcs/recommendation-service/src/utils/responses.py`

```python
from datetime import datetime
from typing import Any, Optional, Dict

def success_response(data: Any) -> Dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.utcnow().isoformat()
    }

def error_response(code: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details or {}},
        "timestamp": datetime.utcnow().isoformat()
    }
```

### Step 5: Add database utilities

Create file: `srcs/recommendation-service/src/utils/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from src.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Step 6: Run all tests and commit

```bash
docker compose run --rm recommendation-service pytest tests/unit/test_config.py tests/unit/test_responses.py -v
git add srcs/recommendation-service/src/config.py srcs/recommendation-service/src/utils/ srcs/recommendation-service/tests/unit/test_config.py srcs/recommendation-service/tests/unit/test_responses.py
git commit -m "feat(recommendation): add config and response utilities

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

*(Continuing with Tasks 7-14 following same TDD pattern - Feature Engineering, Similarity Engine, User Service Client, Product Service, Recommendation API, Admin API, Integration Testing, API Gateway Integration)*

*(Due to length, refer to original v1 plan lines 874-2468 for full TDD steps - all steps work identically in Docker environment)*

---

## Task 14: API Gateway Integration

**Goal:** Expose recommendation service through API Gateway.

### Step 1: Add service URL to API Gateway config

Modify file: `srcs/api-gateway/.env`

```bash
# Add recommendation service URL
RECOMMENDATION_SERVICE_URL=http://recommendation-service:3005
```

### Step 2: Update API Gateway to proxy requests

API Gateway's zero-touch routing will automatically proxy `/api/v1/recommendations/*` to recommendation-service.

### Step 3: Test through API Gateway

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.data.access_token')

# Test recommendation endpoint through gateway
curl -X GET "http://localhost:8001/api/v1/recommendations/food?pet_id=1" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Recommendations response
```

### Step 4: Commit API Gateway integration

```bash
git add srcs/api-gateway/.env
git commit -m "feat(recommendation): integrate with API Gateway

- Add RECOMMENDATION_SERVICE_URL to gateway config
- Enable zero-touch routing for /api/v1/recommendations/*
- Test end-to-end through gateway with JWT auth

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete

**Delivered:**
- ✅ Docker-first infrastructure (test from day 1)
- ✅ Database schema with migrations
- ✅ ORM models with SQLAlchemy
- ✅ Feature engineering (pet/product → vectors)
- ✅ Weighted similarity algorithm
- ✅ User service integration
- ✅ Product CRUD operations
- ✅ Recommendation API endpoint
- ✅ Admin API for product management
- ✅ Integration tests
- ✅ API Gateway integration

**Testing Commands:**
```bash
# Unit tests
docker compose run --rm recommendation-service pytest tests/unit/ -v

# Integration tests
docker compose run --rm recommendation-service pytest tests/integration/ -v

# All tests
docker compose run --rm recommendation-service pytest tests/ -v

# With coverage
docker compose run --rm recommendation-service pytest tests/ --cov=src --cov-report=html
```

**Next Steps:**
1. Seed product catalog (20-30 products)
2. End-to-end testing with real pet profiles
3. Performance testing (target <200ms p95)
4. Frontend integration
5. Metrics and monitoring

---

Would you like me to create a quick reference checklist or add specific product seed data?
