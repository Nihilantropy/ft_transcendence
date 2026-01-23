import pytest
import uuid
from apps.profiles.models import UserProfile, Pet, PetAnalysis


@pytest.fixture
def user_id():
    """UUID for test user (simulates auth-service user)"""
    return uuid.uuid4()


@pytest.fixture
def admin_user_id():
    """UUID for admin user"""
    return uuid.uuid4()


@pytest.fixture
@pytest.mark.django_db
def user_profile(user_id):
    """Create test user profile"""
    return UserProfile.objects.create(
        user_id=user_id,
        phone='+1234567890',
        address={'city': 'San Francisco', 'country': 'USA'},
        preferences={'theme': 'dark'}
    )


@pytest.fixture
@pytest.mark.django_db
def pet(user_id):
    """Create test pet"""
    return Pet.objects.create(
        user_id=user_id,
        name='Buddy',
        species='dog',
        breed='Golden Retriever',
        breed_confidence=0.95,
        age=24,
        weight=30.5
    )


@pytest.fixture
@pytest.mark.django_db
def pet_analysis(user_id, pet):
    """Create test pet analysis"""
    return PetAnalysis.objects.create(
        pet_id=pet.id,
        user_id=user_id,
        image_url='/media/test.jpg',
        breed_detected='Golden Retriever',
        confidence=0.95,
        traits={'size': 'large', 'energy': 'high'}
    )
