from fastapi import FastAPI
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# Add JWT authentication middleware
app.add_middleware(
    JWTAuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM
)

# Include proxy routes
app.include_router(proxy.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }
