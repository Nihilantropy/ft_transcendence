"""Environment validation script - run before development."""
import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def validate_database():
    """Test database connection and schema."""
    try:
        engine = create_async_engine(
            os.getenv("DATABASE_URL"),
            echo=False
        )

        async with engine.connect() as conn:
            # Test connection
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print("✓ Database connection working")

            # Check schema exists
            result = await conn.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'recommendation_schema'")
            )
            assert result.scalar() == 'recommendation_schema'
            print("✓ recommendation_schema exists")

            # Check tables exist
            result = await conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'recommendation_schema'")
            )
            tables = [row[0] for row in result.fetchall()]
            assert 'products' in tables
            assert 'recommendations' in tables
            assert 'user_feedback' in tables
            print(f"✓ All tables exist: {', '.join(tables)}")

        await engine.dispose()
        return True
    except Exception as e:
        print(f"✗ Database validation failed: {e}")
        return False

async def main():
    """Run all validations."""
    print("Validating recommendation service environment...\n")

    db_ok = await validate_database()

    if db_ok:
        print("\n✅ Environment ready for development!")
        sys.exit(0)
    else:
        print("\n❌ Environment validation failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
