"""
Tests for authentication views
"""
import pytest
from django.test import Client
from django.conf import settings
from apps.authentication.models import User, RefreshToken
from apps.authentication.jwt_utils import decode_token, hash_token


@pytest.fixture
def client():
    """Django test client"""
    return Client()


@pytest.fixture
def user_data():
    """Standard test user data"""
    return {
        'email': 'test@example.com',
        'password': 'testpass123',
        'first_name': 'Test',
        'last_name': 'User'
    }


@pytest.fixture
def user(user_data):
    """Create a test user"""
    return User.objects.create_user(
        email=user_data['email'],
        password=user_data['password'],
        first_name=user_data['first_name'],
        last_name=user_data['last_name']
    )


@pytest.mark.django_db
class TestLoginView:
    """Tests for POST /api/v1/auth/login"""

    def test_login_with_valid_credentials_returns_200(self, client, user, user_data):
        """Successful login returns 200 with user data"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['user']['email'] == user_data['email']
        assert data['data']['user']['first_name'] == user_data['first_name']
        assert data['data']['user']['last_name'] == user_data['last_name']
        assert data['data']['user']['role'] == 'user'
        assert 'password' not in data['data']['user']

    def test_login_sets_access_token_cookie(self, client, user, user_data):
        """Successful login sets HTTP-only access_token cookie"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )

        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie['httponly'] is True
        assert cookie['samesite'] == settings.COOKIE_SAMESITE

        # Verify token is valid JWT
        token = cookie.value
        payload = decode_token(token)
        assert payload['user_id'] == str(user.id)
        assert payload['token_type'] == 'access'

    def test_login_sets_refresh_token_cookie(self, client, user, user_data):
        """Successful login sets HTTP-only refresh_token cookie"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )

        assert 'refresh_token' in response.cookies
        cookie = response.cookies['refresh_token']
        assert cookie['httponly'] is True
        assert cookie['path'] == '/api/v1/auth/refresh'

        # Verify token is valid JWT
        token = cookie.value
        payload = decode_token(token)
        assert payload['user_id'] == str(user.id)
        assert payload['token_type'] == 'refresh'

    def test_login_creates_refresh_token_record(self, client, user, user_data):
        """Successful login creates RefreshToken in database"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )

        assert response.status_code == 200
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_login_revokes_previous_refresh_tokens(self, client, user, user_data):
        """Login revokes all previous refresh tokens (single session policy)"""
        # First login
        client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )
        first_token = RefreshToken.objects.filter(user=user, is_revoked=False).first()

        # Second login
        client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': user_data['password']},
            content_type='application/json'
        )

        # First token should be revoked
        first_token.refresh_from_db()
        assert first_token.is_revoked is True

        # Only one active token
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_login_with_invalid_email_format_returns_422(self, client):
        """Invalid email format returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': 'not-an-email', 'password': 'password123'},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_login_with_missing_email_returns_422(self, client):
        """Missing email returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/login',
            data={'password': 'password123'},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_login_with_missing_password_returns_422(self, client):
        """Missing password returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': 'test@example.com'},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_login_with_nonexistent_user_returns_401(self, client):
        """Non-existent user returns 401 INVALID_CREDENTIALS"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': 'nonexistent@example.com', 'password': 'password123'},
            content_type='application/json'
        )

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_CREDENTIALS'
        assert data['error']['message'] == 'Invalid email or password'

    def test_login_with_wrong_password_returns_401(self, client, user, user_data):
        """Wrong password returns 401 INVALID_CREDENTIALS"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'], 'password': 'wrongpassword'},
            content_type='application/json'
        )

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_CREDENTIALS'
        assert data['error']['message'] == 'Invalid email or password'

    def test_login_with_disabled_account_returns_403(self, client, user_data):
        """Disabled account returns 403 ACCOUNT_DISABLED"""
        # Create disabled user
        disabled_user = User.objects.create_user(
            email='disabled@example.com',
            password='password123',
            is_active=False
        )

        response = client.post(
            '/api/v1/auth/login',
            data={'email': 'disabled@example.com', 'password': 'password123'},
            content_type='application/json'
        )

        assert response.status_code == 403
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'ACCOUNT_DISABLED'
        assert data['error']['message'] == 'Account is disabled'

    def test_login_email_is_case_insensitive(self, client, user, user_data):
        """Login works with different email casing"""
        response = client.post(
            '/api/v1/auth/login',
            data={'email': user_data['email'].upper(), 'password': user_data['password']},
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True


@pytest.mark.django_db
class TestRegisterView:
    """Tests for POST /api/v1/auth/register"""

    def test_register_with_all_fields_returns_201(self, client):
        """Successful registration with all fields returns 201"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123',
                'first_name': 'John',
                'last_name': 'Doe'
            },
            content_type='application/json'
        )

        assert response.status_code == 201
        data = response.json()
        assert data['success'] is True
        assert data['data']['user']['email'] == 'newuser@example.com'
        assert data['data']['user']['first_name'] == 'John'
        assert data['data']['user']['last_name'] == 'Doe'
        assert data['data']['user']['role'] == 'user'
        assert data['data']['user']['is_verified'] is True
        assert 'password' not in data['data']['user']

    def test_register_with_only_required_fields_returns_201(self, client):
        """Successful registration with only email and password returns 201"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'minimal@example.com',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 201
        data = response.json()
        assert data['success'] is True
        assert data['data']['user']['email'] == 'minimal@example.com'
        assert data['data']['user']['first_name'] == ''
        assert data['data']['user']['last_name'] == ''

    def test_register_with_invalid_email_format_returns_422(self, client):
        """Invalid email format returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'not-an-email',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_missing_email_returns_422(self, client):
        """Missing email returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={'password': 'Password123'},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_missing_password_returns_422(self, client):
        """Missing password returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={'email': 'test@example.com'},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_duplicate_email_returns_409(self, client, user):
        """Duplicate email returns 409 EMAIL_ALREADY_EXISTS"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'test@example.com',  # Same as fixture user
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 409
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'EMAIL_ALREADY_EXISTS'
        assert data['error']['message'] == 'A user with this email already exists'

    def test_register_with_password_too_short_returns_422(self, client):
        """Password too short returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Pass1'  # Only 5 chars, needs 8
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_password_missing_letter_returns_422(self, client):
        """Password without letter returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': '12345678'  # No letters
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_password_missing_number_returns_422(self, client):
        """Password without number returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'abcdefgh'  # No numbers
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_sets_access_token_cookie(self, client):
        """Successful registration sets HTTP-only access_token cookie"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie['httponly'] is True
        assert cookie['samesite'] == settings.COOKIE_SAMESITE

        # Verify token is valid JWT
        token = cookie.value
        payload = decode_token(token)
        assert payload['token_type'] == 'access'

    def test_register_sets_refresh_token_cookie(self, client):
        """Successful registration sets HTTP-only refresh_token cookie"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert 'refresh_token' in response.cookies
        cookie = response.cookies['refresh_token']
        assert cookie['httponly'] is True
        assert cookie['path'] == '/api/v1/auth/refresh'

        # Verify token is valid JWT
        token = cookie.value
        payload = decode_token(token)
        assert payload['token_type'] == 'refresh'

    def test_register_creates_user_in_database(self, client):
        """Successful registration creates user in database"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123',
                'first_name': 'John',
                'last_name': 'Doe'
            },
            content_type='application/json'
        )

        assert response.status_code == 201
        user = User.objects.get(email='newuser@example.com')
        assert user.first_name == 'John'
        assert user.last_name == 'Doe'
        assert user.is_active is True
        assert user.check_password('Password123') is True

    def test_register_creates_refresh_token_record(self, client):
        """Successful registration creates RefreshToken in database"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 201
        user = User.objects.get(email='newuser@example.com')
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_register_email_is_case_insensitive(self, client, user):
        """Email uniqueness check is case-insensitive"""
        # Existing user has 'test@example.com'
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'TEST@EXAMPLE.COM',  # Same email, different case
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 409
        data = response.json()
        assert data['error']['code'] == 'EMAIL_ALREADY_EXISTS'
