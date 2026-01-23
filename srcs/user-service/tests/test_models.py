import pytest
import uuid
from apps.profiles.models import UserProfile, Pet


@pytest.mark.django_db
class TestUserProfileModel:
    def test_create_user_profile_with_user_id(self):
        """Test creating a user profile with user_id"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(user_id=user_id)

        assert profile.id is not None
        assert profile.user_id == user_id
        assert profile.phone == ''
        assert profile.address is None
        assert profile.preferences == {}
        assert profile.created_at is not None
        assert profile.updated_at is not None

    def test_user_profile_user_id_unique(self):
        """Test that user_id must be unique"""
        user_id = uuid.uuid4()
        UserProfile.objects.create(user_id=user_id)

        with pytest.raises(Exception):  # IntegrityError
            UserProfile.objects.create(user_id=user_id)

    def test_user_profile_with_all_fields(self):
        """Test creating profile with all fields"""
        user_id = uuid.uuid4()
        address = {'city': 'San Francisco', 'country': 'USA'}
        preferences = {'theme': 'dark', 'notifications': True}

        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890',
            address=address,
            preferences=preferences
        )

        assert profile.phone == '+1234567890'
        assert profile.address == address
        assert profile.preferences == preferences

    def test_user_profile_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(user_id=user_id)

        assert str(profile) == f"Profile for {user_id}"


@pytest.mark.django_db
class TestPetModel:
    def test_create_pet_with_required_fields(self):
        """Test creating pet with minimum required fields"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id,
            name='Buddy',
            species='dog'
        )

        assert pet.id is not None
        assert pet.user_id == user_id
        assert pet.name == 'Buddy'
        assert pet.species == 'dog'
        assert pet.breed == ''
        assert pet.breed_confidence is None
        assert pet.age is None
        assert pet.weight is None
        assert pet.health_conditions == []
        assert pet.image_url is None

    def test_create_pet_with_all_fields(self):
        """Test creating pet with all fields"""
        user_id = uuid.uuid4()
        health_conditions = ['hip dysplasia', 'allergies']

        pet = Pet.objects.create(
            user_id=user_id,
            name='Max',
            breed='Golden Retriever',
            breed_confidence=0.95,
            species='dog',
            age=24,
            weight=30.5,
            health_conditions=health_conditions,
            image_url='/media/pets/test.jpg'
        )

        assert pet.breed == 'Golden Retriever'
        assert pet.breed_confidence == 0.95
        assert pet.age == 24
        assert pet.weight == 30.5
        assert pet.health_conditions == health_conditions
        assert pet.image_url == '/media/pets/test.jpg'

    def test_pet_species_choices(self):
        """Test species field accepts valid choices"""
        user_id = uuid.uuid4()

        dog = Pet.objects.create(user_id=user_id, name='Dog', species='dog')
        cat = Pet.objects.create(user_id=user_id, name='Cat', species='cat')
        other = Pet.objects.create(user_id=user_id, name='Other', species='other')

        assert dog.species == 'dog'
        assert cat.species == 'cat'
        assert other.species == 'other'

    def test_pet_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(user_id=user_id, name='Buddy', species='dog')

        assert str(pet) == 'Buddy (dog)'
