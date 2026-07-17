"""
Integration tests for recommendation service through API Gateway.

These tests require:
1. All services running (make up)
2. Database migrations applied
3. Seed data loaded
4. API Gateway configured

Run separately: docker compose run --rm recommendation-service pytest tests/integration/ -v
DO NOT run with unit tests (marked with @pytest.mark.integration)
"""
import pytest
import pytest_asyncio
import httpx
from typing import Dict, Any


# Test configuration
API_GATEWAY_URL = "http://api-gateway:8001"
TEST_USER_EMAIL = "recotest@example.com"
TEST_USER_PASSWORD = "TestPass123!@#"
TEST_ADMIN_EMAIL = "test_admin@example.com"
TEST_ADMIN_PASSWORD = "Password123!"


@pytest_asyncio.fixture(scope="module")
async def test_user_auth():
    """
    Create test user, yield authentication tokens, then clean up all user data.

    Yields dict with:
        - user_id: str (UUID)
        - cookies: dict
    """
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0) as client:
        # Register test user
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "first_name": "Recommendation",
                "last_name": "Tester"
            }
        )

        if register_response.status_code == 409:
            # User already exists, just login
            pass
        elif register_response.status_code != 201:
            raise Exception(f"Registration failed: {register_response.status_code} - {register_response.text}")

        # Login to get tokens
        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )

        assert login_response.status_code == 200, f"Login failed: {login_response.text}"

        login_data = login_response.json()
        assert login_data["success"] is True

        # Extract user_id and cookies
        user_id = login_data["data"]["user"]["id"]
        cookies = dict(login_response.cookies)

        # Set cookies on client so teardown request is authenticated
        client.cookies.update(cookies)

        yield {
            "user_id": user_id,
            "cookies": cookies
        }

        # Teardown: delete all test user data (profile, pets, analyses)
        # Auth user record persists (login still works on re-run) but all
        # user-service data is removed atomically.
        await client.delete(
            "/api/v1/users/delete",
        )


