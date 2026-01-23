from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, Response
import httpx
from config import settings
from datetime import datetime
from typing import Dict, Any
import json

router = APIRouter()

# Async HTTP client for backend requests
httpx_client = httpx.AsyncClient(timeout=30.0)

# Service routing map
SERVICE_ROUTES = {
    "/api/v1/auth": settings.AUTH_SERVICE_URL,
    "/api/v1/users": settings.USER_SERVICE_URL,
    "/api/v1/pets": settings.USER_SERVICE_URL,
    "/api/v1/vision": settings.AI_SERVICE_URL,
    "/api/v1/rag": settings.AI_SERVICE_URL,
    "/api/v1/recommendations": settings.AI_SERVICE_URL,
}

def get_backend_service_url(path: str) -> str:
    """
    Determine which backend service to route to based on path.

    Args:
        path: Request path (e.g., /api/v1/auth/login)

    Returns:
        Backend service base URL

    Raises:
        HTTPException: If no matching service found
    """
    for prefix, service_url in SERVICE_ROUTES.items():
        if path.startswith(prefix):
            return service_url

    raise HTTPException(
        status_code=404,
        detail={"error": {"code": "NOT_FOUND", "message": "Service not found"}}
    )

async def forward_request(
    request: Request,
    backend_url: str,
    path: str,
    method: str
) -> Dict[str, Any]:
    """
    Forward request to backend service with user context headers.

    Args:
        request: FastAPI request object
        backend_url: Backend service base URL
        path: Request path
        method: HTTP method

    Returns:
        Backend service response as dict
    """
    # Get user context headers from middleware
    backend_headers = getattr(request.state, "backend_headers", {})

    # Forward original headers (except host, cookie)
    forward_headers = dict(request.headers)
    forward_headers.pop("host", None)
    forward_headers.pop("cookie", None)

    # Merge with user context headers
    forward_headers.update(backend_headers)

    # Build full backend URL
    full_url = f"{backend_url}{path}"

    # Get request body if present
    body = None
    if method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    try:
        # Forward request to backend
        response = await httpx_client.request(
            method=method,
            url=full_url,
            headers=forward_headers,
            content=body,
            params=dict(request.query_params)
        )

        return {
            "status_code": response.status_code,
            "content": response.json() if response.content else None,
            "headers": dict(response.headers),
            "raw_response": response  # Keep raw response for Set-Cookie handling
        }

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": f"Backend service unavailable: {str(e)}",
                    "details": {}
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_handler(request: Request, path: str):
    """
    Universal proxy handler that routes requests to appropriate backend services.
    """
    # Construct full path
    full_path = f"/api/{path}"

    # Determine backend service
    backend_url = get_backend_service_url(full_path)

    # Forward request
    backend_response = await forward_request(
        request=request,
        backend_url=backend_url,
        path=full_path,
        method=request.method
    )

    # Build response headers, including Set-Cookie from backend
    response_headers = {}
    set_cookie_headers = []

    # Extract Set-Cookie headers from raw response (preserves multiple cookies)
    raw_response = backend_response.get("raw_response")
    if raw_response:
        for header_name, header_value in raw_response.raw_headers:
            if header_name.lower() == b"set-cookie":
                set_cookie_headers.append(header_value.decode('utf-8'))

    # Return backend response with Set-Cookie headers
    response = Response(
        content=json.dumps(backend_response["content"]),
        status_code=backend_response["status_code"],
        media_type="application/json"
    )

    # Add Set-Cookie headers (FastAPI Response supports multiple set-cookie via raw_headers)
    if set_cookie_headers:
        for cookie in set_cookie_headers:
            response.headers.append("set-cookie", cookie)

    return response
