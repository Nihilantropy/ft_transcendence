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
