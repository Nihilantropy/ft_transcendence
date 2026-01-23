import pytest
from apps.profiles.serializers import UserProfileSerializer, UserProfileUpdateSerializer
from apps.profiles.models import UserProfile
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
