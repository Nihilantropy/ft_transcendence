import pytest
import uuid
from apps.profiles.models import UserProfile


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
