from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
import httpx
import uuid

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


def clear_auth_cookies(response):
    """
    Clear authentication cookies (for logout).

    Args:
        response: Response object to clear cookies on

    Returns:
        response: Response with cookies cleared
    """
    # Clear access_token
    response.set_cookie(
        key='access_token',
        value='',
        max_age=0,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    # Clear refresh_token
    response.set_cookie(
        key='refresh_token',
        value='',
        max_age=0,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path='/api/v1/auth/refresh',
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
    )

    return response


# TODO this will be replaced with a message queue in the future
def delete_user_cascade(user_id, user_role='user'):
    """
    Delete user data across all microservices in cascade.
    
    First deletes user profile data from user-service, then deletes auth user.
    This ensures data consistency and follows microservice deletion best practices.
    
    NOTE: This function assumes that the user-service exposes an API endpoint
    for deleting user profiles given a user ID.

    Args:
        user_id: UUID of user to delete
        user_role: Role of user (default: 'user')
    
    Returns:
        dict: Deletion summary with counts from each service
        
    Raises:
        Exception: If user-service deletion fails
    """
    from apps.authentication.models import User, RefreshToken
    
    # Step 1: Delete user profile data from user-service
    user_service_url = settings.USER_SERVICE_URL
    headers = {
        'X-User-ID': str(user_id),
        'X-User-Role': user_role,
        'X-Request-ID': str(uuid.uuid4())
    }
    
    deletion_summary = {}
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.delete(
                f"{user_service_url}/api/v1/users/delete",
                headers=headers
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get('success') and 'data' in response_data:
                    deletion_summary['user_service'] = response_data['data'].get('deleted', {})
            else:
                raise Exception(
                    f"User-service deletion failed with status {response.status_code}: {response.text}"
                )
    except httpx.RequestError as e:
        raise Exception(f"Failed to connect to user-service: {str(e)}")
    
    # Step 2: Delete auth data (refresh tokens and user)
    # refresh_token_count = RefreshToken.objects.filter(user_id=user_id).count()
    # RefreshToken.objects.filter(user_id=user_id).delete()
    
    user_deleted = User.objects.filter(id=user_id).delete()
    
    deletion_summary['auth_service'] = {
        'users': user_deleted[0] if user_deleted else 0
        # 'refresh_tokens': refresh_token_count
    }
    
    return deletion_summary
