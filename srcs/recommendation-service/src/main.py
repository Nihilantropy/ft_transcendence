from fastapi import FastAPI
from src.routes import recommendations

app = FastAPI(
    title="Recommendation Service",
    description="ML-powered pet food recommendations",
    version="1.0.0"
)

# Include routers
app.include_router(recommendations.router)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "recommendation-service"}
