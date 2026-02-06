# DATAFLOW.md

This document provides a centralized reference for all API endpoints, request/response formats, and data flows between frontend and backend services in the SmartBreeds platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Flow](#authentication-flow)
3. [API Gateway](#api-gateway)
4. [Auth Service Endpoints](#auth-service-endpoints)
5. [User Service Endpoints](#user-service-endpoints)
6. [AI Service Endpoints](#ai-service-endpoints)
7. [Classification Service](#classification-service-internal)
8. [Recommendation Service Endpoints](#recommendation-service-endpoints)
9. [Response Format Standards](#response-format-standards)
10. [Error Codes Reference](#error-codes-reference)
11. [Rate Limiting](#rate-limiting)

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐      ┌─────────────────────────────────────┐
│   Browser   │────▶│    Nginx    │────▶│           API Gateway               │
│  (Frontend) │     │  (80/443)   │      │            (8001)                   │
└─────────────┘     └─────────────┘      └───────────────┬─────────────────────┘
                                                         │
                     ┌───────────────────────────────────┼─────────────────────┐
                     │                                   │                     │
               ┌─────▼─────┐    ┌─────────────┐    ┌─────▼─────┐    ┌─────────────────────┐
               │   Auth    │    │    User     │    │    AI     │    │   Recommendation    │
               │  Service  │    │   Service   │    │  Service  │    │      Service        │
               │  (3001)   │    │   (3002)    │    │  (3003)   │    │      (3005)         │
               └─────┬─────┘    └──────┬──────┘    └─────┬─────┘    └──────────┬──────────┘
                     │                 │                 │                     │
                     │                 │           ┌─────▼─────┐               │
                     │                 │           │Classification             │
                     │                 │           │  Service   │              │
                     │                 │           │  (3004)    │              │
                     │                 │           └────────────┘              │
                     │                 │                                       │
               ┌─────▼─────────────────▼───────────────────────────────────────▼─────┐
               │                         PostgreSQL                                  │
               │   (auth_schema | user_schema | recommendation_schema)               │
               └─────────────────────────────────────────────────────────────────────┘
```

### Key Points

- **All requests go through API Gateway** - Backend services are NOT directly accessible
- **Base URL for all API calls:** `http://localhost:8001` (dev) or `https://yourdomain.com` (prod)
- **Authentication:** JWT tokens stored in HTTP-only cookies (automatically sent with requests)
- **Backend services communicate internally** via Docker network

---

## Authentication Flow

### Login Flow

```
Frontend                    API Gateway                 Auth Service
   │                            │                            │
   │──POST /api/v1/auth/login──▶│                            │
   │   {email, password}        │──────forward──────────────▶│
   │                            │                            │
   │                            │◀────JWT tokens─────────────│
   │◀───Set-Cookie: access_token, refresh_token──────────────│
   │    (HTTP-only cookies)     │                            │
```

### Authenticated Request Flow

```
Frontend                    API Gateway                 Backend Service
   │                            │                            │
   │──GET /api/v1/users/me─────▶│                            │
   │   Cookie: access_token     │                            │
   │                            │──validate JWT──┐           │
   │                            │◀───────────────┘           │
   │                            │                            │
   │                            │──forward + X-User-ID──────▶│
   │                            │                            │
   │◀───────────response────────│◀──────────response─────────│
```

### Token Refresh Flow

```
Frontend                    API Gateway                 Auth Service
   │                            │                            │
   │  (access_token expired)    │                            │
   │◀────401 TOKEN_EXPIRED──────│                            │
   │                            │                            │
   │──POST /api/v1/auth/refresh─▶                            │
   │   Cookie: refresh_token    │──────forward──────────────▶│
   │                            │                            │
   │                            │◀────new tokens─────────────│
   │◀───Set-Cookie: new tokens──│                            │
```

---

## API Gateway

**Base URL:** `http://localhost:8001`

### Route Mapping

| Path Prefix | Target Service | Port |
|------------|----------------|------|
| `/api/v1/auth/*` | Auth Service | 3001 |
| `/api/v1/users/*` | User Service | 3002 |
| `/api/v1/pets/*` | User Service | 3002 |
| `/api/v1/analyses/*` | User Service | 3002 |
| `/api/v1/vision/*` | AI Service | 3003 |
| `/api/v1/recommendations/*` | Recommendation Service | 3005 |
| `/api/v1/admin/products/*` | Recommendation Service | 3005 |

### Public Endpoints (No Auth Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/docs` | Swagger documentation |
| GET | `/openapi.json` | OpenAPI schema |
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh` | Token refresh |

---

## Auth Service Endpoints

### POST /api/v1/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": false
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Cookies Set:**
- `access_token` (HttpOnly, 15 min TTL)
- `refresh_token` (HttpOnly, 7 day TTL)

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Invalid email format or password requirements not met |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |

---

### POST /api/v1/auth/login

Authenticate user with credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": false
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Cookies Set:**
- `access_token` (HttpOnly, 15 min TTL)
- `refresh_token` (HttpOnly, 7 day TTL)

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_DISABLED` | 403 | Account is disabled |

---

### POST /api/v1/auth/refresh

Exchange refresh token for new tokens (token rotation).

**Request:** No body required (uses `refresh_token` cookie)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": false
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Cookies Set:** New `access_token` and `refresh_token` (old tokens revoked)

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `MISSING_TOKEN` | 401 | No refresh token cookie |
| `INVALID_TOKEN` | 401 | Token invalid or expired |
| `TOKEN_REVOKED` | 401 | Token has been revoked |
| `ACCOUNT_DISABLED` | 403 | Account is disabled |

---

### POST /api/v1/auth/logout

**Auth Required:** Yes

Revoke tokens and clear authentication cookies.

**Request:** No body required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Cookies Cleared:** `access_token`, `refresh_token`

---

### GET /api/v1/auth/verify

**Auth Required:** Yes

Verify if access token is valid.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_verified": false
    },
    "valid": true
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### DELETE /api/v1/auth/delete

**Auth Required:** Yes

Delete user account with cascade deletion across all services.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User account user@example.com deleted successfully",
    "deleted": {
      "profiles": 1,
      "pets": 3,
      "analyses": 15
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

## User Service Endpoints

### GET /api/v1/users/me

**Auth Required:** Yes

Get current user's profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1-555-0123",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "country": "USA"
    },
    "preferences": {},
    "created_at": "2026-01-14T12:00:00.000000",
    "updated_at": "2026-01-14T12:00:00.000000"
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### PUT /api/v1/users/me

**Auth Required:** Yes

Replace entire user profile.

**Request:**
```json
{
  "phone": "+1-555-0123",
  "address": {
    "street": "456 Oak Ave",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90001",
    "country": "USA"
  },
  "preferences": {
    "notifications_enabled": true,
    "theme": "dark"
  }
}
```

**Response (200):** Updated profile object

---

### PATCH /api/v1/users/me

**Auth Required:** Yes

Partial update of user profile.

**Request:**
```json
{
  "phone": "+1-555-9999"
}
```

**Response (200):** Updated profile object

---

### DELETE /api/v1/users/delete

**Auth Required:** Yes

Delete all user data (profile, pets, analyses).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User data deleted successfully",
    "deleted": {
      "profiles": 1,
      "pets": 3,
      "analyses": 15
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### GET /api/v1/pets

**Auth Required:** Yes

List all pets for current user.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Buddy",
      "breed": "Golden Retriever",
      "breed_confidence": 0.87,
      "species": "dog",
      "age": 3,
      "weight": 32.5,
      "health_conditions": ["joint_health"],
      "image_url": "https://example.com/images/buddy.jpg",
      "created_at": "2026-01-14T12:00:00.000000",
      "updated_at": "2026-01-14T12:00:00.000000"
    }
  ],
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### POST /api/v1/pets

**Auth Required:** Yes

Create a new pet.

**Request:**
```json
{
  "name": "Buddy",
  "species": "dog",
  "breed": "Golden Retriever",
  "age": 3,
  "weight": 32.5,
  "health_conditions": ["joint_health"]
}
```

**Required Fields:** `name`, `species`

**Optional Fields:** `breed`, `age`, `weight`, `health_conditions`, `image_url`

**Response (201):** Created pet object

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Invalid species, negative age, non-positive weight |

---

### GET /api/v1/pets/{id}

**Auth Required:** Yes

Get specific pet details.

**Response (200):** Pet object

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `NOT_FOUND` | 404 | Pet not found or not owned by user |

---

### PUT /api/v1/pets/{id}

**Auth Required:** Yes

Replace entire pet record.

**Request:**
```json
{
  "name": "Buddy Updated",
  "species": "dog",
  "breed": "Golden Retriever Mix",
  "age": 4,
  "weight": 33.0,
  "health_conditions": ["joint_health", "sensitive_stomach"]
}
```

**Response (200):** Updated pet object

---

### PATCH /api/v1/pets/{id}

**Auth Required:** Yes

Partial update of pet.

**Request:**
```json
{
  "age": 4,
  "weight": 33.0
}
```

**Response (200):** Updated pet object

---

### DELETE /api/v1/pets/{id}

**Auth Required:** Yes

Delete a pet.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Pet deleted successfully"
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### GET /api/v1/pets/{id}/analyses

**Auth Required:** Yes

Get analysis history for a specific pet.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "pet_id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "image_url": "https://example.com/images/analysis1.jpg",
      "breed_detected": "Golden Retriever",
      "confidence": 0.87,
      "traits": {
        "size": "large",
        "energy_level": "high",
        "temperament": "friendly and loyal"
      },
      "raw_response": {},
      "created_at": "2026-01-14T12:00:00.000000"
    }
  ],
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### GET /api/v1/analyses

**Auth Required:** Yes

List all analyses for current user.

**Response (200):** Array of analysis objects

---

### POST /api/v1/analyses

**Auth Required:** Yes

Create a new analysis record (typically after AI analysis).

**Request:**
```json
{
  "pet_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_url": "https://example.com/images/analysis.jpg",
  "breed_detected": "Golden Retriever",
  "confidence": 0.87,
  "traits": {
    "size": "large",
    "energy_level": "high",
    "temperament": "friendly and loyal"
  },
  "raw_response": {}
}
```

**Response (201):** Created analysis object

---

### GET /api/v1/analyses/{id}

**Auth Required:** Yes

Get specific analysis.

**Response (200):** Analysis object

---

## AI Service Endpoints

### POST /api/v1/vision/analyze

**Auth Required:** Yes

Analyze pet image through multi-stage AI pipeline.

**Pipeline Stages:**
1. Content safety check (NSFW detection)
2. Species detection (dog/cat)
3. Breed classification with crossbreed detection
4. RAG enrichment (breed knowledge from ChromaDB)
5. Ollama contextual analysis

**Request:**
```json
{
  "image": "base64-encoded-image-data"
}
```

**Note:** Image can include or exclude data URI prefix (`data:image/jpeg;base64,`)

**Response (200) - Purebred:**
```json
{
  "success": true,
  "data": {
    "species": "dog",
    "breed_analysis": {
      "primary_breed": "Golden Retriever",
      "confidence": 0.87,
      "is_likely_crossbreed": false,
      "breed_probabilities": [
        {"breed": "Golden Retriever", "probability": 0.87},
        {"breed": "Labrador Retriever", "probability": 0.08},
        {"breed": "Retriever Mix", "probability": 0.05}
      ],
      "crossbreed_analysis": null
    },
    "description": "A beautiful golden-coated dog with distinctive retriever features...",
    "traits": {
      "size": "large",
      "energy_level": "high",
      "temperament": "friendly, intelligent, and eager to please"
    },
    "health_observations": [
      "Healthy coat condition",
      "Good body condition score",
      "Alert and active demeanor"
    ],
    "enriched_info": {
      "breed": "Golden Retriever",
      "parent_breeds": null,
      "description": "The Golden Retriever is a large-sized dog...",
      "care_summary": "Regular grooming, daily exercise, positive reinforcement training...",
      "health_info": "Prone to hip dysplasia and certain cancers...",
      "sources": ["knowledge_base/species/dogs.md"]
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Response (200) - Crossbreed:**
```json
{
  "success": true,
  "data": {
    "species": "dog",
    "breed_analysis": {
      "primary_breed": "Mixed Breed",
      "confidence": 0.38,
      "is_likely_crossbreed": true,
      "breed_probabilities": [
        {"breed": "Labrador Retriever", "probability": 0.20},
        {"breed": "Poodle", "probability": 0.18}
      ],
      "crossbreed_analysis": {
        "detected_breeds": ["Labrador Retriever", "Poodle"],
        "common_name": "Labradoodle",
        "confidence_reasoning": "Multiple breeds detected with comparable confidence scores"
      }
    },
    "description": "A curly-coated mixed breed dog showing characteristics of both Labrador and Poodle...",
    "traits": {
      "size": "medium to large",
      "energy_level": "high",
      "temperament": "intelligent, friendly, hypoallergenic coat"
    },
    "health_observations": [
      "Healthy coat condition",
      "Good body structure"
    ],
    "enriched_info": {
      "breed": "Labradoodle",
      "parent_breeds": ["Labrador Retriever", "Poodle"],
      "description": "The Labradoodle is a crossbreed dog...",
      "care_summary": "Regular grooming needed, daily exercise...",
      "health_info": "May inherit conditions from either parent breed...",
      "sources": ["knowledge_base/crossbreeds/labradoodle.md"]
    }
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `INVALID_IMAGE_FORMAT` | 422 | Image format invalid or corrupted |
| `IMAGE_TOO_LARGE` | 422 | Image exceeds size limit |
| `IMAGE_TOO_SMALL` | 422 | Image dimensions too small |
| `CONTENT_POLICY_VIOLATION` | 422 | NSFW content detected |
| `UNSUPPORTED_SPECIES` | 422 | Not a dog or cat |
| `SPECIES_DETECTION_FAILED` | 422 | Cannot identify species with confidence |
| `BREED_DETECTION_FAILED` | 422 | Cannot identify breed with confidence |
| `SERVICE_UNAVAILABLE` | 503 | Ollama or Classification service down |

---

## Classification Service (Internal)

**Note:** This service is internal-only and called by AI Service. Not accessible via API Gateway.

### POST /classify/content

Check image content safety.

**Request:**
```json
{
  "image": "base64-encoded-image"
}
```

**Response:**
```json
{
  "is_safe": true,
  "nsfw_probability": 0.02,
  "threshold": 0.70
}
```

---

### POST /classify/species

Detect animal species.

**Request:**
```json
{
  "image": "base64-encoded-image",
  "top_k": 3
}
```

**Response:**
```json
{
  "species": "dog",
  "confidence": 0.98,
  "top_predictions": [
    {"label": "dog", "confidence": 0.98},
    {"label": "cat", "confidence": 0.01},
    {"label": "other", "confidence": 0.01}
  ]
}
```

---

### POST /classify/breed

Detect breed from image.

**Request:**
```json
{
  "image": "base64-encoded-image",
  "species": "dog",
  "top_k": 5
}
```

**Response:**
```json
{
  "breed_analysis": {
    "primary_breed": "Golden Retriever",
    "confidence": 0.87,
    "is_likely_crossbreed": false,
    "breed_probabilities": [
      {"breed": "Golden Retriever", "probability": 0.87},
      {"breed": "Labrador Retriever", "probability": 0.08}
    ],
    "crossbreed_analysis": null
  }
}
```

---

## Recommendation Service Endpoints

### GET /api/v1/recommendations/food

**Auth Required:** Yes

Get personalized food recommendations for a pet.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pet_id` | UUID | Yes | - | Pet to get recommendations for |
| `limit` | int | No | 10 | Number of recommendations (max: 50) |
| `min_score` | float | No | 0.0 | Minimum similarity threshold (0.0-1.0) |

**Example:** `GET /api/v1/recommendations/food?pet_id=660e8400-e29b-41d4-a716-446655440001&limit=5`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "pet": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Buddy",
      "species": "dog",
      "breed": "Golden Retriever",
      "age_months": 36,
      "weight_kg": 32.5,
      "health_conditions": ["joint_health"]
    },
    "recommendations": [
      {
        "product_id": 1,
        "name": "Premium Joint Care Dog Food",
        "brand": "NutraPet",
        "price": 49.99,
        "product_url": "https://example.com/product/1",
        "image_url": "https://example.com/image/1.jpg",
        "similarity_score": 0.92,
        "rank_position": 1,
        "match_reasons": ["Targets joint health", "Suitable for large breeds"],
        "nutritional_highlights": {
          "protein_percentage": 26.0,
          "fat_percentage": 14.0,
          "calories_per_100g": 375
        }
      },
      {
        "product_id": 3,
        "name": "Omega-3 Canine Formula",
        "brand": "PetVitality",
        "price": 39.99,
        "product_url": "https://example.com/product/3",
        "image_url": "https://example.com/image/3.jpg",
        "similarity_score": 0.78,
        "rank_position": 2,
        "match_reasons": ["Nutritionally compatible"],
        "nutritional_highlights": {
          "protein_percentage": 24.0,
          "fat_percentage": 16.0,
          "calories_per_100g": 380
        }
      }
    ],
    "metadata": {
      "total_products_evaluated": 14,
      "products_above_threshold": 2,
      "recommendations_returned": 2
    },
    "algorithm_version": "content-based-v1.0"
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

**Errors:**
| Code | Status | Reason |
|------|--------|--------|
| `NOT_FOUND` | 404 | Pet not found or not owned by user |
| `UNAUTHORIZED` | 401 | Missing X-User-ID header |

---

### POST /api/v1/admin/products

**Auth Required:** Yes (admin role)

Create a new product.

**Request:**
```json
{
  "name": "Premium Joint Care Dog Food",
  "brand": "NutraPet",
  "description": "Specialized formula for joint support in senior dogs",
  "price": 49.99,
  "product_url": "https://example.com/product",
  "image_url": "https://example.com/image.jpg",
  "target_species": "dog",
  "min_age_months": 60,
  "max_age_months": null,
  "min_weight_kg": 20.0,
  "max_weight_kg": 50.0,
  "suitable_breeds": ["Golden Retriever", "Labrador Retriever"],
  "protein_percentage": 26.0,
  "fat_percentage": 14.0,
  "fiber_percentage": 4.0,
  "calories_per_100g": 375,
  "grain_free": true,
  "organic": false,
  "hypoallergenic": false,
  "limited_ingredient": false,
  "raw_food": false,
  "for_sensitive_stomach": false,
  "for_weight_management": false,
  "for_joint_health": true,
  "for_skin_allergies": false,
  "for_dental_health": false,
  "for_kidney_health": false
}
```

**Required Fields:** `name`, `brand`, `price`, `target_species`

**Response (201):** Created product object with `id` and `is_active: true`

---

### GET /api/v1/admin/products

**Auth Required:** Yes (admin role)

List all products with optional filtering.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `species` | string | No | - | Filter by "dog" or "cat" |
| `include_inactive` | bool | No | false | Include inactive products |
| `limit` | int | No | 50 | Max products to return (max: 200) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      { /* product objects */ }
    ],
    "total": 14
  },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

### GET /api/v1/admin/products/{product_id}

**Auth Required:** Yes (admin role)

Get a single product.

**Response (200):** Product object

---

### PUT /api/v1/admin/products/{product_id}

**Auth Required:** Yes (admin role)

Update an existing product.

**Request:** Same schema as POST, all fields optional

**Response (200):** Updated product object

---

### DELETE /api/v1/admin/products/{product_id}

**Auth Required:** Yes (admin role)

Soft-delete a product (sets `is_active: false`).

**Response:** 204 No Content

---

## Response Format Standards

### Success Response

```json
{
  "success": true,
  "data": { /* response payload */ },
  "error": null,
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional info */ }
  },
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `INVALID_TOKEN` | 401 | Token is invalid or malformed |
| `TOKEN_REVOKED` | 401 | Token has been revoked |
| `MISSING_TOKEN` | 401 | No token provided |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_DISABLED` | 403 | User account is disabled |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `INVALID_IMAGE_FORMAT` | 422 | Image format invalid |
| `IMAGE_TOO_LARGE` | 422 | Image exceeds size limit |
| `CONTENT_POLICY_VIOLATION` | 422 | NSFW content detected |
| `UNSUPPORTED_SPECIES` | 422 | Not a supported animal |
| `SPECIES_DETECTION_FAILED` | 422 | Cannot identify species |
| `BREED_DETECTION_FAILED` | 422 | Cannot identify breed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Backend service down |

---

## Rate Limiting

| Layer | Limit | Scope |
|-------|-------|-------|
| Nginx | 200 req/min | Per IP |
| API Gateway | 60 req/min | Per user |

**Headers in Response:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window

**Rate Limit Exceeded Response (429):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "retry_after_seconds": 60
    }
  },
  "timestamp": "2026-02-06T12:00:00.000000"
}
```

---

## Frontend Integration Notes

### Making Authenticated Requests

Since authentication uses HTTP-only cookies, no manual token handling is needed:

```typescript
// Example: Fetch user profile
const response = await fetch('http://localhost:8001/api/v1/users/me', {
  method: 'GET',
  credentials: 'include', // IMPORTANT: Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

### Handling Token Refresh

```typescript
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let response = await fetch(url, { ...options, credentials: 'include' });

  if (response.status === 401) {
    const error = await response.json();

    if (error.error?.code === 'TOKEN_EXPIRED') {
      // Attempt token refresh
      const refreshResponse = await fetch('http://localhost:8001/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        // Retry original request with new tokens
        response = await fetch(url, { ...options, credentials: 'include' });
      } else {
        // Refresh failed - redirect to login
        window.location.href = '/login';
      }
    }
  }

  return response;
}
```

### Image Upload for Analysis

```typescript
async function analyzeImage(file: File): Promise<AnalysisResult> {
  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('http://localhost:8001/api/v1/vision/analyze', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64 }),
  });

  return response.json();
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-06 | Initial documentation |

