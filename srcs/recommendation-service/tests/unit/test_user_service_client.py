import pytest
from unittest.mock import Mock, patch, AsyncMock
from src.services.user_service_client import UserServiceClient

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_pet_profile_success():
    """Test successful pet profile retrieval."""
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "data": {
            "id": 1,
            "name": "Buddy",
            "species": "dog",
            "breed": "golden_retriever",
            "age_months": 36,
            "weight_kg": 30.0,
            "health_conditions": ["joint_health"]
        }
    }

    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        client = UserServiceClient()
        pet_data = await client.get_pet_profile(pet_id=1, user_id=123)

        assert pet_data is not None
        assert pet_data["id"] == 1
        assert pet_data["species"] == "dog"
        assert pet_data["breed"] == "golden_retriever"

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_pet_profile_not_found():
    """Test pet profile not found (404)."""
    mock_response = Mock()
    mock_response.status_code = 404
    mock_response.json.return_value = {
        "success": False,
        "error": {"code": "NOT_FOUND", "message": "Pet not found"}
    }

    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        client = UserServiceClient()
        pet_data = await client.get_pet_profile(pet_id=999, user_id=123)

        assert pet_data is None

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_pet_profile_adds_headers():
    """Test that X-User-ID header is added."""
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "data": {"id": 1, "name": "Buddy"}
    }

    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        client = UserServiceClient()
        await client.get_pet_profile(pet_id=1, user_id=456)

        # Verify headers were passed
        call_kwargs = mock_get.call_args.kwargs
        assert "headers" in call_kwargs
        assert call_kwargs["headers"]["X-User-ID"] == "456"

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_pet_profile_timeout():
    """Test handling of timeout errors."""
    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = TimeoutError("Request timeout")

        client = UserServiceClient()
        pet_data = await client.get_pet_profile(pet_id=1, user_id=123)

        assert pet_data is None

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_pet_profile_connection_error():
    """Test handling of connection errors."""
    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("Connection failed")

        client = UserServiceClient()
        pet_data = await client.get_pet_profile(pet_id=1, user_id=123)

        assert pet_data is None
