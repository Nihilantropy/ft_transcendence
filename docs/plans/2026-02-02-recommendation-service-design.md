# ML-Powered Food Recommendation Service - Design Document

**Date:** 2026-02-02
**Status:** Design Approved
**Author:** Claude Code
**Reviewers:** Project Team

---

## Executive Summary

This document outlines the design for a machine learning-powered food recommendation service for the SmartBreeds platform. The service uses content-based filtering with weighted similarity scoring to recommend pet food products based on pet characteristics (breed, age, weight, health conditions) and product features (nutritional profile, ingredient flags, health targeting).

The system starts with a similarity-based algorithm that works immediately without training data, then evolves to supervised learning as user feedback accumulates. This approach provides immediate value while building toward a truly intelligent recommendation engine.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Feature Engineering](#feature-engineering)
5. [Similarity Algorithm](#similarity-algorithm)
6. [API Endpoints](#api-endpoints)
7. [Service Integration](#service-integration)
8. [Evolution Strategy](#evolution-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Implementation Plan](#implementation-plan)
11. [Configuration](#configuration)
12. [Future Enhancements](#future-enhancements)

---

## Overview

### Problem Statement

SmartBreeds users can identify their pet's breed using AI vision, but lack personalized product recommendations. Luxury pet owners need curated food suggestions tailored to their pet's specific breed, age, weight, and health conditions.

### Solution

A dedicated recommendation microservice that:
- Analyzes pet characteristics and product features
- Calculates compatibility using weighted similarity scoring
- Returns ranked product recommendations with explainable match reasons
- Collects user feedback for future machine learning improvements

### Key Features

- **Immediate Value**: Works day 1 without training data (similarity-based)
- **Explainable**: Returns similarity scores and match reasons
- **Safe**: Prioritizes health conditions (40% weight)
- **Evolvable**: Clear path to supervised learning with user feedback
- **Consistent**: Follows existing microservice auth patterns

### Success Metrics

- Response time: <200ms (p95)
- Throughput: 100 recommendations/second
- Recommendation relevance: >0.5 average similarity score
- User engagement: Track CTR on recommended products (future)

---

## Architecture

### High-Level Service Structure

```
recommendation-service/
├── src/
│   ├── models/                      # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── product.py               # Product catalog model
│   │   ├── recommendation.py        # Recommendation history
│   │   └── user_feedback.py         # User interaction tracking (backlog)
│   ├── services/                    # Business logic layer
│   │   ├── __init__.py
│   │   ├── feature_engineering.py   # Pet/Product → vectors
│   │   ├── similarity_engine.py     # Core recommendation algorithm
│   │   ├── product_service.py       # Product CRUD operations
│   │   └── user_service_client.py   # HTTP client for user-service
│   ├── routes/                      # FastAPI routers
│   │   ├── __init__.py
│   │   ├── recommendations.py       # GET /api/v1/recommendations/food
│   │   └── admin.py                 # Product management (admin only)
│   ├── schemas/                     # Pydantic models
│   │   ├── __init__.py
│   │   ├── product.py               # Request/response schemas
│   │   └── recommendation.py        # Recommendation schemas
│   ├── middleware/                  # Request middleware
│   │   └── auth.py                  # Extract user context from headers
│   ├── utils/                       # Shared utilities
│   │   ├── responses.py             # Standardized API responses
│   │   └── database.py              # DB session management
│   ├── config.py                    # Configuration & feature weights
│   └── main.py                      # FastAPI application
├── tests/
│   ├── unit/
│   │   ├── test_feature_engineering.py
│   │   ├── test_similarity_engine.py
│   │   └── test_product_service.py
│   ├── integration/
│   │   ├── test_recommendations_api.py
│   │   └── test_admin_api.py
│   └── fixtures/
│       ├── seed_products.sql        # Test product data
│       └── test_pets.py             # Test pet profiles
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

### Technology Stack

- **Framework**: FastAPI 0.110+ (async, high performance)
- **ML Library**: scikit-learn 1.4+ (similarity, future supervised learning)
- **Numerical Computing**: NumPy 1.26+ (vector operations)
- **ORM**: SQLAlchemy 2.0+ (async support)
- **HTTP Client**: httpx 0.27+ (async calls to user-service)
- **Testing**: pytest 8.0+, pytest-asyncio
- **Database**: PostgreSQL 15+ (shared with other services)
- **Container**: Docker with Python 3.12-slim base

### Microservices Integration

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                          │
│  (JWT validation, rate limiting, request routing)           │
└─────────────────┬───────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┬──────────────────┐
       │          │          │                  │
   ┌───▼───┐  ┌──▼───┐  ┌───▼────┐  ┌─────────▼──────────┐
   │ Auth  │  │ User │  │   AI   │  │  Recommendation    │
   │Service│  │Service│ │ Service│  │     Service        │
   └───────┘  └──┬───┘  └────────┘  └─────────┬──────────┘
                 │                             │
                 │  GET /api/v1/pets/{id}     │
                 │◄────────────────────────────┘
                 │  (fetch pet profile)
                 │
           ┌─────▼─────┐
           │PostgreSQL │
           │  Database │
           └───────────┘
```

### Network Configuration

- **Service Name**: `recommendation-service`
- **Internal Port**: 3005
- **Network**: `backend-network` (isolated, not exposed to localhost)
- **Access**: Only via API Gateway (enforces auth & rate limiting)

---

## Database Schema

### PostgreSQL Schema

New schema: `recommendation_schema` (logical separation from other services)

### Products Table

```sql
CREATE TABLE recommendation_schema.products (
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
    suitable_breeds TEXT[],  -- Array of breed names (normalized)

    -- Nutritional Profile (0-100 percentages)
    protein_percentage DECIMAL(5,2) CHECK (protein_percentage >= 0 AND protein_percentage <= 100),
    fat_percentage DECIMAL(5,2) CHECK (fat_percentage >= 0 AND fat_percentage <= 100),
    fiber_percentage DECIMAL(5,2) CHECK (fiber_percentage >= 0 AND fiber_percentage <= 100),
    calories_per_100g INT CHECK (calories_per_100g > 0),

    -- Ingredient Flags (binary features for ML)
    grain_free BOOLEAN DEFAULT false,
    organic BOOLEAN DEFAULT false,
    hypoallergenic BOOLEAN DEFAULT false,
    limited_ingredient BOOLEAN DEFAULT false,
    raw_food BOOLEAN DEFAULT false,

    -- Health Condition Targeting (binary features)
    for_sensitive_stomach BOOLEAN DEFAULT false,
    for_weight_management BOOLEAN DEFAULT false,
    for_joint_health BOOLEAN DEFAULT false,
    for_skin_allergies BOOLEAN DEFAULT false,
    for_dental_health BOOLEAN DEFAULT false,
    for_kidney_health BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

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
CREATE INDEX idx_products_species ON recommendation_schema.products(target_species);
CREATE INDEX idx_products_active ON recommendation_schema.products(is_active);
CREATE INDEX idx_products_brand ON recommendation_schema.products(brand);
CREATE INDEX idx_products_suitable_breeds ON recommendation_schema.products USING GIN(suitable_breeds);
```

### Recommendations Table (History Tracking)

```sql
CREATE TABLE recommendation_schema.recommendations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    similarity_score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000
    rank_position INT NOT NULL,              -- Position in recommendation list (1-10)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_similarity_score CHECK (similarity_score >= 0 AND similarity_score <= 1),
    CONSTRAINT valid_rank CHECK (rank_position > 0)
);

CREATE INDEX idx_recommendations_user_pet ON recommendation_schema.recommendations(user_id, pet_id);
CREATE INDEX idx_recommendations_created ON recommendation_schema.recommendations(created_at);
```

### User Feedback Table (Backlog - Future Supervised Learning)

```sql
CREATE TABLE recommendation_schema.user_feedback (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('click', 'view', 'purchase', 'rating')),
    interaction_value DECIMAL(3,2),  -- For ratings (1.0-5.0) or duration (seconds normalized)
    similarity_score DECIMAL(5,4),   -- What score did similarity engine give?
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_interaction_value CHECK (
        (interaction_type = 'rating' AND interaction_value BETWEEN 1.0 AND 5.0) OR
        (interaction_type != 'rating' AND interaction_value >= 0)
    )
);

CREATE INDEX idx_user_feedback_product ON recommendation_schema.user_feedback(product_id);
CREATE INDEX idx_user_feedback_created ON recommendation_schema.user_feedback(created_at);
```

### Design Decisions

1. **Nullable age/weight ranges**: Products with NULL values are suitable for "all ages" or "all sizes"
2. **Boolean flags**: Easy to encode as binary features (0 or 1) for ML algorithms
3. **Array for suitable_breeds**: Allows multi-breed targeting (e.g., "good for all retrievers")
4. **Separate tables**: Recommendation history and feedback isolated for analytics
5. **Check constraints**: Data validation at database level for integrity

---

## Feature Engineering

Feature engineering transforms pet profiles and products into numerical vectors for similarity calculation.

### Pet Profile → Feature Vector

**Input:** Pet data from user-service
```json
{
    "species": "dog",
    "breed": "golden_retriever",
    "age_months": 36,
    "weight_kg": 28.5,
    "health_conditions": ["sensitive_stomach", "joint_health"]
}
```

**Transformation Steps:**

1. **Age Normalization** (0-1 scale)
   - Formula: `age_normalized = age_months / 180` (180 months = 15 years = senior)
   - Example: 36 months → 0.20

2. **Weight Normalization** (relative to breed standard)
   - Lookup breed typical weight range from breed database or RAG
   - Formula: `weight_normalized = (weight - min) / (max - min)`
   - Example: Golden Retriever (25-32kg), 28.5kg → 0.5

3. **Breed Characteristics** (lookup from breed database)
   - `energy_level`: 0.0 (low) to 1.0 (very high)
   - `size_category`: 0.25 (small), 0.5 (medium), 0.75 (large), 1.0 (extra large)
   - Example: Golden Retriever → energy=0.8, size=0.75

4. **Health Condition Flags** (one-hot encoding)
   - Binary vector: [sensitive_stomach, weight_issue, joint_health, skin_allergies, dental, kidney, other]
   - Example: ["sensitive_stomach", "joint_health"] → [1, 0, 1, 0, 0, 0, 0]

5. **Nutritional Needs** (derived from breed + age + weight)
   - `protein_need`: 0.0-1.0 (higher for active breeds, puppies)
   - `fat_need`: 0.0-1.0 (higher for active breeds, lower for weight management)
   - `daily_calories`: Calculated from weight and energy level

**Output Vector (length: 15):**
```python
[
    0.20,  # age_normalized
    0.50,  # weight_normalized
    0.80,  # energy_level
    0.75,  # size_category
    1, 0, 1, 0, 0, 0, 0,  # health_conditions (7 flags)
    0.70,  # protein_need
    0.50,  # fat_need
    1800   # daily_calories
]
```

### Product → Feature Vector

**Input:** Product from database
```json
{
    "target_species": "dog",
    "min_age_months": 12,
    "max_age_months": 96,
    "min_weight_kg": 20.0,
    "max_weight_kg": 40.0,
    "protein_percentage": 28.0,
    "fat_percentage": 15.0,
    "calories_per_100g": 380,
    "for_sensitive_stomach": true,
    "for_joint_health": true,
    "grain_free": true
}
```

**Transformation Steps:**

1. **Age Target** (midpoint, normalized)
   - Formula: `age_target = ((min + max) / 2) / 180`
   - Example: (12 + 96) / 2 = 54 months → 0.30
   - If NULL: Default to 0.5 (all ages)

2. **Weight Target** (midpoint, normalized by max possible)
   - Formula: `weight_target = ((min + max) / 2) / 50` (50kg = max expected)
   - Example: (20 + 40) / 2 = 30kg → 0.60
   - If NULL: Default to 0.5 (all weights)

3. **Target Characteristics** (derived from weight/breed targets)
   - `target_energy_level`: Inferred from fat/protein (higher = more energy)
   - `target_size`: From weight range (0.25-1.0)

4. **Health Condition Support Flags** (same order as pet)
   - Binary vector matching pet health flags
   - Example: [1, 0, 1, 0, 0, 0, 0] (supports sensitive stomach + joint health)

5. **Nutritional Profile** (normalized)
   - `protein_pct_normalized`: protein_percentage / 40 (40% = high-end)
   - `fat_pct_normalized`: fat_percentage / 30 (30% = high-end)
   - `calories_per_100g`: Raw value (for weighting)

**Output Vector (length: 15, aligned with pet vector):**
```python
[
    0.30,  # age_target
    0.60,  # weight_target
    0.75,  # target_energy_level
    0.75,  # target_size
    1, 0, 1, 0, 0, 0, 0,  # health_support_flags (7 flags)
    0.70,  # protein_normalized (28/40)
    0.50,  # fat_normalized (15/30)
    380    # calories_per_100g
]
```

### Feature Alignment

**Critical:** Pet and product vectors must:
- Have identical length (15 elements)
- Have features in the same order
- Use the same normalization scales
- Binary flags in matching positions

This alignment enables direct element-wise comparison for similarity scoring.

---

## Similarity Algorithm

### Weighted Cosine Similarity

**Formula:**
```
similarity(pet, product) = (weighted_pet · weighted_product) / (||weighted_pet|| × ||weighted_product||)
```

Where:
- `weighted_pet = pet_vector * weight_vector` (element-wise multiplication)
- `weighted_product = product_vector * weight_vector`
- `·` = dot product
- `|| ||` = L2 norm (Euclidean length)

### Feature Weights Configuration

**Weight Vector** (defined in `src/config.py`):
```python
FEATURE_WEIGHTS = {
    # Index 0-3: Demographics
    "age_compatibility": 0.20,       # Matches indices 0
    "weight_compatibility": 0.10,    # Matches indices 1
    "energy_level": 0.05,            # Matches indices 2
    "size_category": 0.05,           # Matches indices 3

    # Index 4-10: Health Conditions (HIGHEST PRIORITY)
    "health_conditions": 0.40,       # Matches indices 4-10 (7 flags)

    # Index 11-13: Nutritional Profile
    "protein_match": 0.10,           # Matches indices 11
    "fat_match": 0.05,               # Matches indices 12
    "calorie_match": 0.05,           # Matches indices 13
}

# Convert to weight vector (length 15)
WEIGHT_VECTOR = np.array([
    0.20,  # age
    0.10,  # weight
    0.05,  # energy
    0.05,  # size
    0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40,  # 7 health flags (each gets 0.40)
    0.10,  # protein
    0.05,  # fat
    0.05   # calories
])
```

**Rationale:**
- **Health conditions (40%)**: Safety first - critical for luxury pet owners
- **Age (20%)**: Life stage matters significantly for nutrition
- **Nutritional profile (20% combined)**: Important but secondary to health
- **Weight/size (15% combined)**: Relevant but less critical
- **Energy level (5%)**: Nice-to-have but not essential

### Algorithm Implementation

**Python Implementation** (`src/services/similarity_engine.py`):
```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Tuple
from src.config import WEIGHT_VECTOR, MIN_SIMILARITY_THRESHOLD

class SimilarityEngine:
    def __init__(self):
        self.weights = WEIGHT_VECTOR

    def calculate_similarity(
        self,
        pet_vector: np.ndarray,
        product_vector: np.ndarray
    ) -> float:
        """
        Calculate weighted cosine similarity between pet and product.

        Args:
            pet_vector: Normalized pet feature vector (length 15)
            product_vector: Normalized product feature vector (length 15)

        Returns:
            Similarity score (0.0 to 1.0)
        """
        # Apply feature weights
        weighted_pet = pet_vector * self.weights
        weighted_product = product_vector * self.weights

        # Calculate cosine similarity
        # Reshape to 2D array for sklearn (expects matrix input)
        similarity_matrix = cosine_similarity(
            weighted_pet.reshape(1, -1),
            weighted_product.reshape(1, -1)
        )

        # Extract scalar similarity score
        return float(similarity_matrix[0, 0])

    def get_recommendations(
        self,
        pet_vector: np.ndarray,
        products: List[dict],
        product_vectors: np.ndarray,
        top_n: int = 10
    ) -> List[Tuple[dict, float]]:
        """
        Get top N product recommendations for a pet.

        Args:
            pet_vector: Normalized pet feature vector
            products: List of product dictionaries
            product_vectors: Matrix of product vectors (shape: [n_products, 15])
            top_n: Number of recommendations to return

        Returns:
            List of (product, similarity_score) tuples, sorted by score descending
        """
        # Apply weights to pet vector
        weighted_pet = pet_vector * self.weights

        # Apply weights to all product vectors (broadcasting)
        weighted_products = product_vectors * self.weights

        # Calculate similarities for all products at once (vectorized)
        similarity_scores = cosine_similarity(
            weighted_pet.reshape(1, -1),
            weighted_products
        )[0]  # Extract 1D array from matrix

        # Filter by minimum threshold
        valid_indices = np.where(similarity_scores >= MIN_SIMILARITY_THRESHOLD)[0]

        if len(valid_indices) == 0:
            return []  # No products meet minimum threshold

        # Create (product, score) pairs for valid products
        valid_products = [(products[i], similarity_scores[i]) for i in valid_indices]

        # Sort by score descending
        valid_products.sort(key=lambda x: x[1], reverse=True)

        # Return top N
        return valid_products[:top_n]
```

### Threshold Configuration

**Minimum Similarity Threshold** (`MIN_SIMILARITY_THRESHOLD = 0.3`):
- Products with score < 0.3 are filtered out
- Prevents recommending poor matches
- Tunable based on product catalog quality

### Performance Optimization

- **Vectorized operations**: Use NumPy broadcasting for batch calculations
- **Pre-computed product vectors**: Encode products once, cache in memory
- **Lazy loading**: Only encode products for target species
- **Index optimization**: Database indexes on `target_species` and `is_active`

---

## API Endpoints

### Recommendation Endpoints

#### GET /api/v1/recommendations/food

**Description:** Get personalized food recommendations for a pet.

**Authentication:** Required (JWT via API Gateway)

**Request:**
```http
GET /api/v1/recommendations/food?pet_id=456&limit=10&min_score=0.3
Headers:
  X-User-ID: 123
  X-User-Role: user
  X-Request-ID: abc-123-def
```

**Query Parameters:**
- `pet_id` (required, integer): ID of the pet to get recommendations for
- `limit` (optional, integer, default=10, max=50): Number of recommendations
- `min_score` (optional, float, default=0.3): Minimum similarity threshold

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "pet": {
            "id": 456,
            "name": "Max",
            "species": "dog",
            "breed": "golden_retriever",
            "age_months": 36,
            "weight_kg": 28.5,
            "health_conditions": ["joint_health"]
        },
        "recommendations": [
            {
                "product_id": 789,
                "name": "Royal Canin Golden Retriever Adult",
                "brand": "Royal Canin",
                "description": "Tailored nutrition for Golden Retrievers...",
                "price": 89.99,
                "product_url": "https://example.com/product/789",
                "image_url": "https://example.com/images/789.jpg",
                "similarity_score": 0.8745,
                "rank_position": 1,
                "match_reasons": [
                    "Supports joint health with glucosamine",
                    "Optimal protein for large breeds (28%)",
                    "Age-appropriate for adult dogs (3 years)",
                    "Calorie density matches energy needs"
                ],
                "nutritional_highlights": {
                    "protein_percentage": 28.0,
                    "fat_percentage": 15.0,
                    "calories_per_100g": 380
                },
                "health_benefits": [
                    "for_joint_health",
                    "for_skin_allergies"
                ]
            },
            {
                "product_id": 790,
                "name": "Hill's Science Diet Large Breed Adult",
                "brand": "Hill's",
                "price": 79.99,
                "similarity_score": 0.8123,
                "rank_position": 2,
                "match_reasons": [
                    "High-quality protein for muscle maintenance",
                    "Glucosamine for joint support",
                    "Balanced nutrition for large breeds"
                ]
            }
            // ... 8 more products
        ],
        "metadata": {
            "total_products_evaluated": 247,
            "products_above_threshold": 18,
            "recommendations_returned": 10,
            "min_score_applied": 0.3,
            "computation_time_ms": 45
        }
    },
    "timestamp": "2026-02-02T12:00:00.123456"
}
```

**Error Responses:**

**403 Forbidden** (Pet not owned by user):
```json
{
    "success": false,
    "data": null,
    "error": {
        "code": "UNAUTHORIZED",
        "message": "Pet not found or you don't have access to this pet",
        "details": {"pet_id": 456}
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

**404 Not Found** (Pet doesn't exist):
```json
{
    "success": false,
    "data": null,
    "error": {
        "code": "NOT_FOUND",
        "message": "Pet not found",
        "details": {"pet_id": 456}
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

**200 OK** (No recommendations found):
```json
{
    "success": true,
    "data": {
        "pet": {...},
        "recommendations": [],
        "metadata": {
            "message": "No products meet the minimum similarity threshold",
            "total_products_evaluated": 247,
            "products_above_threshold": 0
        }
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

**503 Service Unavailable** (User-service down):
```json
{
    "success": false,
    "data": null,
    "error": {
        "code": "SERVICE_UNAVAILABLE",
        "message": "Unable to fetch pet profile from user-service",
        "details": {"service": "user-service"}
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

---

### Admin Endpoints (Product Management)

All admin endpoints require `X-User-Role: admin` header (enforced by API Gateway).

#### POST /api/v1/admin/products

**Description:** Create a new product in the catalog.

**Request:**
```json
{
    "name": "Royal Canin Golden Retriever Adult",
    "brand": "Royal Canin",
    "description": "Complete nutrition for adult Golden Retrievers...",
    "price": 89.99,
    "product_url": "https://example.com/product",
    "image_url": "https://example.com/image.jpg",
    "target_species": "dog",
    "min_age_months": 12,
    "max_age_months": 96,
    "min_weight_kg": 25.0,
    "max_weight_kg": 35.0,
    "suitable_breeds": ["golden_retriever", "labrador_retriever"],
    "protein_percentage": 28.0,
    "fat_percentage": 15.0,
    "fiber_percentage": 3.5,
    "calories_per_100g": 380,
    "grain_free": false,
    "organic": false,
    "hypoallergenic": false,
    "for_sensitive_stomach": false,
    "for_joint_health": true,
    "for_skin_allergies": true
}
```

**Response (201 Created):**
```json
{
    "success": true,
    "data": {
        "product_id": 789,
        "name": "Royal Canin Golden Retriever Adult",
        "created_at": "2026-02-02T12:00:00"
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

#### PUT /api/v1/admin/products/{product_id}

**Description:** Update an existing product (full replacement).

**Request:** Same schema as POST

**Response (200 OK):** Updated product data

#### PATCH /api/v1/admin/products/{product_id}

**Description:** Partially update a product (only specified fields).

**Request:** Any subset of product fields

**Response (200 OK):** Updated product data

#### DELETE /api/v1/admin/products/{product_id}

**Description:** Soft delete a product (sets `is_active = false`).

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "product_id": 789,
        "message": "Product deactivated successfully"
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

#### GET /api/v1/admin/products

**Description:** List all products with pagination and filters.

**Query Parameters:**
- `page` (integer, default=1)
- `page_size` (integer, default=50, max=100)
- `species` (string, optional): Filter by 'dog' or 'cat'
- `is_active` (boolean, optional): Filter by active status
- `brand` (string, optional): Filter by brand name

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "products": [...],
        "pagination": {
            "page": 1,
            "page_size": 50,
            "total_products": 247,
            "total_pages": 5
        }
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

---

### Future Feedback Endpoint (Backlog)

#### POST /api/v1/feedback

**Description:** Track user interaction with recommended products.

**Request:**
```json
{
    "pet_id": 456,
    "product_id": 789,
    "interaction_type": "click",
    "duration_seconds": 45
}
```

**Response (201 Created):**
```json
{
    "success": true,
    "data": {
        "feedback_id": 123,
        "message": "Feedback recorded successfully"
    },
    "timestamp": "2026-02-02T12:00:00"
}
```

---

## Service Integration

### Authentication & Authorization

**Pattern:** Follows SmartBreeds microservice architecture (same as auth-service, user-service, ai-service).

**Flow:**
1. User request → API Gateway (with JWT in HTTP-only cookie)
2. API Gateway validates JWT, extracts user context
3. Gateway forwards to recommendation-service with headers:
   - `X-User-ID`: User ID (e.g., "123")
   - `X-User-Role`: User role (e.g., "user" or "admin")
   - `X-Request-ID`: Unique request ID for tracing
4. Recommendation-service trusts headers (network isolation ensures security)
5. Service verifies pet ownership by calling user-service

**Authorization Logic:**
```python
# In recommendation route handler
async def get_recommendations(
    pet_id: int,
    user_id: int = Header(None, alias="X-User-ID"),
    user_role: str = Header(None, alias="X-User-Role")
):
    # Fetch pet from user-service
    pet = await user_service_client.get_pet(pet_id)

    # Verify ownership
    if pet.owner_id != user_id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "UNAUTHORIZED",
                "message": "You don't have access to this pet"
            }
        )

    # Proceed with recommendations...
```

### User-Service Integration

**HTTP Client** (`src/services/user_service_client.py`):
```python
import httpx
from src.config import USER_SERVICE_URL

class UserServiceClient:
    def __init__(self):
        self.base_url = USER_SERVICE_URL  # http://user-service:3002
        self.client = httpx.AsyncClient(timeout=5.0)

    async def get_pet(self, pet_id: int, user_id: int) -> dict:
        """
        Fetch pet profile from user-service.

        Args:
            pet_id: ID of the pet
            user_id: ID of the requesting user (for ownership verification)

        Returns:
            Pet profile dictionary

        Raises:
            httpx.HTTPStatusError: If pet not found or unauthorized
            httpx.RequestError: If service unavailable
        """
        response = await self.client.get(
            f"{self.base_url}/api/v1/pets/{pet_id}",
            headers={"X-User-ID": str(user_id)}
        )
        response.raise_for_status()
        return response.json()["data"]
```

**Error Handling:**
- **404 Not Found**: Pet doesn't exist → return 404 to client
- **403 Forbidden**: Pet exists but user doesn't own it → return 403
- **503 Service Unavailable**: User-service down → return 503 with retry-after header

### Database Access

**Connection:** Shared PostgreSQL instance, isolated schema (`recommendation_schema`)

**Connection String** (from environment):
```
DATABASE_URL=postgresql://user:password@db:5432/smartbreeds?options=-c%20search_path=recommendation_schema
```

**Session Management:**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### Request Flow Diagram

```
┌─────────┐
│ Browser │ (JWT cookie auto-sent)
└────┬────┘
     │ GET /api/v1/recommendations/food?pet_id=456
     ▼
┌────────────────┐
│  API Gateway   │ (Port 8001)
│  - Validate JWT│
│  - Extract user│
└────────┬───────┘
         │ X-User-ID: 123, X-User-Role: user
         ▼
┌─────────────────────────┐
│ Recommendation Service  │ (Port 3005, internal only)
└────┬────────────────────┘
     │
     │ 1. Verify ownership & fetch pet profile
     ▼
┌──────────────┐
│ User Service │ GET /api/v1/pets/456
└──────┬───────┘ Headers: X-User-ID: 123
       │
       │ 2. Return pet profile
       ▼
┌─────────────────────────┐
│ Recommendation Service  │
│ - Encode pet → vector   │
│ - Query products from DB│
│ - Calculate similarity  │
│ - Return top 10         │
└────┬────────────────────┘
     │
     │ 3. Response with recommendations
     ▼
┌────────────────┐
│  API Gateway   │ (Proxy response)
└────────┬───────┘
         │
         ▼
┌─────────┐
│ Browser │ (JSON response)
└─────────┘
```

---

## Evolution Strategy

### Phase 1: Similarity-Based (Launch - Months 0-3)

**Algorithm:** Weighted cosine similarity (as designed above)

**Data Required:** None (works immediately)

**Advantages:**
- No training data needed
- Explainable results
- Fast implementation
- Deterministic behavior

**Limitations:**
- Fixed feature weights (manual tuning)
- Can't learn from user preferences
- May not capture complex relationships

**Success Metrics:**
- Average similarity score > 0.5
- Response time < 200ms (p95)
- Zero errors from empty recommendations

---

### Phase 2: Feedback Collection (Months 1-6)

**Implementation:**
- Frontend sends interaction events to `POST /api/v1/feedback`
- Track: clicks, views, time spent, purchases (if available)
- Store in `user_feedback` table with similarity score from Phase 1

**Implicit Signal Mapping:**
```python
INTERACTION_SCORES = {
    "purchase": 1.0,      # Strong positive signal
    "long_view": 0.8,     # View duration > 30 seconds
    "click": 0.5,         # Clicked but didn't engage deeply
    "skip": 0.0           # Shown but not clicked (implicit negative)
}
```

**Data Collection Goal:** Minimum 1000 feedback entries before Phase 3

**Analytics:**
- Track click-through rate (CTR) on recommendations
- Identify which products get high engagement
- Correlate similarity scores with user actions
- Identify feature importance (which features drive clicks?)

---

### Phase 3: Supervised Learning (Months 6+)

**Trigger Condition:** `feedback_count >= 1000` interactions

**Training Pipeline:**

**1. Data Preparation:**
```python
# Combine pet and product vectors into single feature vector
X = []
y = []

for feedback in user_feedback:
    pet_vector = encode_pet(feedback.pet)
    product_vector = encode_product(feedback.product)

    # Concatenate vectors (length: 30)
    combined_vector = np.concatenate([pet_vector, product_vector])

    X.append(combined_vector)
    y.append(feedback.interaction_score)  # 0.0 to 1.0

X = np.array(X)
y = np.array(y)
```

**2. Train-Test Split:**
```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
```

**3. Model Training:**
```python
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score

# Train model
model = RandomForestRegressor(
    n_estimators=100,
    max_depth=10,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"RMSE: {rmse:.4f}, R²: {r2:.4f}")
```

**Alternative Models:**
- **GradientBoostingRegressor**: Higher accuracy, more compute
- **XGBoost**: Industry standard, handles missing values well
- **Neural Network (MLP)**: Consider for scale (10,000+ feedback entries)

**4. Feature Importance Analysis:**
```python
# Discover which features matter most
feature_importance = model.feature_importances_

# Sort features by importance
feature_names = [
    "pet_age", "pet_weight", "pet_energy", "pet_size",
    "pet_health_1", "pet_health_2", ...,  # 7 health flags
    "pet_protein_need", "pet_fat_need", "pet_calories",
    "product_age", "product_weight", ...,  # Same structure
]

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": feature_importance
}).sort_values("importance", ascending=False)

print(importance_df.head(10))  # Top 10 most important features
```

**5. Model Deployment:**
```python
import joblib

# Save model with timestamp
model_path = f"models/rf_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
joblib.dump(model, model_path)

# Load in production
model = joblib.load(model_path)

# Predict compatibility score
def predict_compatibility(pet_vector, product_vector):
    combined = np.concatenate([pet_vector, product_vector]).reshape(1, -1)
    return model.predict(combined)[0]
```

---

### Phase 4: Hybrid Deployment (Ongoing)

**Strategy:** Run both similarity and supervised models in parallel

**A/B Testing Setup:**
```python
def get_recommendations_hybrid(pet_profile, user_id):
    # Assign user to test group (80% ML, 20% baseline)
    use_ml_model = (hash(user_id) % 100) < 80

    if use_ml_model and model_loaded:
        # Use trained model
        return get_recommendations_supervised(pet_profile)
    else:
        # Use similarity baseline
        return get_recommendations_similarity(pet_profile)
```

**Comparison Metrics:**
- Click-through rate (CTR)
- Average time spent viewing products
- Purchase conversion rate (if available)
- User engagement score (clicks + views + purchases)

**Rollback Strategy:**
- If ML model CTR < baseline CTR by >10% → rollback to similarity
- Keep similarity engine as permanent fallback
- Monitor model performance daily

**Retraining Schedule:**
- Weekly retraining as new feedback accumulates
- Incremental learning with new data
- Version models with timestamps (`rf_model_20260215.pkl`)
- Keep last 3 model versions for rollback

---

### Phase 5: Advanced Features (Future)

**Collaborative Filtering:**
- "Users with similar pets also liked..."
- Requires user-user or pet-pet similarity
- Needs significant user base (1000+ active users)

**Contextual Bandits:**
- Exploration vs exploitation tradeoff
- Learn which products to show in which contexts
- Adaptive recommendations

**Deep Learning:**
- Neural networks for complex pattern recognition
- Embedding layers for pets and products
- Requires large dataset (10,000+ interactions)

---

## Testing Strategy

### Unit Tests

**Feature Engineering Tests** (`tests/unit/test_feature_engineering.py`):

```python
import pytest
import numpy as np
from src.services.feature_engineering import FeatureEngineer

@pytest.fixture
def feature_engineer():
    return FeatureEngineer()

def test_pet_vector_length(feature_engineer):
    """Verify pet vector has correct length."""
    pet = {
        "species": "dog",
        "breed": "golden_retriever",
        "age_months": 36,
        "weight_kg": 28.5,
        "health_conditions": ["sensitive_stomach"]
    }
    vector = feature_engineer.encode_pet(pet)
    assert len(vector) == 15

def test_pet_vector_normalization(feature_engineer):
    """Verify features are normalized to 0-1 range (except calories)."""
    pet = {
        "species": "dog",
        "breed": "golden_retriever",
        "age_months": 36,
        "weight_kg": 28.5,
        "health_conditions": []
    }
    vector = feature_engineer.encode_pet(pet)

    # Check first 13 features are normalized (0-1)
    assert all(0 <= v <= 1 for v in vector[:13])

    # Calories (index 14) can be > 1
    assert vector[14] > 0

def test_health_condition_encoding(feature_engineer):
    """Verify health conditions are one-hot encoded correctly."""
    pet = {
        "species": "dog",
        "breed": "golden_retriever",
        "age_months": 36,
        "weight_kg": 28.5,
        "health_conditions": ["sensitive_stomach", "joint_health"]
    }
    vector = feature_engineer.encode_pet(pet)

    # Indices 4-10 are health flags (7 total)
    # sensitive_stomach = index 4, joint_health = index 6
    assert vector[4] == 1  # sensitive_stomach
    assert vector[5] == 0  # weight_management
    assert vector[6] == 1  # joint_health
    assert vector[7] == 0  # skin_allergies

def test_product_vector_length(feature_engineer):
    """Verify product vector has correct length."""
    product = create_test_product()
    vector = feature_engineer.encode_product(product)
    assert len(vector) == 15

def test_product_vector_alignment(feature_engineer):
    """Verify pet and product vectors are aligned."""
    pet = create_test_pet()
    product = create_test_product()

    pet_vector = feature_engineer.encode_pet(pet)
    product_vector = feature_engineer.encode_product(product)

    # Both vectors must have same length
    assert len(pet_vector) == len(product_vector)

    # Health flags must be in same positions (indices 4-10)
    # If pet has sensitive_stomach flag and product supports it,
    # both should have 1 at index 4
    assert pet_vector[4] == product_vector[4] == 1

def test_missing_health_conditions(feature_engineer):
    """Verify default behavior when no health conditions."""
    pet = {
        "species": "dog",
        "breed": "golden_retriever",
        "age_months": 36,
        "weight_kg": 28.5,
        "health_conditions": []
    }
    vector = feature_engineer.encode_pet(pet)

    # All health flags should be 0
    assert all(vector[i] == 0 for i in range(4, 11))
```

**Similarity Engine Tests** (`tests/unit/test_similarity_engine.py`):

```python
import pytest
import numpy as np
from src.services.similarity_engine import SimilarityEngine

@pytest.fixture
def similarity_engine():
    return SimilarityEngine()

def test_perfect_match_high_score(similarity_engine):
    """Identical vectors should have similarity ~1.0."""
    pet_vector = np.array([0.5, 0.5, 0.8, 0.75, 1, 0, 1, 0, 0, 0, 0, 0.7, 0.5, 1800])
    product_vector = pet_vector.copy()

    score = similarity_engine.calculate_similarity(pet_vector, product_vector)
    assert score > 0.95  # Should be very high

def test_opposite_vectors_low_score(similarity_engine):
    """Opposite vectors should have low similarity."""
    pet_vector = np.array([0.2, 0.3, 0.8, 0.75, 1, 0, 1, 0, 0, 0, 0, 0.7, 0.5, 1800])
    product_vector = np.array([0.8, 0.7, 0.2, 0.25, 0, 1, 0, 1, 0, 0, 0, 0.3, 0.8, 500])

    score = similarity_engine.calculate_similarity(pet_vector, product_vector)
    assert score < 0.4  # Should be low

def test_health_condition_dominance(similarity_engine):
    """Health condition match should dominate score."""
    # Pet with sensitive stomach (index 4 = 1)
    pet_with_condition = np.array([0.5, 0.5, 0.8, 0.75, 1, 0, 0, 0, 0, 0, 0, 0.7, 0.5, 1800])

    # Product A: Supports sensitive stomach, poor nutritional match
    product_a = np.array([0.5, 0.5, 0.8, 0.75, 1, 0, 0, 0, 0, 0, 0, 0.3, 0.2, 500])

    # Product B: Doesn't support sensitive stomach, perfect nutritional match
    product_b = np.array([0.5, 0.5, 0.8, 0.75, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.5, 1800])

    score_a = similarity_engine.calculate_similarity(pet_with_condition, product_a)
    score_b = similarity_engine.calculate_similarity(pet_with_condition, product_b)

    # Product A should score higher (health condition weight = 0.40)
    assert score_a > score_b

def test_threshold_filtering(similarity_engine):
    """Products below threshold should be filtered."""
    pet_vector = np.array([0.5, 0.5, 0.8, 0.75, 1, 0, 1, 0, 0, 0, 0, 0.7, 0.5, 1800])

    products = [
        {"id": 1, "name": "Good Match"},
        {"id": 2, "name": "Poor Match"},
        {"id": 3, "name": "Medium Match"}
    ]

    product_vectors = np.array([
        [0.5, 0.5, 0.8, 0.75, 1, 0, 1, 0, 0, 0, 0, 0.7, 0.5, 1800],  # score ~0.95
        [0.1, 0.1, 0.1, 0.1, 0, 1, 0, 1, 0, 0, 0, 0.1, 0.1, 500],    # score ~0.1
        [0.4, 0.4, 0.6, 0.5, 1, 0, 0, 0, 0, 0, 0, 0.5, 0.4, 1500]    # score ~0.6
    ])

    recommendations = similarity_engine.get_recommendations(
        pet_vector, products, product_vectors, top_n=10
    )

    # Should only return products 1 and 3 (above 0.3 threshold)
    assert len(recommendations) == 2
    assert recommendations[0][0]["id"] == 1  # Best match first
    assert recommendations[1][0]["id"] == 3

def test_empty_recommendations_below_threshold(similarity_engine):
    """Return empty list if no products meet threshold."""
    pet_vector = np.array([0.5, 0.5, 0.8, 0.75, 1, 0, 1, 0, 0, 0, 0, 0.7, 0.5, 1800])

    products = [{"id": 1, "name": "Poor Match"}]
    product_vectors = np.array([
        [0.1, 0.1, 0.1, 0.1, 0, 1, 0, 1, 0, 0, 0, 0.1, 0.1, 500]  # Very low score
    ])

    recommendations = similarity_engine.get_recommendations(
        pet_vector, products, product_vectors, top_n=10
    )

    assert len(recommendations) == 0
```

---

### Integration Tests

**Recommendation API Tests** (`tests/integration/test_recommendations_api.py`):

```python
import pytest
from httpx import AsyncClient
from src.main import app
from tests.fixtures.seed_products import seed_test_products
from tests.fixtures.test_pets import GOLDEN_RETRIEVER_ADULT

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def mock_user_service(monkeypatch):
    """Mock user-service HTTP calls."""
    async def mock_get_pet(pet_id):
        return {
            "id": pet_id,
            "owner_id": 123,
            **GOLDEN_RETRIEVER_ADULT
        }

    monkeypatch.setattr(
        "src.services.user_service_client.UserServiceClient.get_pet",
        mock_get_pet
    )

@pytest.mark.asyncio
async def test_get_recommendations_success(client, mock_user_service):
    """Test successful recommendation retrieval."""
    # Seed test products
    await seed_test_products()

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=456&limit=10",
        headers={
            "X-User-ID": "123",
            "X-User-Role": "user"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "recommendations" in data["data"]
    assert len(data["data"]["recommendations"]) <= 10

    # Verify recommendations are sorted by score
    scores = [r["similarity_score"] for r in data["data"]["recommendations"]]
    assert scores == sorted(scores, reverse=True)

    # Verify all scores are above threshold
    assert all(score >= 0.3 for score in scores)

@pytest.mark.asyncio
async def test_get_recommendations_with_min_score(client, mock_user_service):
    """Test custom minimum score threshold."""
    await seed_test_products()

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=456&min_score=0.7",
        headers={"X-User-ID": "123"}
    )

    assert response.status_code == 200
    data = response.json()

    # All scores should be >= 0.7
    scores = [r["similarity_score"] for r in data["data"]["recommendations"]]
    assert all(score >= 0.7 for score in scores)

@pytest.mark.asyncio
async def test_unauthorized_pet_access(client, mock_user_service):
    """Test accessing another user's pet."""
    # Mock returns pet with different owner_id
    async def mock_get_other_user_pet(pet_id):
        return {
            "id": pet_id,
            "owner_id": 999,  # Different user
            **GOLDEN_RETRIEVER_ADULT
        }

    monkeypatch.setattr(
        "src.services.user_service_client.UserServiceClient.get_pet",
        mock_get_other_user_pet
    )

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=456",
        headers={"X-User-ID": "123"}  # User 123 trying to access user 999's pet
    )

    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"

@pytest.mark.asyncio
async def test_pet_not_found(client, mock_user_service):
    """Test requesting recommendations for non-existent pet."""
    # Mock raises 404
    async def mock_get_missing_pet(pet_id):
        from httpx import HTTPStatusError, Response, Request
        raise HTTPStatusError(
            "Not Found",
            request=Request("GET", "http://test"),
            response=Response(404)
        )

    monkeypatch.setattr(
        "src.services.user_service_client.UserServiceClient.get_pet",
        mock_get_missing_pet
    )

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=999",
        headers={"X-User-ID": "123"}
    )

    assert response.status_code == 404

@pytest.mark.asyncio
async def test_user_service_unavailable(client, mock_user_service):
    """Test handling when user-service is down."""
    async def mock_service_down(pet_id):
        from httpx import RequestError
        raise RequestError("Connection refused")

    monkeypatch.setattr(
        "src.services.user_service_client.UserServiceClient.get_pet",
        mock_service_down
    )

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=456",
        headers={"X-User-ID": "123"}
    )

    assert response.status_code == 503
    data = response.json()
    assert data["error"]["code"] == "SERVICE_UNAVAILABLE"

@pytest.mark.asyncio
async def test_no_recommendations_found(client, mock_user_service):
    """Test when no products meet threshold."""
    # Clear products or use pet profile that doesn't match any products
    await clear_test_products()

    response = await client.get(
        "/api/v1/recommendations/food?pet_id=456",
        headers={"X-User-ID": "123"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["data"]["recommendations"] == []
    assert "No products meet" in data["data"]["metadata"]["message"]
```

**Admin API Tests** (`tests/integration/test_admin_api.py`):

```python
@pytest.mark.asyncio
async def test_create_product_success(client):
    """Test creating a new product."""
    product_data = {
        "name": "Test Food",
        "brand": "Test Brand",
        "target_species": "dog",
        "protein_percentage": 28.0,
        "fat_percentage": 15.0,
        "calories_per_100g": 380,
        "price": 59.99
    }

    response = await client.post(
        "/api/v1/admin/products",
        json=product_data,
        headers={"X-User-Role": "admin"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "product_id" in data["data"]

@pytest.mark.asyncio
async def test_create_product_unauthorized(client):
    """Test non-admin cannot create products."""
    product_data = {"name": "Test Food", "brand": "Test Brand"}

    response = await client.post(
        "/api/v1/admin/products",
        json=product_data,
        headers={"X-User-Role": "user"}  # Not admin
    )

    assert response.status_code == 403
```

---

### Test Data Strategy

**Seed Products** (`tests/fixtures/seed_products.sql`):

Create 20-30 diverse products covering:
- **Life stages**: Puppy (3), adult (15), senior (5)
- **Sizes**: Small breed (8), medium (7), large (10)
- **Health conditions**: Sensitive stomach (5), weight management (4), joint health (6), skin allergies (3)
- **Nutritional profiles**: High protein (10), moderate (12), low fat (5)
- **Special diets**: Grain-free (8), organic (4), hypoallergenic (3)

**Test Pet Profiles** (`tests/fixtures/test_pets.py`):
```python
GOLDEN_RETRIEVER_ADULT = {
    "species": "dog",
    "breed": "golden_retriever",
    "age_months": 36,
    "weight_kg": 28.5,
    "health_conditions": ["joint_health"]
}

CHIHUAHUA_SENIOR = {
    "species": "dog",
    "breed": "chihuahua",
    "age_months": 120,
    "weight_kg": 2.8,
    "health_conditions": ["sensitive_stomach"]
}

LABRADOR_PUPPY = {
    "species": "dog",
    "breed": "labrador_retriever",
    "age_months": 6,
    "weight_kg": 15.0,
    "health_conditions": []
}

PERSIAN_CAT_ADULT = {
    "species": "cat",
    "breed": "persian",
    "age_months": 48,
    "weight_kg": 4.5,
    "health_conditions": ["skin_allergies"]
}
```

---

### Performance Tests

**Load Testing** (using locust or pytest-benchmark):

```python
@pytest.mark.benchmark
def test_recommendation_performance(benchmark):
    """Benchmark recommendation generation time."""
    pet_vector = create_test_pet_vector()
    product_vectors = create_test_product_vectors(n=1000)  # 1000 products

    def run_recommendations():
        return similarity_engine.get_recommendations(
            pet_vector, products, product_vectors, top_n=10
        )

    result = benchmark(run_recommendations)

    # Target: <50ms for 1000 products
    assert benchmark.stats.mean < 0.05  # 50ms

@pytest.mark.benchmark
def test_endpoint_latency(benchmark, client):
    """Benchmark end-to-end API latency."""
    async def make_request():
        return await client.get(
            "/api/v1/recommendations/food?pet_id=456",
            headers={"X-User-ID": "123"}
        )

    result = benchmark(make_request)

    # Target: <200ms end-to-end (includes user-service call)
    assert benchmark.stats.mean < 0.2  # 200ms
```

**Stress Testing:**
- Concurrent users: 100 simultaneous requests
- Target throughput: 100 requests/second
- Product catalog size: 10,000 products
- Test duration: 5 minutes

---

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-2)

**Tasks:**
1. Create service directory structure
2. Set up FastAPI application with basic routes
3. Configure PostgreSQL connection (SQLAlchemy async)
4. Create database schema and models
5. Implement standardized response utilities
6. Add health check endpoint
7. Create Dockerfile and docker-compose integration
8. Add to `backend-network` in docker-compose.yml

**Deliverables:**
- Service boots successfully
- Health check returns 200 OK
- Database schema created
- Basic FastAPI app with placeholder routes

---

### Phase 2: Feature Engineering (Days 2-3)

**Tasks:**
1. Implement `FeatureEngineer` class
2. Pet profile encoding logic
   - Age normalization
   - Weight normalization (breed-aware)
   - Breed characteristics lookup (from RAG or hardcoded initially)
   - Health condition one-hot encoding
   - Nutritional needs calculation
3. Product encoding logic
   - Target age/weight normalization
   - Health support flags
   - Nutritional profile normalization
4. Unit tests for feature engineering
5. Test with real pet/product data

**Deliverables:**
- `encode_pet()` function working
- `encode_product()` function working
- Vectors aligned (same length, same order)
- 100% unit test coverage for encoding

---

### Phase 3: Similarity Engine (Days 3-4)

**Tasks:**
1. Implement `SimilarityEngine` class
2. Weighted cosine similarity calculation
3. Batch recommendation generation
4. Threshold filtering
5. Match reason generation (explainability)
6. Unit tests for similarity algorithm
7. Performance optimization (vectorized operations)

**Deliverables:**
- `calculate_similarity()` function working
- `get_recommendations()` returns ranked results
- Threshold filtering functional
- Unit tests pass

---

### Phase 4: User-Service Integration (Day 4)

**Tasks:**
1. Implement `UserServiceClient` HTTP client
2. Pet profile fetching logic
3. Error handling (404, 403, 503)
4. Ownership verification
5. Integration tests with mocked user-service

**Deliverables:**
- Can fetch pet profiles from user-service
- Ownership verification working
- Error handling robust

---

### Phase 5: Recommendation API (Days 4-5)

**Tasks:**
1. Implement `GET /api/v1/recommendations/food` endpoint
2. Request validation (Pydantic schemas)
3. Auth header extraction (X-User-ID, X-User-Role)
4. Integrate all components:
   - Fetch pet from user-service
   - Encode pet profile
   - Query products from database
   - Encode products
   - Calculate similarities
   - Return top N with match reasons
5. Integration tests for happy path and error cases

**Deliverables:**
- Recommendation endpoint working end-to-end
- Returns correct JSON format
- All error cases handled
- Integration tests pass

---

### Phase 6: Product Management (Days 5-6)

**Tasks:**
1. Implement admin endpoints:
   - POST /api/v1/admin/products
   - PUT /api/v1/admin/products/{id}
   - PATCH /api/v1/admin/products/{id}
   - DELETE /api/v1/admin/products/{id}
   - GET /api/v1/admin/products (list with pagination)
2. Role-based authorization (check X-User-Role header)
3. Validation schemas
4. Integration tests for admin endpoints
5. Seed initial product catalog (20-30 products)

**Deliverables:**
- Admin can create/update/delete products
- Pagination working
- Product catalog seeded with test data

---

### Phase 7: Testing & Optimization (Days 6-7)

**Tasks:**
1. Comprehensive unit test suite (target: 90% coverage)
2. Integration test suite (all endpoints, all error cases)
3. Performance testing (load, stress, latency)
4. Bug fixes and edge cases
5. Code review and refactoring
6. Documentation (README, API docs)

**Deliverables:**
- All tests passing
- Performance targets met (<200ms p95)
- Code reviewed and clean
- Documentation complete

---

### Phase 8: API Gateway Integration (Day 7)

**Tasks:**
1. Add recommendation-service URL to API Gateway config
2. API Gateway automatically proxies `/api/v1/recommendations/*`
3. Test through API Gateway (JWT auth, rate limiting)
4. End-to-end testing through full stack

**Deliverables:**
- Recommendation service accessible via API Gateway
- Auth and rate limiting working
- Full stack integration tested

---

## Configuration

### Environment Variables

**`.env.example`:**
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@db:5432/smartbreeds?options=-c%20search_path=recommendation_schema

# User Service
USER_SERVICE_URL=http://user-service:3002

# Feature Weights (tunable)
WEIGHT_HEALTH_CONDITIONS=0.40
WEIGHT_AGE_COMPATIBILITY=0.20
WEIGHT_NUTRITIONAL_PROFILE=0.20
WEIGHT_SIZE_COMPATIBILITY=0.10
WEIGHT_INGREDIENT_PREFERENCES=0.10

# Algorithm Parameters
MIN_SIMILARITY_THRESHOLD=0.3
DEFAULT_RECOMMENDATION_LIMIT=10
MAX_RECOMMENDATION_LIMIT=50

# Supervised Learning (future)
SUPERVISED_LEARNING_ENABLED=false
SUPERVISED_LEARNING_MIN_FEEDBACK=1000
MODEL_PATH=/app/models/rf_model_latest.pkl

# Logging
LOG_LEVEL=INFO
```

### Feature Weight Tuning

**How to adjust weights:**
1. Edit `src/config.py` or `.env` file
2. Restart service
3. Run integration tests to verify behavior
4. Monitor user engagement metrics (CTR, time spent)
5. Iterate based on real-world performance

**Guidelines:**
- Health conditions should remain highest (0.30-0.50)
- Sum of all weights doesn't need to equal 1.0 (normalized in algorithm)
- Start conservative, adjust based on data
- Document all changes in git commit messages

---

## Future Enhancements

### Short-term (Months 1-6)

1. **Match Reason Generation**
   - Natural language explanations: "This product supports joint health, which is important for Golden Retrievers"
   - Use Ollama to generate contextual explanations

2. **Product Image Storage**
   - Upload product images to S3 or local storage
   - Serve via CDN for fast loading

3. **Price Filtering**
   - Allow users to filter by price range (budget, premium, luxury)
   - Include price tier as feature in ML model

4. **Breed-Specific Knowledge**
   - Integrate with RAG service for breed characteristics
   - Lookup breed energy level, size, common health issues from ChromaDB

5. **Admin Dashboard**
   - Web UI for product management
   - Analytics: most recommended products, CTR by product

---

### Medium-term (Months 6-12)

1. **Supervised Learning Model**
   - Train RandomForest on user feedback
   - A/B test against similarity baseline
   - Automatic retraining pipeline

2. **Multi-Product Categories**
   - Expand beyond food: toys, accessories, grooming products
   - Separate models per category

3. **Personalized Recommendations**
   - User preferences (organic-only, grain-free-only)
   - Price sensitivity
   - Brand preferences

4. **Recommendation History**
   - Track what was recommended to whom
   - Avoid showing same products repeatedly
   - Personalized "new for you" section

5. **Real-time Analytics**
   - Dashboard showing recommendation quality metrics
   - CTR by breed, age, health condition
   - Model performance monitoring

---

### Long-term (12+ months)

1. **Collaborative Filtering**
   - "Pets like yours also enjoyed..."
   - User-user similarity
   - Hybrid content + collaborative approach

2. **External Product APIs**
   - Integrate with pet retailer APIs
   - Real-time pricing and availability
   - Affiliate links for revenue

3. **Contextual Bandits**
   - Exploration vs exploitation
   - Learn which products to show in which contexts
   - Adaptive recommendations

4. **Deep Learning**
   - Neural network for complex patterns
   - Embedding layers for pets and products
   - Requires large dataset (10,000+ interactions)

5. **Multi-modal Recommendations**
   - Include pet image in recommendation logic
   - Visual similarity between pet and product images
   - "This food packaging appeals to owners of fluffy dogs"

---

## Appendix

### Glossary

- **Content-Based Filtering**: Recommending items based on similarity between item features and user/pet preferences
- **Collaborative Filtering**: Recommending items based on what similar users/pets liked
- **Cosine Similarity**: Measure of similarity between two vectors (ranges 0-1)
- **Feature Engineering**: Transforming raw data into numerical features for ML algorithms
- **One-Hot Encoding**: Binary representation of categorical variables
- **Supervised Learning**: ML trained on labeled data (input → output pairs)
- **Weighted Similarity**: Similarity calculation where some features matter more than others

### References

- scikit-learn documentation: https://scikit-learn.org/stable/
- FastAPI documentation: https://fastapi.tiangolo.com/
- SQLAlchemy async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- Recommendation Systems (Aggarwal): https://link.springer.com/book/10.1007/978-3-319-29659-3

---

**End of Design Document**
