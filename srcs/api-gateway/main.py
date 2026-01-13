from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from routes import proxy

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",   # Alternative frontend port
        "https://smartbreeds.local",  # Production domain
    ],
    allow_credentials=True,  # Allow cookies
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["X-Request-ID"],  # Expose custom headers to frontend
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
