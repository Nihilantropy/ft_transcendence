import jwt
import hashlib
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone

def generate_access_token(user):
    """
    Generate access token for user.

    Args:
        user: User object

    Returns:
        JWT token string signed with RS256 private key
    """
    now = timezone.now()
    expiration = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES)

    payload = {
        'user_id': str(user.id),
        'email': user.email,
        'role': user.role,
        'token_type': 'access',
        'iat': int(now.timestamp()),
        'exp': int(expiration.timestamp())
    }

    token = jwt.encode(
        payload,
        settings.JWT_KEYS['private'],
        algorithm=settings.JWT_ALGORITHM
    )

    return token

def generate_refresh_token(user, token_id):
    """
    Generate refresh token for user.

    Args:
        user: User object
        token_id: UUID of RefreshToken database record

    Returns:
        JWT token string signed with RS256 private key
    """
    now = timezone.now()
    expiration = now + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)

    payload = {
        'user_id': str(user.id),
        'token_id': str(token_id),
        'token_type': 'refresh',
        'iat': int(now.timestamp()),
        'exp': int(expiration.timestamp())
    }

    token = jwt.encode(
        payload,
        settings.JWT_KEYS['private'],
        algorithm=settings.JWT_ALGORITHM
    )

    return token

def decode_token(token):
    """
    Decode and validate JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    payload = jwt.decode(
        token,
        settings.JWT_KEYS['public'],
        algorithms=[settings.JWT_ALGORITHM]
    )

    return payload

def hash_token(token):
    """
    Hash token using SHA256.

    Args:
        token: Token string to hash

    Returns:
        Hexadecimal hash string (64 characters)
    """
    return hashlib.sha256(token.encode()).hexdigest()
