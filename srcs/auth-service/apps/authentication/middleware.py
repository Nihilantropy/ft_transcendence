"""
Custom middleware for auth-service.

Includes a 404 handler that ensures all Not Found responses are JSON formatted.
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from datetime import datetime


class Custom404Middleware(MiddlewareMixin):
    """
    Middleware to handle 404 errors and return JSON responses.
    
    Converts Django's default HTML 404 pages to standardized JSON format.
    This ensures consistent error responses across the API.
    """
    
    def process_response(self, request, response):
        """Convert 404 HTML responses to JSON"""
        if response.status_code == 404:
            # Check if response is HTML (Django's default 404 page)
            content_type = response.get('Content-Type', '')
            
            if 'text/html' in content_type or not content_type:
                # Return standardized JSON 404
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
