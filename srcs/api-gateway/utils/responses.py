from typing import Any, Optional, Dict
from datetime import datetime
from pydantic import BaseModel

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
    timestamp: str = datetime.utcnow().isoformat()

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
