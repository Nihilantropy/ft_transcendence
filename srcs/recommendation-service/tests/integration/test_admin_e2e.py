"""
Integration tests for admin API endpoints through API Gateway.

These tests require:
1. All services running (make up)
2. Database migrations applied
3. Admin user credentials
4. API Gateway configured

Run separately: docker compose run --rm recommendation-service pytest tests/integration/test_admin_e2e.py -v
DO NOT run with unit tests (marked with @pytest.mark.integration)
"""
import pytest
import pytest_asyncio
import httpx
from typing import Dict, Any


# Test configuration
API_GATEWAY_URL = "http://api-gateway:8001"
TEST_ADMIN_EMAIL = "test_admin@example.com"
TEST_ADMIN_PASSWORD = "Password123!"


@pytest_asyncio.fixture(scope="module")
async def admin_auth() -> Dict[str, Any]:
    """
    Get admin authentication tokens.

    Note: Assumes admin user already exists in database.
    If not, create via:
    docker exec -it ft_transcendence_auth_service bash
    python manage.py createsuperuser

    Returns dict with:
        - user_id: int
        - cookies: dict
    """
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0) as client:
        # Try to login as admin
        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD
            }
        )

        if login_response.status_code != 200:
            pytest.skip(
                f"Admin user not available. Create admin user first:\n"
                f"docker exec ft_transcendence_auth_service python manage.py createsuperuser\n"
                f"Email: {TEST_ADMIN_EMAIL}, Password: {TEST_ADMIN_PASSWORD}"
            )

        login_data = login_response.json()
        assert login_data["success"] is True

        user_id = login_data["data"]["user"]["id"]
        cookies = dict(login_response.cookies)

        return {
            "user_id": user_id,
            "cookies": cookies
        }


