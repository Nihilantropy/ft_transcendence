"""Seed database with sample product data loaded from products.yaml."""
import argparse
import asyncio
import os
import sys
from decimal import Decimal
from pathlib import Path

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# TODO this must become a real seed with real product data.
# Tests are made by creating seed_products fixtures on each test individually (create and soft-delete via admin API) to ensure test isolation and avoid cross-test contamination. This script is only for manual testing and development purposes, not for automated test setup.

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.models.product import Product

PRODUCTS_YAML = Path(__file__).parent / "products.yaml"

# Fields that must be stored as Decimal
DECIMAL_FIELDS = {
    "price",
    "min_weight_kg",
    "max_weight_kg",
    "protein_percentage",
    "fat_percentage",
    "fiber_percentage",
}


def load_products_from_yaml(path: Path) -> list[Product]:
    with open(path) as f:
        data = yaml.safe_load(f)

    products = []
    for entry in data["products"]:
        kwargs = {}
        for key, value in entry.items():
            if key in DECIMAL_FIELDS and value is not None:
                value = Decimal(str(value))
            kwargs[key] = value
        products.append(Product(**kwargs))

    return products


async def seed_products(force: bool = False):
    """Add sample products to database. Skips if products already exist unless force=True."""
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://smartbreeds_user:smartbreeds_password@db:5432/smartbreeds",
    )
    engine = create_async_engine(database_url, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(func.count()).select_from(Product))).scalar()
        if existing > 0:
            if not force:
                print(f"⚠️  Skipping seed: {existing} products already exist. Run with --force to re-seed.")
                await engine.dispose()
                return
            await session.execute(delete(Product))
            await session.commit()
            print(f"🗑️  Cleared {existing} existing products.")

        products = load_products_from_yaml(PRODUCTS_YAML)
        for product in products:
            session.add(product)

        await session.commit()
        print(f"✅ Successfully seeded {len(products)} products from {PRODUCTS_YAML.name}!")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Clear existing products before seeding")
    args = parser.parse_args()
    asyncio.run(seed_products(force=args.force))
