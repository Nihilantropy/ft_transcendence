from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import logging
from datetime import datetime

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
)
logger = logging.getLogger("api-gateway")

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests with structured data.
    Includes request details, user context, duration, and status code.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Record start time
        start_time = time.time()

        # Get request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Get request ID and user context if available
        request_id = getattr(request.state, "request_id", "no-request-id")
        user_id = getattr(request.state, "user_id", "anonymous")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request
        log_data = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }

        logger.info(str(log_data))

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response
