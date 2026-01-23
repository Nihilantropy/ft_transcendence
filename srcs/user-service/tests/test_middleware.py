import pytest
from django.test import RequestFactory
from apps.profiles.middleware import UserContextMiddleware


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
