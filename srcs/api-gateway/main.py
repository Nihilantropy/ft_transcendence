from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.logging_middleware import LoggingMiddleware
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
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],  # Expose custom headers to frontend
)

# Request Logging
app.add_middleware(LoggingMiddleware)

# Rate Limiting (before auth to limit unauthenticated requests)
app.add_middleware(
    RateLimitMiddleware,
    rate_limit_per_minute=settings.RATE_LIMIT_PER_MINUTE
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
