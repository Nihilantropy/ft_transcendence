"""
Custom middleware for user-service.
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from datetime import datetime


class UserContextMiddleware:
    """
    Extract X-User-ID and X-User-Role headers from API Gateway.
    Attach to request object for use in views/permissions.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract headers set by API Gateway
        request.user_id = request.headers.get('X-User-ID')
        request.user_role = request.headers.get('X-User-Role', 'user')

        response = self.get_response(request)
        return response


class Custom404Middleware(MiddlewareMixin):
    """
    Middleware to handle 404 errors and return JSON responses.
    
    Converts Django's default HTML 404 pages to standardized JSON format.
    This ensures consistent error responses across the API.
    """
    
    def process_response(self, request, response):
        """Convert 404 responses (both HTML and DRF JSON) to standardized format"""
        if response.status_code == 404:
            # Return standardized JSON 404 regardless of original format
            # This handles both Django's HTML 404 and DRF's {"detail": "Not found."}
            return JsonResponse(
                {
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "The requested resource was not found",
                        "details": {}
                    },
                    "timestamp": datetime.utcnow().isoformat()
                },
                status=404
            )
        
        return response

