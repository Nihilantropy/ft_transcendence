from datetime import datetime
from rest_framework.response import Response


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
