from fastapi import FastAPI

app = FastAPI(
    title="Recommendation Service",
    description="ML-powered pet food recommendations",
    version="1.0.0"
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "recommendation-service"}
