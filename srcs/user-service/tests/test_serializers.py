import pytest
from apps.profiles.serializers import UserProfileSerializer, UserProfileUpdateSerializer, PetSerializer, PetCreateSerializer
from apps.profiles.models import UserProfile, Pet
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
