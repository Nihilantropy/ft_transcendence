import pytest
from apps.authentication.serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer
)
from apps.authentication.models import User

@pytest.mark.django_db
class TestUserSerializer:
    def test_user_serializer_output(self):
        """Test UserSerializer returns correct fields"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe',
            role='user'
        )

        serializer = UserSerializer(user)
        data = serializer.data

        assert data['id'] == str(user.id)
        assert data['email'] == 'test@example.com'
        assert data['first_name'] == 'John'
        assert data['last_name'] == 'Doe'
        assert data['role'] == 'user'
        assert data['is_verified'] is True
        assert 'password' not in data  # Password should never be serialized

@pytest.mark.django_db
class TestRegisterSerializer:
    def test_register_serializer_valid_data(self):
        """Test RegisterSerializer with valid data"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'first_name': 'John',
            'last_name': 'Doe'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

    def test_register_serializer_invalid_email(self):
        """Test RegisterSerializer rejects invalid email"""
        data = {
            'email': 'invalid-email',
            'password': 'password123'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_register_serializer_weak_password(self):
        """Test RegisterSerializer rejects weak password"""
        data = {
            'email': 'test@example.com',
            'password': 'weak'  # Too short
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_register_serializer_password_without_letter(self):
        """Test RegisterSerializer rejects password without letter"""
        data = {
            'email': 'test@example.com',
            'password': '12345678'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_register_serializer_creates_user(self):
        """Test RegisterSerializer creates user with hashed password"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'first_name': 'John'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

        user = serializer.save()

        assert user.email == 'test@example.com'
        assert user.first_name == 'John'
        assert user.check_password('password123')
        assert not user.check_password('wrongpassword')

class TestLoginSerializer:
    def test_login_serializer_valid_data(self):
        """Test LoginSerializer with valid format"""
        data = {
            'email': 'test@example.com',
            'password': 'password123'
        }

        serializer = LoginSerializer(data=data)
        assert serializer.is_valid()

    def test_login_serializer_missing_email(self):
        """Test LoginSerializer requires email"""
        data = {
            'password': 'password123'
        }

        serializer = LoginSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_login_serializer_missing_password(self):
        """Test LoginSerializer requires password"""
        data = {
            'email': 'test@example.com'
        }

        serializer = LoginSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors
