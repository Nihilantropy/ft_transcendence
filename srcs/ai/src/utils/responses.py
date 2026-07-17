from datetime import datetime, UTC
from typing import Any, Optional

def success_response(data: Any) -> dict:
    """Create standardized success response.

    Args:
        data: Response data payload

    Returns:
        Standardized success response dict
    """
    return {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.now(UTC).isoformat()
    }

def error_response(code: str, message: str, details: Optional[dict] = None) -> dict:
    """Create standardized error response.

    Args:
        code: Error code (e.g., "INVALID_IMAGE")
        message: Human-readable error message
        details: Optional additional error details

    Returns:
        Standardized error response dict
    """
    return {
        "success": False,
        "data": None,
        "error": {
            "code": code,
            "message": message,
            "details": details or {}
        },
        "timestamp": datetime.now(UTC).isoformat()
    }
