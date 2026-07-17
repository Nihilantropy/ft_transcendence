# Recommendation Service Test Notebook Design

## Overview

Create a Jupyter notebook to test the recommendation service end-to-end, demonstrating the full data flow from AI image analysis to personalized product recommendations.

**File:** `scripts/jupyter/test_recommendation_service.ipynb`

## Prerequisites

- All services running (`docker compose up -d`)
- Products seeded (`docker exec ft_transcendence_recommendation_service python scripts/seed_products.py`)
- Test image in `scripts/jupyter/test_data/images/`

## Notebook Structure

### Cell 1: Markdown Intro
- Purpose: Test full integration flow (AI → Pet → Recommendations)
- Architecture overview (text-based)
- Prerequisites checklist

### Cell 2: Setup
```python
import requests, json, base64, os
from pathlib import Path
from PIL import Image
from IPython.display import display
import pandas as pd

API_GATEWAY_URL = "http://localhost:8001"
TEST_IMAGES_DIR = Path("test_data/images")
TEST_USER_EMAIL = "test_recommendations@example.com"
TEST_USER_PASSWORD = "testpassword123"
session = requests.Session()
```

### Cell 3: Authentication
- Register user (or login if exists)
- Session maintains JWT cookie

### Cell 4: AI Analysis
- Load first available image from test_data/images/
- POST to `/api/v1/vision/analyze`
- Extract: species, breed, confidence, crossbreed status
- Display image + analysis summary

### Cell 5: Pet Creation
- Build pet profile from AI results + hardcoded values:
  - `name`: "TestPet" + species
  - `species`: from AI
  - `breed`: from AI (primary_breed)
  - `age`: 24 (months)
  - `weight`: 5.5 (kg)
  - `health_conditions`: ["sensitive_stomach"]
- POST to `/api/v1/users/me/pets`
- Store pet_id for recommendations

### Cell 6: Get Recommendations
- GET `/api/v1/recommendations/food?pet_id={pet_id}&limit=10&min_score=0.3`
- Store full response for display

### Cell 7: Results Display

**Part A - Data Flow Summary:**
```
📊 DATA FLOW SUMMARY
━━━━━━━━━━━━━━━━━━━━
AI Detection    → {species} ({breed}, {confidence}% confidence)
Pet Profile     → "{name}" | {age} months | {weight}kg | {health_conditions}
Products Found  → {matched} of {total} products (min_score: 0.3)
Top Match       → "{product_name}" (score: {score})
```

**Part B - Detailed Breakdown:**
- Pet profile table (all fields)
- Recommendations table: rank, name, brand, score, match reasons
- Metadata: products evaluated, algorithm version

### Cell 8: Cleanup
- DELETE `/api/v1/auth/delete`
- Confirms user + pets deleted
- Products remain (seed data)

### Cell 9: Summary Markdown
- What was demonstrated
- Architecture benefits shown

## Test Values Rationale

| Field | Value | Why |
|-------|-------|-----|
| age | 24 months | Adult pet, compatible with most products |
| weight | 5.5 kg | Medium size, within typical ranges |
| health_conditions | ["sensitive_stomach"] | Triggers `for_sensitive_stomach` product boost |

## Error Handling

- Each step checks HTTP status
- Clear error messages if service unavailable
- Graceful handling of empty recommendation results

## Data Flow Visualization

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│   Image     │───▶│ AI Service  │───▶│ Species + Breed     │
└─────────────┘    └─────────────┘    └──────────┬──────────┘
                                                  │
                                                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│ User Input  │───▶│ Pet Profile │◀───│ age, weight, health │
│ (hardcoded) │    └──────┬──────┘    └─────────────────────┘
└─────────────┘           │
                          ▼
              ┌───────────────────────┐
              │ Recommendation Service │
              │  - Feature extraction  │
              │  - Cosine similarity   │
              │  - Health weighting    │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Ranked Products with  │
              │ match reasons + scores │
              └───────────────────────┘
```
