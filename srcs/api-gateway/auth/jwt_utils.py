from typing import Dict, Any
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime

class JWTValidationError(Exception):
    """Custom exception for JWT validation errors"""
    pass

def decode_jwt(token: str, secret_key: str, algorithm: str = "HS256") -> Dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string
        secret_key: Secret key for signature verification
        algorithm: JWT algorithm (default: HS256)

    Returns:
        Dict containing the decoded payload

    Raises:
        JWTValidationError: If token is invalid, expired, or malformed
    """
    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[algorithm]
        )
        return payload

    except ExpiredSignatureError:
        raise JWTValidationError("Token has expired")

    except JWTError as e:
        # Covers invalid signature, malformed tokens, etc.
        raise JWTValidationError(f"Invalid token: {str(e)}")

def extract_user_context(payload: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract user context from JWT payload for forwarding to backend services.

    Args:
        payload: Decoded JWT payload

    Returns:
        Dict with user_id and role
    """
    return {
        "user_id": payload.get("user_id", ""),
        "role": payload.get("role", "user"),
        "email": payload.get("email", "")
    }