@pytest_asyncio.fixture(scope="module")
async def seeded_products(admin_auth: Dict[str, Any]):
    """Create products via admin API for tests that need pre-existing data. Soft-deletes all on teardown."""
    created = []
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        seed_data = [
            {
                "name": "Seed Dog Food Adult",
                "brand": "SeedBrand",
                "description": "Seed product for adult dogs",
                "price": "65.00",
                "target_species": "dog",
                "min_age_months": 12,
                "protein_percentage": "28.0",
                "fat_percentage": "15.0",
                "calories_per_100g": 380,
                "for_joint_health": True,
                "is_active": True,
            },
            {
                "name": "Seed Cat Food Adult",
                "brand": "SeedBrand",
                "description": "Seed product for adult cats",
                "price": "50.00",
                "target_species": "cat",
                "min_age_months": 12,
                "protein_percentage": "32.0",
                "fat_percentage": "16.0",
                "calories_per_100g": 400,
                "is_active": True,
            },
            {
                "name": "Seed Dog Food Puppy",
                "brand": "SeedBrand",
                "description": "Seed product for puppies",
                "price": "55.00",
                "target_species": "dog",
                "min_age_months": 2,
                "max_age_months": 18,
                "protein_percentage": "32.0",
                "fat_percentage": "18.0",
                "calories_per_100g": 420,
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


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_create_product_success(admin_auth: Dict[str, Any]):
    """Test creating a new product through admin API."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        product_data = {
            "name": "Test Product Integration",
            "brand": "Test Brand",
            "description": "Integration test product",
            "price": "59.99",
            "target_species": "dog",
            "min_age_months": 12,
            "max_age_months": 96,
            "protein_percentage": "28.0",
            "fat_percentage": "15.0",
            "calories_per_100g": 380,
            "for_joint_health": True,
            "for_sensitive_stomach": False,
            "is_active": True
        }

        response = await client.post(
            "/api/v1/admin/products",
            json=product_data,
        )

        assert response.status_code == 201, f"Product creation failed: {response.text}"

        data = response.json()
        assert data["success"] is True
        assert "data" in data

        product = data["data"]
        assert product["name"] == product_data["name"]
        assert product["brand"] == product_data["brand"]
        assert product["target_species"] == "dog"
        assert product["for_joint_health"] is True
        assert "id" in product

        # Clean up - soft delete test product
        await client.delete(
            f"/api/v1/admin/products/{product['id']}",
        )


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_list_products(admin_auth: Dict[str, Any], seeded_products):
    """Test listing all products through admin API."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        response = await client.get(
            "/api/v1/admin/products",
        )

        assert response.status_code == 200, f"Failed to list products: {response.text}"

        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "products" in data["data"]
        assert "total" in data["data"]

        products = data["data"]["products"]
        assert isinstance(products, list)
        assert len(products) > 0, "Should have at least seed products"

        # Validate product structure
        first_product = products[0]
        assert "id" in first_product
        assert "name" in first_product
        assert "brand" in first_product
        assert "target_species" in first_product
        assert "is_active" in first_product


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_list_products_with_filters(admin_auth: Dict[str, Any]):
    """Test listing products with species filter."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        # Filter by dog species
        response = await client.get(
            "/api/v1/admin/products?species=dog",
        )

        assert response.status_code == 200

        data = response.json()
        products = data["data"]["products"]

        # All products should be for dogs
        for product in products:
            assert product["target_species"] == "dog"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_list_products_pagination(admin_auth: Dict[str, Any]):
    """Test product listing with limit parameter."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        # Get products with limit 5
        response = await client.get(
            "/api/v1/admin/products?limit=5",
        )

        assert response.status_code == 200

        data = response.json()
        products = data["data"]["products"]
        total = data["data"]["total"]

        # Should return max 5 products
        assert len(products) <= 5, f"Expected max 5 products, got {len(products)}"

        # Total should be accurate count
        assert total >= len(products), f"Total {total} should be >= returned count {len(products)}"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_get_product_by_id(admin_auth: Dict[str, Any], seeded_products):
    """Test retrieving a specific product by ID."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        # First, get list to find a valid product ID
        list_response = await client.get(
            "/api/v1/admin/products",
        )

        products = list_response.json()["data"]["products"]
        assert len(products) > 0, "Need at least one product for this test"

        product_id = products[0]["id"]

        # Now get specific product
        response = await client.get(
            f"/api/v1/admin/products/{product_id}",
        )

        assert response.status_code == 200, f"Failed to get product {product_id}: {response.text}"

        data = response.json()
        assert data["success"] is True

        product = data["data"]
        assert product["id"] == product_id


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_update_product(admin_auth: Dict[str, Any]):
    """Test updating an existing product."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        # Create a test product first
        create_response = await client.post(
            "/api/v1/admin/products",
            json={
                "name": "Update Test Product",
                "brand": "Test Brand",
                "target_species": "dog",
                "price": "50.00",
                "is_active": True
            },
        )

        assert create_response.status_code == 201
        product_id = create_response.json()["data"]["id"]

        # Update the product
        update_data = {
            "name": "Updated Product Name",
            "price": "75.00",
            "description": "Updated description",
            "for_joint_health": True
        }

        update_response = await client.put(
            f"/api/v1/admin/products/{product_id}",
            json=update_data,
        )

        assert update_response.status_code == 200, f"Update failed: {update_response.text}"

        data = update_response.json()
        assert data["success"] is True

        updated_product = data["data"]
        assert updated_product["name"] == "Updated Product Name"
        assert float(updated_product["price"]) == 75.00
        assert updated_product["description"] == "Updated description"
        assert updated_product["for_joint_health"] is True

        # Clean up - delete test product
        await client.delete(
            f"/api/v1/admin/products/{product_id}",
        )


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_delete_product_soft_delete(admin_auth: Dict[str, Any]):
    """Test soft-deleting a product (sets is_active=False)."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        # Create a test product
        create_response = await client.post(
            "/api/v1/admin/products",
            json={
                "name": "Delete Test Product",
                "brand": "Test Brand",
                "target_species": "cat",
                "price": "40.00",
                "is_active": True
            },
        )

        assert create_response.status_code == 201
        product_id = create_response.json()["data"]["id"]

        # Delete the product
        delete_response = await client.delete(
            f"/api/v1/admin/products/{product_id}",
        )

        # DELETE returns 204 No Content (standard REST convention)
        assert delete_response.status_code == 204, f"Delete failed: {delete_response.status_code}"

        # Verify product is soft-deleted (is_active=False)
        get_response = await client.get(
            f"/api/v1/admin/products/{product_id}",
        )

        assert get_response.status_code == 200
        product = get_response.json()["data"]
        assert product["is_active"] is False, "Product should be soft-deleted (is_active=False)"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_delete_nonexistent_product(admin_auth: Dict[str, Any]):
    """Test deleting a product that doesn't exist."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        response = await client.delete(
            "/api/v1/admin/products/99999",
        )

        assert response.status_code == 404, "Should return 404 for non-existent product"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_update_nonexistent_product(admin_auth: Dict[str, Any]):
    """Test updating a product that doesn't exist."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        response = await client.put(
            "/api/v1/admin/products/99999",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404, "Should return 404 for non-existent product"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_create_product_invalid_species(admin_auth: Dict[str, Any]):
    """Test creating product with invalid species (validation)."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        response = await client.post(
            "/api/v1/admin/products",
            json={
                "name": "Invalid Product",
                "brand": "Test Brand",
                "target_species": "bird",  # Invalid - only dog/cat allowed
                "price": "50.00"
            },
        )

        assert response.status_code == 422, "Should reject invalid species"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_create_product_missing_required_fields(admin_auth: Dict[str, Any]):
    """Test creating product with missing required fields."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        response = await client.post(
            "/api/v1/admin/products",
            json={
                "name": "Incomplete Product"
                # Missing required fields: brand, target_species
            },
        )

        assert response.status_code == 422, "Should reject product with missing required fields"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_endpoints_require_authentication():
    """Test that admin endpoints reject unauthenticated requests."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0) as client:
        # Try to list products without authentication
        response = await client.get("/api/v1/admin/products")

        assert response.status_code == 401, "Should reject unauthenticated requests"


