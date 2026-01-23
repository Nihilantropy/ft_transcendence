import pytest
from django.test import RequestFactory
from apps.profiles.views import UserProfileViewSet, PetViewSet
from apps.profiles.models import UserProfile, Pet
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


@pytest.mark.django_db
class TestPetViewSet:
    def test_list_pets_filters_by_user_id(self):
        """Test GET /pets filters by user_id"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        Pet.objects.create(user_id=user_id, name='MyPet', species='dog')
        Pet.objects.create(user_id=other_user_id, name='OtherPet', species='cat')

        request = factory.get('/api/v1/pets/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['name'] == 'MyPet'

    def test_create_pet_sets_user_id_from_header(self):
        """Test POST /pets sets user_id from request"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Buddy', 'species': 'dog'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 201
        pet = Pet.objects.get(name='Buddy')
        assert pet.user_id == user_id

    def test_retrieve_pet_enforces_ownership(self):
        """Test GET /pets/{id} checks ownership"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        pet = Pet.objects.create(user_id=other_user_id, name='NotMine', species='cat')

        request = factory.get(f'/api/v1/pets/{pet.id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=pet.id)

        assert response.status_code == 404

    def test_admin_can_view_all_pets(self):
        """Test admin role can view all pets"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        Pet.objects.create(user_id=user_id, name='Pet1', species='dog')
        Pet.objects.create(user_id=other_user_id, name='Pet2', species='cat')

        request = factory.get('/api/v1/pets/')
        request.user_id = str(user_id)
        request.user_role = 'admin'

        view = PetViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 2
