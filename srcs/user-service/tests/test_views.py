import pytest
from django.test import RequestFactory
from apps.profiles.views import UserProfileViewSet, PetViewSet, PetAnalysisViewSet
from apps.profiles.models import UserProfile, Pet, PetAnalysis
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

    def test_delete_user_data_removes_all_user_records(self):
        """Test DELETE /users/delete removes profile, pets, and analyses"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        
        # Create user data
        profile = UserProfile.objects.create(user_id=user_id, phone='+1234567890')
        pet1 = Pet.objects.create(user_id=user_id, name='Dog1', species='dog')
        pet2 = Pet.objects.create(user_id=user_id, name='Cat1', species='cat')
        analysis1 = PetAnalysis.objects.create(
            user_id=user_id,
            pet_id=pet1.id,
            image_url='http://example.com/img1.jpg',
            breed_detected='Golden Retriever',
            confidence=0.95
        )
        analysis2 = PetAnalysis.objects.create(
            user_id=user_id,
            pet_id=pet2.id,
            image_url='http://example.com/img2.jpg',
            breed_detected='Persian Cat',
            confidence=0.88
        )

        request = factory.delete('/api/v1/users/delete/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'delete': 'delete_user_data'})
        response = view(request)

        assert response.status_code == 200
        assert response.data['success'] is True
        assert 'deleted' in response.data['data']
        assert response.data['data']['deleted']['profiles'] == 1
        assert response.data['data']['deleted']['pets'] == 2
        assert response.data['data']['deleted']['analyses'] == 2
        
        # Verify all data is deleted
        assert not UserProfile.objects.filter(user_id=user_id).exists()
        assert not Pet.objects.filter(user_id=user_id).exists()
        assert not PetAnalysis.objects.filter(user_id=user_id).exists()

    def test_delete_user_data_without_user_id(self):
        """Test DELETE /users/delete returns 401 if no user_id in request"""
        factory = RequestFactory()
        request = factory.delete('/api/v1/users/delete/')
        request.user_id = None
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'delete': 'delete_user_data'})
        response = view(request)

        assert response.status_code == 401
        assert response.data['success'] is False
        assert response.data['error']['code'] == 'UNAUTHORIZED'

    def test_delete_user_data_only_deletes_own_data(self):
        """Test DELETE /users/delete doesn't affect other users' data"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        
        # Create data for both users
        UserProfile.objects.create(user_id=user_id, phone='+1111111111')
        UserProfile.objects.create(user_id=other_user_id, phone='+2222222222')
        Pet.objects.create(user_id=user_id, name='MyDog', species='dog')
        Pet.objects.create(user_id=other_user_id, name='OtherDog', species='dog')

        request = factory.delete('/api/v1/users/delete/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'delete': 'delete_user_data'})
        response = view(request)

        assert response.status_code == 200
        
        # Verify only user_id data is deleted
        assert not UserProfile.objects.filter(user_id=user_id).exists()
        assert not Pet.objects.filter(user_id=user_id).exists()
        
        # Verify other user's data remains
        assert UserProfile.objects.filter(user_id=other_user_id).exists()
        assert Pet.objects.filter(user_id=other_user_id).exists()


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


@pytest.mark.django_db
class TestPetAnalysisViewSet:
    def test_list_analyses_filters_by_user_id(self):
        """Test GET /analyses filters by user_id"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id,
            image_url='/test.jpg', breed_detected='Lab', confidence=0.9, traits={}
        )
        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=other_user_id,
            image_url='/test2.jpg', breed_detected='Poodle', confidence=0.85, traits={}
        )

        request = factory.get('/api/v1/analyses/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetAnalysisViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['breed_detected'] == 'Lab'

    def test_create_analysis(self):
        """Test POST /analyses"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        data = {
            'pet_id': str(pet_id),
            'user_id': str(user_id),
            'image_url': '/test.jpg',
            'breed_detected': 'Beagle',
            'confidence': 0.92,
            'traits': {'size': 'medium'}
        }

        request = factory.post(
            '/api/v1/analyses/',
            data=json.dumps(data),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetAnalysisViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 201
        assert PetAnalysis.objects.filter(breed_detected='Beagle').exists()


# Additional tests for missing coverage

@pytest.mark.django_db
class TestUserProfileViewSetAdditional:
    """Additional tests for UserProfile endpoints"""
    
    def test_put_me_full_update(self):
        """Test PUT /users/me performs full update"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        UserProfile.objects.create(user_id=user_id, phone='+1111111111')
        
        request = factory.put(
            '/api/v1/users/me/',
            data=json.dumps({
                'phone': '+9999999999',
                'address': {'city': 'NYC', 'country': 'USA'},
                'preferences': {'theme': 'light'}
            }),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = UserProfileViewSet.as_view({'put': 'me'})
        response = view(request)
        
        assert response.status_code == 200
        profile = UserProfile.objects.get(user_id=user_id)
        assert profile.phone == '+9999999999'
        assert profile.address == {'city': 'NYC', 'country': 'USA'}
    
    def test_validation_error_on_invalid_phone(self):
        """Test validation error with invalid phone format"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        
        request = factory.patch(
            '/api/v1/users/me/',
            data=json.dumps({'phone': 'invalid-phone-format'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = UserProfileViewSet.as_view({'patch': 'me'})
        response = view(request)
        
        assert response.status_code == 422
        assert response.data['success'] is False
        assert response.data['error']['code'] == 'VALIDATION_ERROR'


@pytest.mark.django_db
class TestPetViewSetAdditional:
    """Additional tests for Pet CRUD operations"""
    
    def test_update_pet_put(self):
        """Test PUT /pets/{id} updates pet"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id, name='OldName', species='dog', age=12
        )
        
        request = factory.put(
            f'/api/v1/pets/{pet.id}/',
            data=json.dumps({
                'name': 'NewName',
                'species': 'dog',
                'breed': 'Labrador',
                'age': 24,
                'weight': 35.0
            }),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'put': 'update'})
        response = view(request, pk=pet.id)
        
        assert response.status_code == 200
        pet.refresh_from_db()
        assert pet.name == 'NewName'
        assert pet.breed == 'Labrador'
        assert pet.age == 24
    
    def test_partial_update_pet_patch(self):
        """Test PATCH /pets/{id} partially updates pet"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id, name='Buddy', species='dog', age=12
        )
        
        request = factory.patch(
            f'/api/v1/pets/{pet.id}/',
            data=json.dumps({'age': 24}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'patch': 'partial_update'})
        response = view(request, pk=pet.id)
        
        assert response.status_code == 200
        pet.refresh_from_db()
        assert pet.age == 24
        assert pet.name == 'Buddy'  # Unchanged
    
    def test_delete_pet(self):
        """Test DELETE /pets/{id} deletes pet"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id, name='ToDelete', species='cat'
        )
        pet_id = pet.id
        
        request = factory.delete(f'/api/v1/pets/{pet_id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'delete': 'destroy'})
        response = view(request, pk=pet_id)
        
        assert response.status_code == 200
        assert not Pet.objects.filter(id=pet_id).exists()
    
    def test_get_pet_analyses(self):
        """Test GET /pets/{id}/analyses returns pet's analysis history"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(user_id=user_id, name='Buddy', species='dog')
        
        # Create analyses for this pet
        PetAnalysis.objects.create(
            pet_id=pet.id, user_id=user_id,
            image_url='/test1.jpg', breed_detected='Lab', confidence=0.9, traits={}
        )
        PetAnalysis.objects.create(
            pet_id=pet.id, user_id=user_id,
            image_url='/test2.jpg', breed_detected='Retriever', confidence=0.85, traits={}
        )
        
        request = factory.get(f'/api/v1/pets/{pet.id}/analyses/')
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'get': 'analyses'})
        response = view(request, pk=pet.id)
        
        assert response.status_code == 200
        assert len(response.data['data']) == 2
    
    def test_validation_error_on_invalid_age(self):
        """Test validation error with negative age"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        
        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Test', 'species': 'dog', 'age': -5}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)
        
        assert response.status_code == 422
        assert response.data['success'] is False
    
    def test_permission_denied_delete_other_user_pet(self):
        """Test non-owner cannot delete another user's pet"""
        factory = RequestFactory()
        owner_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        
        pet = Pet.objects.create(
            user_id=owner_id, name='NotYours', species='dog'
        )
        
        request = factory.delete(f'/api/v1/pets/{pet.id}/')
        request.user_id = str(other_user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'delete': 'destroy'})
        response = view(request, pk=pet.id)
        
        # Should return 404 (pet filtered out by queryset)
        assert response.status_code == 404
        # Pet should still exist
        assert Pet.objects.filter(id=pet.id).exists()
    
    def test_create_pet_empty_body(self):
        """Test POST /pets with empty body returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert response.data['error']['code'] == 'VALIDATION_ERROR'

    def test_create_pet_missing_name(self):
        """Test POST /pets without name returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'species': 'cat', 'age': 12}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert response.data['error']['code'] == 'VALIDATION_ERROR'
        assert 'name' in response.data['error']['details']

    def test_create_pet_blank_name(self):
        """Test POST /pets with blank name returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': '', 'species': 'dog'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'name' in response.data['error']['details']

    def test_create_pet_invalid_species(self):
        """Test POST /pets with invalid species value returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Buddy', 'species': 'hamster'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'species' in response.data['error']['details']

    def test_create_pet_missing_species(self):
        """Test POST /pets without species returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Rex'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'species' in response.data['error']['details']

    def test_create_pet_invalid_age_type(self):
        """Test POST /pets with non-integer age returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Test', 'species': 'dog', 'age': 'two'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'age' in response.data['error']['details']

    def test_create_pet_invalid_weight(self):
        """Test POST /pets with negative weight returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Test', 'species': 'cat', 'weight': -3.5}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'weight' in response.data['error']['details']

    def test_create_pet_invalid_json(self):
        """Test POST /pets with malformed JSON returns 400"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data='not valid json{',
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 400

    def test_update_pet_invalid_species(self):
        """Test PUT /pets/{id} with invalid species returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id, name='Buddy', species='dog'
        )

        request = factory.put(
            f'/api/v1/pets/{pet.id}/',
            data=json.dumps({'name': 'Buddy', 'species': 'parrot'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'put': 'update'})
        response = view(request, pk=pet.id)

        assert response.status_code == 422
        assert response.data['success'] is False
        assert 'species' in response.data['error']['details']

    def test_update_nonexistent_pet(self):
        """Test PUT /pets/{id} for nonexistent pet returns 404"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        fake_id = uuid.uuid4()

        request = factory.put(
            f'/api/v1/pets/{fake_id}/',
            data=json.dumps({'name': 'Ghost', 'species': 'dog'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'put': 'update'})
        response = view(request, pk=fake_id)

        assert response.status_code == 404

    def test_partial_update_invalid_age(self):
        """Test PATCH /pets/{id} with negative age returns 422"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id, name='Buddy', species='dog', age=12
        )

        request = factory.patch(
            f'/api/v1/pets/{pet.id}/',
            data=json.dumps({'age': -10}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'patch': 'partial_update'})
        response = view(request, pk=pet.id)

        assert response.status_code == 422
        assert response.data['success'] is False

    def test_404_on_nonexistent_pet(self):
        """Test 404 when pet doesn't exist"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        fake_id = uuid.uuid4()
        
        request = factory.get(f'/api/v1/pets/{fake_id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=fake_id)
        
        assert response.status_code == 404
        assert response.data['error']['code'] == 'NOT_FOUND'


@pytest.mark.django_db
class TestPetAnalysisViewSetAdditional:
    """Additional tests for PetAnalysis endpoints"""
    
    def test_retrieve_analysis(self):
        """Test GET /analyses/{id} returns single analysis"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        
        analysis = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id,
            image_url='/test.jpg', breed_detected='Poodle',
            confidence=0.87, traits={'size': 'small'}
        )
        
        request = factory.get(f'/api/v1/analyses/{analysis.id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetAnalysisViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=analysis.id)
        
        assert response.status_code == 200
        assert response.data['data']['breed_detected'] == 'Poodle'
    
    def test_validation_error_on_create(self):
        """Test validation error with invalid data"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        
        # Missing required fields
        request = factory.post(
            '/api/v1/analyses/',
            data=json.dumps({'breed_detected': 'Lab'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetAnalysisViewSet.as_view({'post': 'create'})
        response = view(request)
        
        assert response.status_code == 422
        assert response.data['success'] is False
    
    def test_admin_can_view_all_analyses(self):
        """Test admin role can view all analyses"""
        factory = RequestFactory()
        admin_id = uuid.uuid4()
        user1_id = uuid.uuid4()
        user2_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        
        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user1_id,
            image_url='/1.jpg', breed_detected='A', confidence=0.9, traits={}
        )
        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user2_id,
            image_url='/2.jpg', breed_detected='B', confidence=0.8, traits={}
        )
        
        request = factory.get('/api/v1/analyses/')
        request.user_id = str(admin_id)
        request.user_role = 'admin'
        
        view = PetAnalysisViewSet.as_view({'get': 'list'})
        response = view(request)
        
        assert response.status_code == 200
        assert len(response.data['data']) == 2
    
    def test_404_on_nonexistent_analysis(self):
        """Test 404 when analysis doesn't exist"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        fake_id = uuid.uuid4()
        
        request = factory.get(f'/api/v1/analyses/{fake_id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'
        
        view = PetAnalysisViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=fake_id)
        
        assert response.status_code == 404
        assert response.data['error']['code'] == 'NOT_FOUND'
