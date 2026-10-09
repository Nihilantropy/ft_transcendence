import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from src.routes import recommendations, admin
from src.utils.database import engine

# Catalog photos referenced by products.image_url (see scripts/products.yaml)
PRODUCT_IMAGES_DIR = Path(__file__).resolve().parent.parent / "static" / "products"
PRODUCT_IMAGES_PATH = "/api/v1/recommendations/images"
# A day in the browser's cache, no revalidation request in between
PRODUCT_IMAGES_CACHE_CONTROL = "private, max-age=86400"


class CachedStaticFiles(StaticFiles):
    """StaticFiles that lets the browser keep what it served successfully."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = PRODUCT_IMAGES_CACHE_CONTROL
        return response


app = FastAPI(
    title="Recommendation Service",
    description="ML-powered pet food recommendations",
    version="1.0.0"
)

# Include routers
app.include_router(recommendations.router)
app.include_router(admin.router)

# Served under the recommendations prefix so the gateway routes them here like any other call
app.mount(
    PRODUCT_IMAGES_PATH, CachedStaticFiles(directory=PRODUCT_IMAGES_DIR), name="product-images"
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "recommendation-service"}


@app.get("/health/ready")
async def readiness():
    """Deep check for the status page: SELECT 1 on Postgres. 503 when it cannot answer.

    /health stays shallow for the Docker healthcheck, so a DB outage doesn't block `up --wait`.
    """
    start = time.monotonic()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db = {"ok": True, "latency_ms": round((time.monotonic() - start) * 1000, 2)}
    except Exception as exc:  # any driver/network error means "not ready"
        db = {"ok": False, "error": exc.__class__.__name__}
    return JSONResponse(
        {"status": "ready" if db["ok"] else "unavailable", "checks": {"db": db}},
        status_code=200 if db["ok"] else 503,
    )
