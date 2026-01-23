from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from auth.jwt_utils import decode_jwt, JWTValidationError, extract_user_context
from datetime import datetime
import uuid

class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate JWT tokens from HTTP-only cookies.
    Extracts user context and adds headers for backend services.
    Uses RS256 asymmetric verification (public key only).
    """

    def __init__(self, app: ASGIApp, public_key: str, algorithm: str = "RS256"):
        super().__init__(app)
        self.public_key = public_key
        self.algorithm = algorithm

        # Endpoints that bypass authentication
        self.public_endpoints = {
            "/health",
            "/docs",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh"
        }

    async def dispatch(self, request: Request, call_next):
        # Skip authentication for public endpoints
        if request.url.path in self.public_endpoints:
            return await call_next(request)

        # Extract token from HTTP-only cookie
        access_token = request.cookies.get("access_token")

        if not access_token:
            return self._unauthorized_response("Authentication required")

        try:
            # Validate JWT and extract payload
            payload = decode_jwt(access_token, self.public_key, self.algorithm)
            user_context = extract_user_context(payload)

            # Add user context to request state for use in route handlers
            request.state.user_id = user_context["user_id"]
            request.state.user_role = user_context["role"]
            request.state.user_email = user_context["email"]

            # Generate request ID for tracing
            request_id = str(uuid.uuid4())
            request.state.request_id = request_id

            # Add headers that will be forwarded to backend services
            request.state.backend_headers = {
                "X-User-ID": user_context["user_id"],
                "X-User-Role": user_context["role"],
                "X-Request-ID": request_id,
                "X-Correlation-ID": request.headers.get("X-Correlation-ID", request_id)
            }

            # Continue to route handler
            response = await call_next(request)
            return response

        except JWTValidationError as e:
            return self._unauthorized_response(str(e))

    def _unauthorized_response(self, message: str) -> JSONResponse:
        """Return standardized 401 error response"""
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": message,
                    "details": {}
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )
