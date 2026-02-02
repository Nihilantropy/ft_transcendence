"""Admin API routes for product management."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.schemas.products import ProductCreate, ProductUpdate, ProductResponse
from src.services.product_service import ProductService
from src.models.product import Product
from src.utils.database import get_db
from src.utils.responses import success_response, error_response

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/products", status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product.

    Requires admin role (enforced by API Gateway).
    """
    # Convert Pydantic model to SQLAlchemy model
    product = Product(**product_data.dict())

    product_service = ProductService(db)
    created_product = await product_service.create_product(product)

    return success_response(
        ProductResponse.from_orm(created_product).dict()
    )


@router.get("/products")
async def list_products(
    species: str = Query(None, pattern="^(dog|cat)$"),
    include_inactive: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List all products with optional filtering.

    Requires admin role (enforced by API Gateway).
    """
    product_service = ProductService(db)
    products = await product_service.get_active_products(species=species)

    # Filter inactive if not requested
    if not include_inactive:
        products = [p for p in products if p.is_active]

    # Apply limit
    products = products[:limit]

    return success_response({
        "products": [ProductResponse.from_orm(p).dict() for p in products],
        "total": len(products)
    })


@router.get("/products/{product_id}")
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single product by ID.

    Requires admin role (enforced by API Gateway).
    """
    product_service = ProductService(db)
    product = await product_service.get_product_by_id(product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail=error_response(
                "PRODUCT_NOT_FOUND",
                f"Product with ID {product_id} not found",
                {"product_id": product_id}
            )
        )

    return success_response(ProductResponse.from_orm(product).dict())


@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing product.

    Requires admin role (enforced by API Gateway).
    """
    product_service = ProductService(db)
    product = await product_service.get_product_by_id(product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail=error_response(
                "PRODUCT_NOT_FOUND",
                f"Product with ID {product_id} not found",
                {"product_id": product_id}
            )
        )

    # Update fields (only non-None values)
    update_data = product_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    updated_product = await product_service.update_product(product)

    return success_response(ProductResponse.from_orm(updated_product).dict())


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) a product.

    Soft-delete: sets is_active=False.
    Requires admin role (enforced by API Gateway).
    """
    product_service = ProductService(db)
    product = await product_service.get_product_by_id(product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail=error_response(
                "PRODUCT_NOT_FOUND",
                f"Product with ID {product_id} not found",
                {"product_id": product_id}
            )
        )

    await product_service.delete_product(product)
    return None  # 204 No Content
