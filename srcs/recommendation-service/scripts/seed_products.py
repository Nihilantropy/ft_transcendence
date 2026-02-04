"""Seed database with sample product data."""
import asyncio
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# TODO this must become a real seed with real product data.
# Tests are made by creating seed_products fixtures on each test individually (create and soft-delete via admin API) to ensure test isolation and avoid cross-test contamination. This script is only for manual testing and development purposes, not for automated test setup.

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from src.models.product import Product

async def seed_products():
    """Add sample products to database."""
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://smartbreeds_user:smartbreeds_password@db:5432/smartbreeds")
    engine = create_async_engine(database_url, echo=True)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # Dog food products
        products = [
            # Senior/Joint Health
            Product(
                name="Royal Canin Golden Retriever Adult",
                brand="Royal Canin",
                description="Breed-specific formula for Golden Retrievers",
                price=Decimal("89.99"),
                target_species="dog",
                min_age_months=84,
                max_age_months=None,
                min_weight_kg=Decimal("25.0"),
                max_weight_kg=Decimal("40.0"),
                suitable_breeds=["golden_retriever"],
                protein_percentage=Decimal("28.0"),
                fat_percentage=Decimal("15.0"),
                fiber_percentage=Decimal("3.5"),
                calories_per_100g=380,
                grain_free=False,
                for_joint_health=True,
                for_sensitive_stomach=True,
            ),
            Product(
                name="Hill's Science Diet Senior 7+ Large Breed",
                brand="Hill's",
                description="Senior formula for large breed dogs",
                price=Decimal("79.99"),
                target_species="dog",
                min_age_months=84,
                max_age_months=None,
                min_weight_kg=Decimal("23.0"),
                max_weight_kg=None,
                protein_percentage=Decimal("26.0"),
                fat_percentage=Decimal("12.0"),
                fiber_percentage=Decimal("4.0"),
                calories_per_100g=350,
                for_joint_health=True,
                for_weight_management=True,
            ),

            # Puppy/Adult
            Product(
                name="Purina Pro Plan Puppy Large Breed",
                brand="Purina",
                description="Growth formula for large breed puppies",
                price=Decimal("69.99"),
                target_species="dog",
                min_age_months=2,
                max_age_months=18,
                protein_percentage=Decimal("32.0"),
                fat_percentage=Decimal("18.0"),
                calories_per_100g=420,
                grain_free=False,
            ),
            Product(
                name="Blue Buffalo Life Protection Adult",
                brand="Blue Buffalo",
                description="Natural adult dog food",
                price=Decimal("74.99"),
                target_species="dog",
                min_age_months=12,
                max_age_months=84,
                protein_percentage=Decimal("30.0"),
                fat_percentage=Decimal("16.0"),
                fiber_percentage=Decimal("5.0"),
                calories_per_100g=390,
                grain_free=False,
                organic=False,
            ),

            # Sensitive Stomach
            Product(
                name="Purina Pro Plan Sensitive Skin & Stomach",
                brand="Purina",
                description="Easy-to-digest formula for sensitive dogs",
                price=Decimal("72.99"),
                target_species="dog",
                protein_percentage=Decimal("26.0"),
                fat_percentage=Decimal("16.0"),
                calories_per_100g=370,
                limited_ingredient=True,
                for_sensitive_stomach=True,
                for_skin_allergies=True,
            ),
            Product(
                name="Natural Balance L.I.D. Lamb & Brown Rice",
                brand="Natural Balance",
                description="Limited ingredient diet for sensitive stomachs",
                price=Decimal("67.99"),
                target_species="dog",
                protein_percentage=Decimal("24.0"),
                fat_percentage=Decimal("14.0"),
                calories_per_100g=360,
                grain_free=False,
                limited_ingredient=True,
                for_sensitive_stomach=True,
            ),

            # Weight Management
            Product(
                name="Hill's Science Diet Perfect Weight",
                brand="Hill's",
                description="Clinically proven weight loss formula",
                price=Decimal("76.99"),
                target_species="dog",
                protein_percentage=Decimal("29.0"),
                fat_percentage=Decimal("10.5"),
                fiber_percentage=Decimal("12.0"),
                calories_per_100g=315,
                for_weight_management=True,
            ),

            # Grain-Free/Hypoallergenic
            Product(
                name="Taste of the Wild High Prairie",
                brand="Taste of the Wild",
                description="Grain-free with roasted bison and venison",
                price=Decimal("69.99"),
                target_species="dog",
                protein_percentage=Decimal("32.0"),
                fat_percentage=Decimal("18.0"),
                calories_per_100g=395,
                grain_free=True,
                hypoallergenic=True,
            ),

            # Cat food products
            Product(
                name="Royal Canin Feline Health Nutrition Adult",
                brand="Royal Canin",
                description="Complete and balanced nutrition for adult cats",
                price=Decimal("54.99"),
                target_species="cat",
                min_age_months=12,
                max_age_months=84,
                protein_percentage=Decimal("32.0"),
                fat_percentage=Decimal("16.0"),
                calories_per_100g=410,
            ),
            Product(
                name="Hill's Science Diet Senior 11+ Indoor",
                brand="Hill's",
                description="Senior formula for indoor cats",
                price=Decimal("49.99"),
                target_species="cat",
                min_age_months=132,
                max_age_months=None,
                protein_percentage=Decimal("35.0"),
                fat_percentage=Decimal("12.0"),
                fiber_percentage=Decimal("6.0"),
                calories_per_100g=365,
                for_kidney_health=True,
                for_weight_management=True,
            ),
            Product(
                name="Purina Pro Plan Sensitive Skin & Stomach Cat",
                brand="Purina",
                description="Easy-to-digest formula for cats with sensitivities",
                price=Decimal("52.99"),
                target_species="cat",
                protein_percentage=Decimal("34.0"),
                fat_percentage=Decimal("18.0"),
                calories_per_100g=400,
                limited_ingredient=True,
                for_sensitive_stomach=True,
                for_skin_allergies=True,
            ),
            Product(
                name="Blue Buffalo Wilderness High Protein Cat",
                brand="Blue Buffalo",
                description="Grain-free, high-protein cat food",
                price=Decimal("58.99"),
                target_species="cat",
                protein_percentage=Decimal("40.0"),
                fat_percentage=Decimal("18.0"),
                calories_per_100g=425,
                grain_free=True,
            ),
            Product(
                name="Royal Canin Urinary SO Cat",
                brand="Royal Canin",
                description="Veterinary diet for urinary health",
                price=Decimal("64.99"),
                target_species="cat",
                protein_percentage=Decimal("33.0"),
                fat_percentage=Decimal("14.0"),
                calories_per_100g=380,
                for_kidney_health=True,
            ),
        ]

        # Add all products
        for product in products:
            session.add(product)

        await session.commit()
        print(f"✅ Successfully seeded {len(products)} products!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_products())