@pytest.mark.integration
@pytest.mark.asyncio(scope="module")
async def test_admin_create_product_with_all_fields(admin_auth: Dict[str, Any]):
    """Test creating a product with all optional fields populated."""
    async with httpx.AsyncClient(base_url=API_GATEWAY_URL, timeout=10.0, cookies=admin_auth["cookies"]) as client:
        product_data = {
            "name": "Comprehensive Test Product",
            "brand": "Premium Brand",
            "description": "A product with all fields populated",
            "price": "99.99",
            "product_url": "https://example.com/product",
            "image_url": "https://example.com/image.jpg",
            "target_species": "dog",
            "min_age_months": 6,
            "max_age_months": 120,
            "min_weight_kg": "10.0",
            "max_weight_kg": "40.0",
            "protein_percentage": "32.0",
            "fat_percentage": "18.0",
            "fiber_percentage": "4.5",
            "calories_per_100g": 420,
            "grain_free": True,
            "organic": True,
            "hypoallergenic": True,
            "for_sensitive_stomach": True,
            "for_weight_management": False,
            "for_joint_health": True,
            "for_skin_allergies": True,
            "for_dental_health": False,
            "for_kidney_health": False,
            "is_active": True
        }

        response = await client.post(
            "/api/v1/admin/products",
            json=product_data,
        )

        assert response.status_code == 201, f"Failed to create comprehensive product: {response.text}"

        data = response.json()
        product = data["data"]

        # Verify all fields are set correctly
        assert product["name"] == product_data["name"]
        assert product["grain_free"] is True
        assert product["organic"] is True
        assert product["hypoallergenic"] is True
        assert product["for_joint_health"] is True
        assert product["for_skin_allergies"] is True
        assert float(product["fiber_percentage"]) == 4.5

        # Clean up
        await client.delete(
            f"/api/v1/admin/products/{product['id']}",
        )
