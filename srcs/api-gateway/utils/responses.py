from typing import Any, Optional, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, Field


def _utc_now_iso() -> str:
    """Current UTC time, ISO-8601. A function, not a value, so that each
    response is stamped when it is built rather than when this module was
    first imported."""
    return datetime.now(timezone.utc).isoformat()

class ErrorDetail(BaseModel):
    """Error detail structure"""
    code: str
    message: str
    details: Dict[str, Any] = {}

class StandardResponse(BaseModel):
    """Standardized API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[ErrorDetail] = None
    timestamp: str = Field(default_factory=_utc_now_iso)

def error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    response = StandardResponse(
        success=False,
        data=None,
        error=ErrorDetail(
            code=code,
            message=message,
            details=details or {}
        )
    )
    return response.model_dump()
