from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime
from config import settings
from middleware.auth_middleware import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.logging_middleware import LoggingMiddleware
from routes import proxy
from utils.responses import error_response

app = FastAPI(
    title="SmartBreeds API Gateway",
    version="1.0.0",
    description="API Gateway for SmartBreeds microservices"
)

# Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized format"""
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            code="HTTP_ERROR",
            message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            details={}
        )
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with standardized format"""
    return JSONResponse(
        status_code=422,
        content=error_response(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"errors": exc.errors()}
        )
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors with standardized format"""
    return JSONResponse(
        status_code=404,
        content=error_response(
            code="NOT_FOUND",
            message=f"Endpoint not found: {request.url.path}",
            details={}
        )
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors with standardized format"""
    return JSONResponse(
        status_code=500,
        content=error_response(
            code="INTERNAL_ERROR",
            message="An internal error occurred",
            details={}
        )
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
