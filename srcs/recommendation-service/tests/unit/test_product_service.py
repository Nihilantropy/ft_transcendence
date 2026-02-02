import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from src.services.product_service import ProductService
from src.models.product import Product

@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session

@pytest.fixture
def sample_product():
    """Sample product for testing."""
    return Product(
        id=1,
        name="Senior Joint Care",
        brand="Royal Canin",
        target_species="dog",
        min_age_months=84,
        protein_percentage=Decimal("28.0"),
        for_joint_health=True
    )

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_active_products(mock_db_session, sample_product):
    """Test fetching all active products."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sample_product]
    mock_db_session.execute.return_value = mock_result

    service = ProductService(mock_db_session)
    products = await service.get_active_products()

    assert len(products) == 1
    assert products[0].name == "Senior Joint Care"
    assert products[0].is_active is True

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_product_by_id_found(mock_db_session, sample_product):
    """Test fetching product by ID when found."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_product
    mock_db_session.execute.return_value = mock_result

    service = ProductService(mock_db_session)
    product = await service.get_product_by_id(1)

    assert product is not None
    assert product.id == 1
    assert product.name == "Senior Joint Care"

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_product_by_id_not_found(mock_db_session):
    """Test fetching product by ID when not found."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    service = ProductService(mock_db_session)
    product = await service.get_product_by_id(999)

    assert product is None

@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_product(mock_db_session, sample_product):
    """Test creating a new product."""
    mock_db_session.refresh.side_effect = lambda p: setattr(p, 'id', 1)

    service = ProductService(mock_db_session)
    product = await service.create_product(sample_product)

    assert product is not None
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_called_once()

@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_product(mock_db_session, sample_product):
    """Test updating an existing product."""
    service = ProductService(mock_db_session)

    updated_product = await service.update_product(sample_product)

    assert updated_product is not None
    mock_db_session.commit.assert_called_once()
    mock_db_session.refresh.assert_called_once()

@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_product(mock_db_session, sample_product):
    """Test soft-deleting a product (set is_active=False)."""
    service = ProductService(mock_db_session)

    await service.delete_product(sample_product)

    assert sample_product.is_active is False
    mock_db_session.commit.assert_called_once()
