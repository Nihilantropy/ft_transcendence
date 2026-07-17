# Integration Tests for Recommendation Service

## Overview

Integration tests validate the full end-to-end flow through the API Gateway. These tests are **separate from unit tests** and require all services to be running.

**Test Coverage:**
- ✅ Recommendation endpoint through API Gateway with JWT auth
- ✅ Admin CRUD operations with role-based access control
- ✅ Pet ownership verification
- ✅ Species filtering and health condition prioritization
- ✅ Similarity scoring and threshold filtering
- ✅ Explainable recommendations (match reasons)
- ✅ Error handling (unauthorized, not found, validation errors)

## Prerequisites

1. **All services running:**
   ```bash
   make up
   ```

2. **Database migrations applied:**
   ```bash
   make migration
   ```

3. **Seed data loaded:**
   ```bash
   docker exec ft_transcendence_recommendation_service python scripts/seed_products.py
   ```

4. **Admin user created (for admin tests):**
   ```bash
   docker exec ft_transcendence_auth_service python manage.py createsuperuser
   # Email: admin@example.com
   # Password: AdminPass123!@#
   ```

## Running Integration Tests

### Run All Integration Tests
```bash
docker compose run --rm recommendation-service pytest tests/integration/ -v
```

### Run Specific Test File
```bash
# Recommendation endpoint tests
docker compose run --rm recommendation-service pytest tests/integration/test_recommendations_e2e.py -v

# Admin API tests
docker compose run --rm recommendation-service pytest tests/integration/test_admin_e2e.py -v
```

### Run Specific Test Function
```bash
docker compose run --rm recommendation-service pytest tests/integration/test_recommendations_e2e.py::test_get_recommendations_success -v
```

### Run with Verbose Output
```bash
docker compose run --rm recommendation-service pytest tests/integration/ -v -s
```

## Important Notes

⚠️ **Do NOT run integration tests with unit tests:**
```bash
# ❌ WRONG - will run both unit and integration tests
docker compose run --rm recommendation-service pytest tests/ -v

# ✅ CORRECT - unit tests only
docker compose run --rm recommendation-service pytest tests/unit/ -v

# ✅ CORRECT - integration tests only
docker compose run --rm recommendation-service pytest tests/integration/ -v
```

⚠️ **Integration tests use real database transactions:**
- Tests create test users, pets, and products
- Most tests clean up after themselves
- If tests fail mid-execution, you may need to manually clean up test data

⚠️ **Integration tests require network access:**
- Tests communicate with API Gateway (http://api-gateway:8001)
- API Gateway routes to backend services (user-service, auth-service, recommendation-service)
- Network isolation is enforced (backend services not exposed to localhost)

## Test Structure

### Recommendation Endpoint Tests (`test_recommendations_e2e.py`)

1. **Authentication Flow:**
   - Registers/logs in test user
   - Creates test pet (Golden Retriever with joint health condition)
   - Requests recommendations through API Gateway

2. **Success Cases:**
   - `test_get_recommendations_success` - Basic recommendation retrieval
   - `test_recommendations_with_health_condition_match` - Health condition prioritization (40% weight)
   - `test_recommendations_respects_species` - Species filtering (dog food for dogs)
   - `test_recommendations_with_custom_limit` - Limit parameter respected
   - `test_recommendations_for_cat` - Cat-specific recommendations

3. **Error Cases:**
   - `test_recommendations_unauthorized_pet_access` - Cannot access other users' pets
   - `test_recommendations_unauthenticated` - Requires authentication

4. **Feature Validation:**
   - `test_recommendations_with_min_score_threshold` - Threshold filtering works
   - `test_recommendations_match_reasons_explainability` - Match reasons provided
   - `test_recommendations_nutritional_highlights` - Nutritional data included

### Admin API Tests (`test_admin_e2e.py`)

1. **CRUD Operations:**
   - `test_admin_create_product_success` - Create new product
   - `test_admin_update_product` - Update existing product
   - `test_admin_delete_product_soft_delete` - Soft delete (is_active=False)
   - `test_admin_get_product_by_id` - Retrieve specific product

2. **Listing & Filtering:**
   - `test_admin_list_products` - List all products
   - `test_admin_list_products_with_filters` - Filter by species
   - `test_admin_list_products_pagination` - Pagination support

3. **Validation:**
   - `test_admin_create_product_invalid_species` - Reject invalid species
   - `test_admin_create_product_missing_required_fields` - Reject incomplete data

4. **Error Cases:**
   - `test_admin_delete_nonexistent_product` - 404 for missing product
   - `test_admin_update_nonexistent_product` - 404 for missing product
   - `test_admin_endpoints_require_authentication` - Auth required

## Troubleshooting

### Test Failures

**"Admin user not available":**
- Create admin user: `docker exec ft_transcendence_auth_service python manage.py createsuperuser`
- Use credentials: `admin@example.com` / `AdminPass123!@#`

**"Connection refused" or "Service unavailable":**
- Verify services are running: `docker compose ps`
- Check API Gateway health: `docker exec ft_transcendence_api_gateway curl http://localhost:8001/health`
- Check recommendation service: `docker exec ft_transcendence_recommendation_service curl http://localhost:3005/health`

**"No products available for this species":**
- Load seed data: `docker exec ft_transcendence_recommendation_service python scripts/seed_products.py`
- Verify products exist: `docker exec ft_transcendence_recommendation_service curl http://localhost:3005/api/v1/admin/products | jq '.data.total'`

**"Pet not found" errors:**
- Test creates pets dynamically - ensure user-service is running
- Check user-service health: `docker compose ps user-service`

### Network Issues

**"Could not connect to api-gateway:8001":**
- Tests run inside Docker network (backend-network)
- Ensure test container is connected to same network as API Gateway
- Check network: `docker network inspect ft_transcendence_backend-network`

### Database State

**Orphaned test data (from failed tests):**
```bash
# Clean up test users
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "DELETE FROM auth_schema.users WHERE email LIKE '%test%';"

# Clean up test pets
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "DELETE FROM user_schema.pets WHERE name LIKE '%Test%';"

# Clean up test products
docker exec -i ft_transcendence_db psql -U smartbreeds_user -d smartbreeds -c "DELETE FROM recommendation_schema.products WHERE name LIKE '%Test%';"
```

## Test Execution Time

- **Recommendation tests:** ~10-15 seconds (12 tests)
- **Admin tests:** ~15-20 seconds (13 tests)
- **Total:** ~30 seconds for full integration test suite

## Manual Testing via Jupyter Notebook

For visual/interactive testing, use Jupyter notebooks (similar to AI service):

```bash
# Start Jupyter server
jupyter notebook scripts/jupyter/

# Create notebook: test_recommendation_service.ipynb
# Follow pattern from: scripts/jupyter/test_ai_service.ipynb
```

Example notebook cells:
```python
# Cell 1: Setup
import requests
import json

base_url = "http://localhost:8001"

# Cell 2: Login
login_response = requests.post(
    f"{base_url}/api/v1/auth/login",
    json={"email": "user@example.com", "password": "password"}
)
cookies = login_response.cookies

# Cell 3: Get Recommendations
rec_response = requests.get(
    f"{base_url}/api/v1/recommendations/food?pet_id=1&limit=5",
    cookies=cookies
)
print(json.dumps(rec_response.json(), indent=2))
```
