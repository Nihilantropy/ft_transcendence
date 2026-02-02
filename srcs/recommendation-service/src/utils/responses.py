from datetime import datetime, UTC
from typing import Any, Optional, Dict

def success_response(data: Any) -> Dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.now(UTC).isoformat()
    }

def error_response(code: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details or {}},
        "timestamp": datetime.now(UTC).isoformat()
    }
