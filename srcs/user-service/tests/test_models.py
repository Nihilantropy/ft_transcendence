import pytest
import uuid
from apps.profiles.models import UserProfile, Pet, PetAnalysis


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


@pytest.mark.django_db
class TestPetAnalysisModel:
    def test_create_pet_analysis(self):
        """Test creating pet analysis record"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        traits = {'size': 'large', 'energy': 'high'}

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/analysis/test.jpg',
            breed_detected='Golden Retriever',
            confidence=0.95,
            traits=traits
        )

        assert analysis.id is not None
        assert analysis.pet_id == pet_id
        assert analysis.user_id == user_id
        assert analysis.image_url == '/media/analysis/test.jpg'
        assert analysis.breed_detected == 'Golden Retriever'
        assert analysis.confidence == 0.95
        assert analysis.traits == traits
        assert analysis.raw_response is None
        assert analysis.created_at is not None

    def test_pet_analysis_with_raw_response(self):
        """Test analysis with full AI response"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        raw_response = {'model': 'qwen3-vl', 'full_output': '...'}

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/test.jpg',
            breed_detected='Labrador',
            confidence=0.88,
            traits={},
            raw_response=raw_response
        )

        assert analysis.raw_response == raw_response

    def test_pet_analysis_ordering(self):
        """Test that analyses are ordered by created_at descending"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        analysis1 = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='1.jpg',
            breed_detected='Breed1', confidence=0.9, traits={}
        )
        analysis2 = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='2.jpg',
            breed_detected='Breed2', confidence=0.8, traits={}
        )

        analyses = list(PetAnalysis.objects.all())
        assert analyses[0].id == analysis2.id  # Most recent first
        assert analyses[1].id == analysis1.id

    def test_pet_analysis_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='test.jpg',
            breed_detected='Beagle', confidence=0.92, traits={}
        )

        assert 'Beagle' in str(analysis)
        assert '0.92' in str(analysis)
