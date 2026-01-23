import pytest
from django.test import RequestFactory
from apps.profiles.views import UserProfileViewSet
from apps.profiles.models import UserProfile
import uuid
import json


@pytest.mark.django_db
class TestUserProfileViewSet:
    def test_get_me_creates_profile_if_not_exists(self):
        """Test GET /users/me auto-creates profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        request = factory.get('/api/v1/users/me/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'get': 'me'})
        response = view(request)

        assert response.status_code == 200
        assert response.data['success'] is True
        assert UserProfile.objects.filter(user_id=user_id).exists()

    def test_get_me_returns_existing_profile(self):
        """Test GET /users/me returns existing profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890'
        )

        request = factory.get('/api/v1/users/me/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'get': 'me'})
        response = view(request)

        assert response.status_code == 200
        assert response.data['data']['phone'] == '+1234567890'

    def test_patch_me_updates_profile(self):
        """Test PATCH /users/me updates profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        UserProfile.objects.create(user_id=user_id)

        request = factory.patch(
            '/api/v1/users/me/',
            data=json.dumps({'phone': '+9999999999'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'patch': 'me'})
        response = view(request)

        assert response.status_code == 200
        profile = UserProfile.objects.get(user_id=user_id)
        assert profile.phone == '+9999999999'
