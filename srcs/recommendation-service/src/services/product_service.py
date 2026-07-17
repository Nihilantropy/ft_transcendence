"""Product service for database operations."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.product import Product


class ProductService:
    """Service for product CRUD operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize product service.

        Args:
            db: SQLAlchemy async database session
        """
        self.db = db

    async def get_active_products(
        self, species: Optional[str] = None
    ) -> List[Product]:
        """
        Fetch all active products, optionally filtered by species.

        Args:
            species: Filter by target_species ('dog', 'cat'), or None for all

        Returns:
            List of active Product objects
        """
        query = select(Product).where(Product.is_active == True)

        if species:
            query = query.where(Product.target_species == species)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_product_by_id(self, product_id: int) -> Optional[Product]:
        """
        Fetch product by ID.

        Args:
            product_id: Product ID to fetch

        Returns:
            Product object or None if not found
        """
        query = select(Product).where(Product.id == product_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_product(self, product: Product) -> Product:
        """
        Create a new product.

        Args:
            product: Product object to create

        Returns:
            Created product with ID
        """
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def update_product(self, product: Product) -> Product:
        """
        Update an existing product.

        Args:
            product: Product object with updated fields

        Returns:
            Updated product
        """
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def delete_product(self, product: Product) -> None:
        """
        Soft-delete a product (set is_active=False).

        Args:
            product: Product to delete
        """
        product.is_active = False
        await self.db.commit()
