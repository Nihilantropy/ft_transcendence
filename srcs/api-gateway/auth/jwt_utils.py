from typing import Dict, Any
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime

class JWTValidationError(Exception):
    """Custom exception for JWT validation errors"""
    pass

def decode_jwt(token: str, key: str, algorithm: str = "RS256") -> Dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string
        key: Key for signature verification
             - For RS256: RSA public key (PEM format)
             - For HS256: Shared secret key
        algorithm: JWT algorithm (default: RS256)

    Returns:
        Dict containing the decoded payload

    Raises:
        JWTValidationError: If token is invalid, expired, or malformed
    """
    try:
        payload = jwt.decode(
            token,
            key,
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
