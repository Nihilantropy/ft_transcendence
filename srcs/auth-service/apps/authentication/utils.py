from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response

from apps.authentication.jwt_utils import generate_access_token, generate_refresh_token, hash_token


def issue_auth_tokens(user, response):
    """
    Issue access and refresh tokens for a user.

    Args:
        user: User object to issue tokens for
        response: Response object to set cookies on

    Returns:
        response: Response with cookies set
    """
    from apps.authentication.models import RefreshToken  # Avoid circular import

    # Generate access token
    access_token = generate_access_token(user)

    # Create refresh token record
    refresh_token_record = RefreshToken.objects.create(
        user=user,
        token_hash='placeholder',
        expires_at=timezone.now() + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)
    )

    # Generate refresh token
    refresh_token = generate_refresh_token(user, refresh_token_record.id)

    # Update token hash
    refresh_token_record.token_hash = hash_token(refresh_token)
    refresh_token_record.save(update_fields=['token_hash'])

    # Set cookies
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path='/api/v1/auth/refresh',
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    return response


def success_response(data, status=200):
    """
    Create standardized success response.

    Args:
        data: Response data
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': True,
        'data': data,
        'error': None,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)

def error_response(code, message, details=None, status=400):
    """
    Create standardized error response.

    Args:
        code: Error code (e.g., 'VALIDATION_ERROR')
        message: Human-readable error message
        details: Optional dict with error details
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': False,
        'data': None,
        'error': {
            'code': code,
            'message': message,
            'details': details or {}
        },
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)
