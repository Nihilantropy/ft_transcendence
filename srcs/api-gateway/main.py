from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