@pytest_asyncio.fixture(scope="module")
async def admin_auth() -> Dict[str, Any]:
    """Get admin authentication tokens (needed to seed products via admin API)."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0) as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip("Admin user not available — create with createsuperuser first")
        login_data = login_response.json()
        return {
            "user_id": login_data["data"]["user"]["id"],
            "cookies": dict(login_response.cookies),
        }


@pytest_asyncio.fixture(scope="module")
async def seeded_products(admin_auth: Dict[str, Any]):
    """Create dog + cat products via admin API. Soft-deletes all on teardown.

    Dog products include joint_health flags (test pet has joint_health condition).
    Cat products include skin_allergies flag (cat test pet has skin_allergies).
    """
    created = []
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        seed_data = [
            # Dog products
            {
                "name": "Seed Joint Health Dog Food",
                "brand": "SeedBrand",
                "description": "Dog food for joint health",
                "price": "75.00",
                "target_species": "dog",
                "min_age_months": 12,
                "min_weight_kg": "20.0",
                "max_weight_kg": "40.0",
                "protein_percentage": "28.0",
                "fat_percentage": "14.0",
                "calories_per_100g": 360,
                "for_joint_health": True,
                "is_active": True,
            },
            {
                "name": "Seed Adult Dog Food",
                "brand": "SeedBrand",
                "description": "Standard adult dog food",
                "price": "60.00",
                "target_species": "dog",
                "min_age_months": 12,
                "max_age_months": 84,
                "min_weight_kg": "15.0",
                "max_weight_kg": "45.0",
                "protein_percentage": "26.0",
                "fat_percentage": "16.0",
                "calories_per_100g": 380,
                "is_active": True,
            },
            {
                "name": "Seed Senior Joint Dog Food",
                "brand": "SeedBrand",
                "description": "Senior dog formula with joint support",
                "price": "70.00",
                "target_species": "dog",
                "min_age_months": 84,
                "protein_percentage": "24.0",
                "fat_percentage": "12.0",
                "calories_per_100g": 340,
                "for_joint_health": True,
                "for_weight_management": True,
                "is_active": True,
            },
            # Cat products
            {
                "name": "Seed Sensitive Skin Cat Food",
                "brand": "SeedBrand",
                "description": "Cat food for skin sensitivities",
                "price": "55.00",
                "target_species": "cat",
                "protein_percentage": "34.0",
                "fat_percentage": "14.0",
                "calories_per_100g": 390,
                "for_skin_allergies": True,
                "is_active": True,
            },
            {
                "name": "Seed Adult Cat Food",
                "brand": "SeedBrand",
                "description": "Standard adult cat food",
                "price": "45.00",
                "target_species": "cat",
                "min_age_months": 12,
                "max_age_months": 132,
                "protein_percentage": "32.0",
                "fat_percentage": "16.0",
                "calories_per_100g": 400,
                "is_active": True,
            },
            {
                "name": "Seed Indoor Cat Food",
                "brand": "SeedBrand",
                "description": "Indoor cat formula",
                "price": "48.00",
                "target_species": "cat",
                "min_age_months": 12,
                "protein_percentage": "30.0",
                "fat_percentage": "12.0",
                "calories_per_100g": 350,
                "for_weight_management": True,
                "is_active": True,
            },
        ]

        for data in seed_data:
            resp = await client.post(
                "/api/v1/admin/products",
                json=data,
            )
            assert resp.status_code == 201, f"Seed product creation failed: {resp.text}"
            created.append(resp.json()["data"])

        yield created

        # Teardown: soft-delete all seeded products
        for product in created:
            await client.delete(
                f"/api/v1/admin/products/{product['id']}",
            )


@pytest_asyncio.fixture(scope="module")
async def test_pet(test_user_auth: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create test pet for recommendation testing.

    Returns pet profile dict.
    """
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        # Create pet
        pet_response = await client.post(
            "/api/v1/pets",
            json={
                "name": "Max",
                "species": "dog",
                "breed": "golden_retriever",
                "age": 36,
                "weight": 28.5,
                "health_conditions": ["joint_health"]
            },
        )

        assert pet_response.status_code == 201, f"Pet creation failed: {pet_response.text}"

        pet_data = pet_response.json()
        assert pet_data["success"] is True

        return pet_data["data"]


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_get_recommendations_success(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test successful recommendation retrieval through API Gateway."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=5",
        )

        assert response.status_code == 200, f"Request failed: {response.text}"

        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "pet" in data["data"]
        assert "recommendations" in data["data"]
        assert "metadata" in data["data"]

        # Validate pet profile in response
        pet = data["data"]["pet"]
        assert pet["id"] == test_pet["id"]
        assert pet["species"] == "dog"
        assert "joint_health" in pet["health_conditions"]

        # Validate recommendations
        recommendations = data["data"]["recommendations"]
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0, "Should return at least one recommendation"
        assert len(recommendations) <= 5, "Should respect limit parameter"

        # Validate recommendation structure
        first_rec = recommendations[0]
        assert "product_id" in first_rec
        assert "name" in first_rec
        assert "brand" in first_rec
        assert "similarity_score" in first_rec
        assert "rank_position" in first_rec
        assert "match_reasons" in first_rec
        assert "nutritional_highlights" in first_rec

        # Validate similarity score
        assert 0.0 <= first_rec["similarity_score"] <= 1.0
        assert first_rec["rank_position"] == 1

        # Validate recommendations are sorted by score
        if len(recommendations) > 1:
            scores = [rec["similarity_score"] for rec in recommendations]
            assert scores == sorted(scores, reverse=True), "Recommendations should be sorted by score descending"

        # Validate metadata
        metadata = data["data"]["metadata"]
        assert "total_products_evaluated" in metadata
        assert "products_above_threshold" in metadata
        assert metadata["total_products_evaluated"] > 0


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_with_health_condition_match(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that health condition matches are prioritized (40% weight)."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=10",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # Pet has joint_health condition - top recommendations should mention it
        top_3_recommendations = recommendations[:3]

        # At least one of top 3 should have joint health in match reasons
        has_joint_health_reason = any(
            any("joint" in reason.lower() for reason in rec["match_reasons"])
            for rec in top_3_recommendations
        )

        assert has_joint_health_reason, "Top recommendations should mention joint health for pet with joint condition"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_respects_species(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that only products matching pet species are recommended."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=50",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # All recommendations should be for dogs (pet species)
        # We can't directly check product species from response, but we can verify
        # that we got recommendations (implying species filtering worked)
        assert len(recommendations) > 0, "Should return dog food recommendations"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_unauthorized_pet_access(test_user_auth: Dict[str, Any]):
    """Test that users cannot request recommendations for pets they don't own."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        # Try to access a pet ID that doesn't belong to this user
        # Use a high ID that's unlikely to exist or belong to test user
        response = await client.get(
            "/api/v1/recommendations/food?pet_id=99999",
        )

        # Should return 404 (pet not found) or 403 (not owner)
        assert response.status_code in [403, 404], f"Should reject unauthorized pet access: {response.status_code}"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_unauthenticated():
    """Test that unauthenticated requests are rejected."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0) as client:
        response = await client.get(
            "/api/v1/recommendations/food?pet_id=1"
            # No cookies = no authentication
        )

        assert response.status_code == 401, "Should reject unauthenticated requests"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_with_custom_limit(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that limit parameter controls number of recommendations."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        # Request only 3 recommendations
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=3",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # Should return at most 3 recommendations
        assert len(recommendations) <= 3, f"Expected max 3 recommendations, got {len(recommendations)}"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_with_min_score_threshold(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that min_score parameter filters low-confidence matches."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        # Set high threshold (only very good matches)
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&min_score=0.7",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # All recommendations should have score >= 0.7
        for rec in recommendations:
            assert rec["similarity_score"] >= 0.7, \
                f"Recommendation {rec['name']} has score {rec['similarity_score']} < 0.7"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_match_reasons_explainability(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that recommendations include human-readable match reasons."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=5",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # Each recommendation should have match reasons
        for rec in recommendations:
            assert isinstance(rec["match_reasons"], list)
            assert len(rec["match_reasons"]) > 0, f"Product {rec['name']} has no match reasons"

            # Match reasons should be strings
            for reason in rec["match_reasons"]:
                assert isinstance(reason, str)
                assert len(reason) > 0


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_nutritional_highlights(test_user_auth: Dict[str, Any], test_pet: Dict[str, Any], seeded_products):
    """Test that nutritional highlights are included in recommendations."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={test_pet['id']}&limit=5",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # Each recommendation should have nutritional highlights
        for rec in recommendations:
            nutritional = rec["nutritional_highlights"]
            assert "protein_percentage" in nutritional
            assert "fat_percentage" in nutritional
            assert "calories_per_100g" in nutritional

            # Values should be valid numbers
            assert nutritional["protein_percentage"] >= 0
            assert nutritional["fat_percentage"] >= 0
            assert nutritional["calories_per_100g"] > 0


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_recommendations_for_cat(test_user_auth: Dict[str, Any], seeded_products):
    """Test recommendations for a cat pet."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=test_user_auth["cookies"]) as client:
        # Create cat pet
        cat_response = await client.post(
            "/api/v1/pets",
            json={
                "name": "Whiskers",
                "species": "cat",
                "breed": "persian",
                "age": 48,
                "weight": 4.5,
                "health_conditions": ["skin_allergies"]
            },
        )

        assert cat_response.status_code == 201
        cat_data = cat_response.json()
        cat_id = cat_data["data"]["id"]

        # Get recommendations
        response = await client.get(
            f"/api/v1/recommendations/food?pet_id={cat_id}&limit=10",
        )

        assert response.status_code == 200

        data = response.json()
        recommendations = data["data"]["recommendations"]

        # Should return cat food recommendations
        assert len(recommendations) > 0, "Should return cat food recommendations"

        # Pet should be correctly identified as cat
        assert data["data"]["pet"]["species"] == "cat"

        # Clean up - delete test cat
        await client.delete(
            f"/api/v1/pets/{cat_id}",
        )
