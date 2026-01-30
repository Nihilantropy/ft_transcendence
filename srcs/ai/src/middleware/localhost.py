"""Localhost-only access dependency."""

from fastapi import Request, HTTPException, status
import logging

logger = logging.getLogger(__name__)


async def require_localhost(request: Request):
    """Dependency that restricts access to localhost only.

    Args:
        request: FastAPI request object

    Raises:
        HTTPException: 403 if request is not from localhost

    Returns:
        True if request is from localhost
    """
    client_host = request.client.host if request.client else None

    # Allow localhost, 127.0.0.1, IPv6 localhost, and Docker internal IPs (172.x.x.x)
    allowed_hosts = ["127.0.0.1", "localhost", "::1"]

    if client_host and (client_host in allowed_hosts or client_host.startswith("172.")):
        logger.debug(f"Localhost access granted from {client_host}")
        return True

    logger.warning(f"Rejected non-localhost access attempt from {client_host}")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "success": False,
            "error": {
                "code": "FORBIDDEN",
                "message": "This endpoint is only accessible from localhost"
            }
        }
    )
