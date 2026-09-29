from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from src.routes import recommendations, admin

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
