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

    Only access tokens authenticate a request. The auth-service signs refresh tokens
    (7 days) and the two-factor challenge token ("mfa", issued after the password step
    alone) with the same key, so the signature alone proves nothing about the token's purpose.

    Args:
        payload: Decoded JWT payload

    Returns:
        Dict with user_id, role and email

    Raises:
        JWTValidationError: If the token is not an access token or carries no user_id
    """
    if payload.get("token_type") != "access":
        raise JWTValidationError("Invalid token type")

    user_id = payload.get("user_id")
    if not user_id:
        raise JWTValidationError("Invalid token: missing user_id")

    return {
        "user_id": user_id,
        "role": payload.get("role", "user"),
        "email": payload.get("email", "")
    }
