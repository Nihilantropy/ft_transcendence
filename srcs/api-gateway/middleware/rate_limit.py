from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import redis
from config import settings
from datetime import datetime

# Redis client for rate limiting
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce rate limiting using Redis.
    Limits requests per user (authenticated) or IP (unauthenticated).
    """

    def __init__(
        self,
        app: ASGIApp,
        rate_limit_per_minute: int = 60
    ):
        super().__init__(app)
        self.rate_limit_per_minute = rate_limit_per_minute
        self.window_seconds = 60

    async def dispatch(self, request: Request, call_next):
        # Determine rate limit key (user_id or IP)
        user_id = getattr(request.state, "user_id", None)

        if user_id:
            # Authenticated: rate limit by user_id
            rate_key = f"rate_limit:user:{user_id}"
        else:
            # Unauthenticated: rate limit by IP
            client_ip = request.client.host if request.client else "unknown"
            rate_key = f"rate_limit:ip:{client_ip}"

        # Get current request count
        try:
            current_count = redis_client.get(rate_key)

            if current_count is None:
                # First request in window
                redis_client.setex(rate_key, self.window_seconds, 1)
            else:
                current_count = int(current_count)

                if current_count >= self.rate_limit_per_minute:
                    # Rate limit exceeded
                    return self._rate_limit_response(rate_key)

                # Increment counter
                redis_client.incr(rate_key)

        except redis.RedisError as e:
            # If Redis fails, allow request but log error
            print(f"Redis error in rate limiting: {e}")

        # Continue to route handler
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.rate_limit_per_minute)

        try:
            remaining = self.rate_limit_per_minute - int(redis_client.get(rate_key) or 0)
            response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        except redis.RedisError:
            pass

        return response

    def _rate_limit_response(self, rate_key: str) -> JSONResponse:
        """Return standardized 429 rate limit response"""
        try:
            ttl = redis_client.ttl(rate_key)
        except redis.RedisError:
            ttl = 60

        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Try again in {ttl} seconds.",
                    "details": {
                        "retry_after": ttl,
                        "limit": self.rate_limit_per_minute
                    }
                },
                "timestamp": datetime.utcnow().isoformat()
            },
            headers={
                "Retry-After": str(ttl),
                "X-RateLimit-Limit": str(self.rate_limit_per_minute),
                "X-RateLimit-Remaining": "0"
            }
        )
