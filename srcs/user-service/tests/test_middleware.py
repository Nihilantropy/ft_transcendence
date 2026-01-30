import pytest
from django.test import RequestFactory
from django.http import HttpResponse, JsonResponse
from apps.profiles.middleware import UserContextMiddleware, Custom404Middleware


class TestUserContextMiddleware:
    def test_middleware_extracts_user_id_header(self):
        """Test middleware extracts X-User-ID header"""
        factory = RequestFactory()
        request = factory.get('/', HTTP_X_USER_ID='12345')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert hasattr(request, 'user_id')
        assert request.user_id == '12345'

    def test_middleware_extracts_user_role_header(self):
        """Test middleware extracts X-User-Role header"""
        factory = RequestFactory()
        request = factory.get('/', HTTP_X_USER_ROLE='admin')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert hasattr(request, 'user_role')
        assert request.user_role == 'admin'

    def test_middleware_defaults_user_role_to_user(self):
        """Test middleware defaults to 'user' role"""
        factory = RequestFactory()
        request = factory.get('/')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert request.user_role == 'user'

    def test_middleware_handles_missing_user_id(self):
        """Test middleware handles missing X-User-ID"""
        factory = RequestFactory()
        request = factory.get('/')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert request.user_id is None


class TestCustom404Middleware:
    """Test Custom404Middleware converts 404 responses to JSON"""
    
    def test_converts_html_404_to_json(self):
        """Test middleware converts HTML 404 to standardized JSON"""
        factory = RequestFactory()
        request = factory.get('/nonexistent/')
        
        # Simulate Django's default HTML 404
        html_response = HttpResponse('Not Found', status=404, content_type='text/html')
        
        middleware = Custom404Middleware(lambda r: html_response)
        response = middleware.process_response(request, html_response)
        
        assert response.status_code == 404
        assert isinstance(response, JsonResponse)
        assert response['Content-Type'] == 'application/json'
        
        # Check response structure
        import json
        data = json.loads(response.content)
        assert data['success'] is False
        assert data['error']['code'] == 'NOT_FOUND'
        assert data['error']['message'] == 'The requested resource was not found'
    
    def test_converts_drf_json_404_to_standardized_format(self):
        """Test middleware converts DRF's JSON 404 to standardized format"""
        factory = RequestFactory()
        request = factory.get('/api/users/nonexistent/')
        
        # Simulate DRF's default JSON 404 response
        drf_response = JsonResponse({'detail': 'Not found.'}, status=404)
        
        middleware = Custom404Middleware(lambda r: drf_response)
        response = middleware.process_response(request, drf_response)
        
        assert response.status_code == 404
        
        # Check it's been converted to standardized format
        import json
        data = json.loads(response.content)
        assert 'success' in data
        assert data['success'] is False
        assert 'error' in data
        assert data['error']['code'] == 'NOT_FOUND'
        # Should NOT have DRF's 'detail' key
        assert 'detail' not in data
    
    def test_preserves_non_404_responses(self):
        """Test middleware doesn't modify non-404 responses"""
        factory = RequestFactory()
        request = factory.get('/api/users/me/')
        
        # Simulate successful response
        success_response = JsonResponse({'success': True, 'data': {}}, status=200)
        
        middleware = Custom404Middleware(lambda r: success_response)
        response = middleware.process_response(request, success_response)
        
        # Should be unchanged
        assert response.status_code == 200
        import json
        data = json.loads(response.content)
        assert data['success'] is True
    
    def test_preserves_500_errors(self):
        """Test middleware doesn't convert 500 errors"""
        factory = RequestFactory()
        request = factory.get('/api/error/')
        
        error_response = JsonResponse({'error': 'Internal error'}, status=500)
        
        middleware = Custom404Middleware(lambda r: error_response)
        response = middleware.process_response(request, error_response)
        
        # Should be unchanged
        assert response.status_code == 500
        import json
        data = json.loads(response.content)
        assert 'error' in data
    
    def test_response_has_timestamp(self):
        """Test standardized 404 response includes timestamp"""
        factory = RequestFactory()
        request = factory.get('/nonexistent/')
        
        html_response = HttpResponse('Not Found', status=404, content_type='text/html')
        
        middleware = Custom404Middleware(lambda r: html_response)
        response = middleware.process_response(request, html_response)
        
        import json
        data = json.loads(response.content)
        assert 'timestamp' in data
        assert isinstance(data['timestamp'], str)
        # Should be ISO8601 format
        from datetime import datetime
        datetime.fromisoformat(data['timestamp'])
