import pytest
from apps.profiles.serializers import UserProfileSerializer, UserProfileUpdateSerializer, PetSerializer, PetCreateSerializer, PetAnalysisSerializer, PetAnalysisCreateSerializer
from apps.profiles.models import UserProfile, Pet, PetAnalysis
import uuid


@pytest.mark.django_db
class TestUserProfileSerializer:
    def test_serialize_user_profile(self):
        """Test serializing user profile"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890',
            address={'city': 'SF'},
            preferences={'theme': 'dark'}
        )

        serializer = UserProfileSerializer(profile)
        data = serializer.data

        assert str(data['user_id']) == str(user_id)
        assert data['phone'] == '+1234567890'
        assert data['address'] == {'city': 'SF'}
        assert data['preferences'] == {'theme': 'dark'}

    def test_user_profile_update_serializer_excludes_user_id(self):
        """Test update serializer does not include user_id"""
        serializer = UserProfileUpdateSerializer()
        assert 'user_id' not in serializer.fields

    def test_validate_phone_format(self):
        """Test phone validation"""
        serializer = UserProfileUpdateSerializer(data={'phone': 'invalid-phone'})
        assert not serializer.is_valid()
        assert 'phone' in serializer.errors

    def test_validate_address_structure(self):
        """Test address structure validation"""
        invalid_address = {'invalid_key': 'value'}
        serializer = UserProfileUpdateSerializer(data={'address': invalid_address})
        assert not serializer.is_valid()
        assert 'address' in serializer.errors


@pytest.mark.django_db
class TestPetSerializer:
    def test_serialize_pet(self):
        """Test serializing pet"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id,
            name='Buddy',
            species='dog',
            breed='Golden Retriever',
            age=24,
            weight=30.5
        )

        serializer = PetSerializer(pet)
        data = serializer.data

        assert data['name'] == 'Buddy'
        assert data['species'] == 'dog'
        assert data['breed'] == 'Golden Retriever'
        assert data['age'] == 24
        assert data['weight'] == 30.5

    def test_validate_age_positive(self):
        """Test age must be positive"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'age': -5})
        assert not serializer.is_valid()
        assert 'age' in serializer.errors

    def test_validate_weight_positive(self):
        """Test weight must be positive"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'weight': -10})
        assert not serializer.is_valid()
        assert 'weight' in serializer.errors

    def test_validate_breed_confidence_range(self):
        """Test confidence must be 0-1"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'breed_confidence': 1.5})
        assert not serializer.is_valid()
        assert 'breed_confidence' in serializer.errors

    def test_pet_create_serializer_minimal_fields(self):
        """Test PetCreateSerializer with minimal fields"""
        data = {'name': 'Buddy', 'species': 'dog'}
        serializer = PetCreateSerializer(data=data)
        assert serializer.is_valid()

    def test_pet_create_missing_name(self):
        """Test PetCreateSerializer rejects missing name"""
        serializer = PetCreateSerializer(data={'species': 'cat'})
        assert not serializer.is_valid()
        assert 'name' in serializer.errors

    def test_pet_create_blank_name(self):
        """Test PetCreateSerializer rejects blank name"""
        serializer = PetCreateSerializer(data={'name': '', 'species': 'dog'})
        assert not serializer.is_valid()
        assert 'name' in serializer.errors

    def test_pet_create_empty_body(self):
        """Test PetCreateSerializer rejects empty data"""
        serializer = PetCreateSerializer(data={})
        assert not serializer.is_valid()
        assert 'name' in serializer.errors

    def test_pet_create_invalid_species(self):
        """Test PetCreateSerializer rejects invalid species choice"""
        serializer = PetCreateSerializer(data={'name': 'Buddy', 'species': 'hamster'})
        assert not serializer.is_valid()
        assert 'species' in serializer.errors

    def test_pet_create_missing_species(self):
        """Test PetCreateSerializer rejects missing species"""
        serializer = PetCreateSerializer(data={'name': 'Rex'})
        assert not serializer.is_valid()
        assert 'species' in serializer.errors

    def test_pet_create_invalid_age_type(self):
        """Test PetCreateSerializer rejects non-integer age"""
        serializer = PetCreateSerializer(data={'name': 'Test', 'species': 'dog', 'age': 'old'})
        assert not serializer.is_valid()
        assert 'age' in serializer.errors

    def test_pet_create_negative_weight(self):
        """Test PetCreateSerializer rejects negative weight"""
        serializer = PetCreateSerializer(data={'name': 'Test', 'species': 'dog', 'weight': -5.0})
        assert not serializer.is_valid()
        assert 'weight' in serializer.errors


@pytest.mark.django_db
class TestPetAnalysisSerializer:
    def test_serialize_pet_analysis(self):
        """Test serializing pet analysis"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/test.jpg',
            breed_detected='Labrador',
            confidence=0.88,
            traits={'size': 'large'}
        )

        serializer = PetAnalysisSerializer(analysis)
        data = serializer.data

        assert data['breed_detected'] == 'Labrador'
        assert data['confidence'] == 0.88
        assert data['traits'] == {'size': 'large'}

    def test_pet_analysis_create_serializer(self):
        """Test PetAnalysisCreateSerializer"""
        data = {
            'pet_id': str(uuid.uuid4()),
            'user_id': str(uuid.uuid4()),
            'image_url': '/media/test.jpg',
            'breed_detected': 'Beagle',
            'confidence': 0.92,
            'traits': {}
        }
        serializer = PetAnalysisCreateSerializer(data=data)
        assert serializer.is_valid()
