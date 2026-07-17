"""
Tests for authentication views
"""
import json
import pytest
from datetime import timedelta
from django.test import Client
from django.conf import settings
from django.utils import timezone
from apps.authentication.models import User, RefreshToken
from apps.authentication.jwt_utils import decode_token, hash_token, generate_refresh_token, generate_access_token


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
                'password_confirm': 'Password123',
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
        """Successful registration with only email, password, and password_confirm returns 201"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'minimal@example.com',
                'password': 'Password123',
                'password_confirm': 'Password123'
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
                'password': 'Password123',
                'password_confirm': 'Password123'
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
            data={
                'password': 'Password123',
                'password_confirm': 'Password123'
            },
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
            data={
                'email': 'test@example.com',
                'password_confirm': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_missing_password_confirm_returns_422(self, client):
        """Missing password_confirm returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_register_with_mismatched_passwords_returns_422(self, client):
        """Mismatched password and password_confirm returns 422 VALIDATION_ERROR"""
        response = client.post(
            '/api/v1/auth/register',
            data={
                'email': 'newuser@example.com',
                'password': 'Password123',
                'password_confirm': 'Different456'
            },
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
                'password': 'Password123',
                'password_confirm': 'Password123'
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
                'password': 'Pass1',  # Only 5 chars, needs 8
                'password_confirm': 'Pass1'
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
                'password': '12345678',  # No letters
                'password_confirm': '12345678'
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
                'password': 'abcdefgh',  # No numbers
                'password_confirm': 'abcdefgh'
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
                'password': 'Password123',
                'password_confirm': 'Password123'
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
                'password': 'Password123',
                'password_confirm': 'Password123'
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
                'password_confirm': 'Password123',
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
                'password': 'Password123',
                'password_confirm': 'Password123'
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
                'password': 'Password123',
                'password_confirm': 'Password123'
            },
            content_type='application/json'
        )

        assert response.status_code == 409
        data = response.json()
        assert data['error']['code'] == 'EMAIL_ALREADY_EXISTS'


@pytest.mark.django_db
class TestRefreshView:
    """Tests for POST /api/v1/auth/refresh"""

    @pytest.fixture
    def user_with_refresh_token(self, user):
        """Create a user with a valid refresh token and return (user, token_cookie_value)"""
        # Create refresh token record
        refresh_token_record = RefreshToken.objects.create(
            user=user,
            token_hash='placeholder',
            expires_at=timezone.now() + timedelta(days=7)
        )
        # Generate the actual token
        token = generate_refresh_token(user, refresh_token_record.id)
        # Update hash
        refresh_token_record.token_hash = hash_token(token)
        refresh_token_record.save(update_fields=['token_hash'])
        return user, token, refresh_token_record

    def test_refresh_with_valid_token_returns_200(self, client, user_with_refresh_token):
        """Successful refresh returns 200 with user data"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['user']['email'] == user.email
        assert data['data']['user']['id'] == str(user.id)

    def test_refresh_sets_new_access_token_cookie(self, client, user_with_refresh_token):
        """Successful refresh sets new access_token cookie"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie['httponly'] is True

        # Verify token is valid JWT for the user
        new_token = cookie.value
        payload = decode_token(new_token)
        assert payload['user_id'] == str(user.id)
        assert payload['token_type'] == 'access'

    def test_refresh_sets_new_refresh_token_cookie(self, client, user_with_refresh_token):
        """Successful refresh sets new refresh_token cookie (rotation)"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert 'refresh_token' in response.cookies
        cookie = response.cookies['refresh_token']
        assert cookie['httponly'] is True
        assert cookie['path'] == '/api/v1/auth/refresh'

        # Verify new token is different from old token
        new_token = cookie.value
        assert new_token != token

        # Verify token is valid JWT for the user
        payload = decode_token(new_token)
        assert payload['user_id'] == str(user.id)
        assert payload['token_type'] == 'refresh'

    def test_refresh_creates_new_refresh_token_record(self, client, user_with_refresh_token):
        """Successful refresh creates new RefreshToken in database"""
        user, token, old_record = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 200
        # Should have one new active token (old one revoked)
        active_tokens = RefreshToken.objects.filter(user=user, is_revoked=False)
        assert active_tokens.count() == 1
        # The active token should be different from the old one
        assert active_tokens.first().id != old_record.id

    def test_refresh_revokes_old_token(self, client, user_with_refresh_token):
        """Successful refresh revokes the old RefreshToken (rotation)"""
        user, token, old_record = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 200
        old_record.refresh_from_db()
        assert old_record.is_revoked is True

    def test_refresh_without_cookie_returns_401(self, client):
        """Missing refresh_token cookie returns 401 MISSING_TOKEN"""
        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'MISSING_TOKEN'
        assert data['error']['message'] == 'Refresh token is required'

    def test_refresh_with_invalid_jwt_returns_401(self, client):
        """Invalid/malformed JWT returns 401 INVALID_TOKEN"""
        client.cookies['refresh_token'] = 'not-a-valid-jwt'

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_TOKEN'
        assert data['error']['message'] == 'Invalid refresh token'

    def test_refresh_with_expired_jwt_returns_401(self, client, user):
        """Expired JWT returns 401 TOKEN_EXPIRED"""
        # Create an expired refresh token record
        refresh_token_record = RefreshToken.objects.create(
            user=user,
            token_hash='placeholder',
            expires_at=timezone.now() - timedelta(days=1)  # Already expired
        )
        # Generate token (the JWT itself will have exp in past too)
        # We need to create a token with exp in the past - use a workaround
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(refresh_token_record.id),
            'token_type': 'refresh',
            'iat': int((timezone.now() - timedelta(days=8)).timestamp()),
            'exp': int((timezone.now() - timedelta(days=1)).timestamp())  # Expired
        }
        expired_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)
        refresh_token_record.token_hash = hash_token(expired_token)
        refresh_token_record.save(update_fields=['token_hash'])

        client.cookies['refresh_token'] = expired_token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'TOKEN_EXPIRED'
        assert data['error']['message'] == 'Refresh token has expired'

    def test_refresh_with_token_not_in_database_returns_401(self, client, user):
        """Token not found in database returns 401 INVALID_TOKEN"""
        import uuid
        # Generate a valid JWT but with a non-existent token_id
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(uuid.uuid4()),  # Non-existent ID
            'token_type': 'refresh',
            'iat': int(timezone.now().timestamp()),
            'exp': int((timezone.now() + timedelta(days=7)).timestamp())
        }
        fake_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)

        client.cookies['refresh_token'] = fake_token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_TOKEN'
        assert data['error']['message'] == 'Invalid refresh token'

    def test_refresh_with_revoked_token_returns_401(self, client, user_with_refresh_token):
        """Already revoked token returns 401 TOKEN_REVOKED"""
        user, token, record = user_with_refresh_token
        # Revoke the token
        record.is_revoked = True
        record.save(update_fields=['is_revoked'])

        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'TOKEN_REVOKED'
        assert data['error']['message'] == 'Refresh token has been revoked'

    def test_refresh_with_deleted_user_returns_401(self, client, user_with_refresh_token):
        """Token for deleted user returns 401 INVALID_TOKEN"""
        user, token, _ = user_with_refresh_token
        user_id = user.id
        # Delete the user
        user.delete()

        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_TOKEN'
        assert data['error']['message'] == 'Invalid refresh token'

    def test_refresh_with_disabled_user_returns_403(self, client, user_with_refresh_token):
        """Token for disabled user returns 403 ACCOUNT_DISABLED"""
        user, token, _ = user_with_refresh_token
        # Disable the user
        user.is_active = False
        user.save(update_fields=['is_active'])

        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 403
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'ACCOUNT_DISABLED'
        assert data['error']['message'] == 'Account is disabled'

    def test_refresh_with_access_token_returns_401(self, client, user):
        """Using access token as refresh token returns 401 INVALID_TOKEN"""
        # Generate an access token instead of refresh token
        access_token = generate_access_token(user)

        client.cookies['refresh_token'] = access_token

        response = client.post('/api/v1/auth/refresh')

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'INVALID_TOKEN'
        assert data['error']['message'] == 'Invalid refresh token'


@pytest.mark.django_db
class TestLogoutView:
    """Tests for POST /api/v1/auth/logout"""

    @pytest.fixture
    def user_with_refresh_token(self, user):
        """Create a user with a valid refresh token and return (user, token_cookie_value)"""
        refresh_token_record = RefreshToken.objects.create(
            user=user,
            token_hash='placeholder',
            expires_at=timezone.now() + timedelta(days=7)
        )
        token = generate_refresh_token(user, refresh_token_record.id)
        refresh_token_record.token_hash = hash_token(token)
        refresh_token_record.save(update_fields=['token_hash'])
        return user, token, refresh_token_record

    def test_logout_with_valid_token_returns_200(self, client, user_with_refresh_token):
        """Successful logout returns 200 with success message"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['message'] == 'Successfully logged out'

    def test_logout_revokes_refresh_token(self, client, user_with_refresh_token):
        """Logout revokes the refresh token in database"""
        user, token, record = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        record.refresh_from_db()
        assert record.is_revoked is True

    def test_logout_clears_access_token_cookie(self, client, user_with_refresh_token):
        """Logout clears the access_token cookie"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie.value == ''
        assert cookie['max-age'] == 0

    def test_logout_clears_refresh_token_cookie(self, client, user_with_refresh_token):
        """Logout clears the refresh_token cookie"""
        user, token, _ = user_with_refresh_token
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert 'refresh_token' in response.cookies
        cookie = response.cookies['refresh_token']
        assert cookie.value == ''
        assert cookie['max-age'] == 0
        assert cookie['path'] == '/api/v1/auth/refresh'

    def test_logout_without_cookie_still_succeeds(self, client):
        """Logout without refresh_token cookie still returns 200"""
        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['message'] == 'Successfully logged out'

    def test_logout_with_invalid_jwt_still_succeeds(self, client):
        """Logout with invalid JWT still returns 200 and clears cookies"""
        client.cookies['refresh_token'] = 'not-a-valid-jwt'

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        # Cookies should still be cleared
        assert response.cookies['access_token'].value == ''
        assert response.cookies['refresh_token'].value == ''

    def test_logout_with_expired_jwt_still_succeeds(self, client, user):
        """Logout with expired JWT still returns 200"""
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(user.id),  # Fake token_id
            'token_type': 'refresh',
            'iat': int((timezone.now() - timedelta(days=8)).timestamp()),
            'exp': int((timezone.now() - timedelta(days=1)).timestamp())
        }
        expired_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)
        client.cookies['refresh_token'] = expired_token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

    def test_logout_with_revoked_token_still_succeeds(self, client, user_with_refresh_token):
        """Logout with already-revoked token still returns 200"""
        user, token, record = user_with_refresh_token
        record.is_revoked = True
        record.save(update_fields=['is_revoked'])
        client.cookies['refresh_token'] = token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

    def test_logout_with_token_not_in_database_still_succeeds(self, client, user):
        """Logout with token not in database still returns 200"""
        import uuid
        import jwt
        from django.conf import settings as s
        payload = {
            'user_id': str(user.id),
            'token_id': str(uuid.uuid4()),  # Non-existent ID
            'token_type': 'refresh',
            'iat': int(timezone.now().timestamp()),
            'exp': int((timezone.now() + timedelta(days=7)).timestamp())
        }
        fake_token = jwt.encode(payload, s.JWT_KEYS['private'], algorithm=s.JWT_ALGORITHM)
        client.cookies['refresh_token'] = fake_token

        response = client.post('/api/v1/auth/logout')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True


@pytest.mark.django_db
class TestChangePasswordView:
    """Tests for PUT /api/v1/auth/change-password"""

    ENDPOINT = '/api/v1/auth/change-password'

    @pytest.fixture
    def authenticated_client(self, client, user, user_data):
        """Client with a valid access_token cookie"""
        access_token = generate_access_token(user)
        client.cookies['access_token'] = access_token
        return client

    def test_change_password_with_valid_data_returns_200(self, authenticated_client, user, user_data):
        """Successful password change returns 200"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'password changed' in data['data']['message'].lower()

    def test_change_password_updates_password_in_database(self, authenticated_client, user, user_data):
        """Password is actually updated in the database"""
        authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        user.refresh_from_db()
        assert user.check_password('newSecure456') is True
        assert user.check_password(user_data['password']) is False

    def test_change_password_revokes_all_refresh_tokens(self, authenticated_client, user, user_data):
        """All existing refresh tokens are revoked after password change"""
        # Create some refresh tokens
        for i in range(3):
            RefreshToken.objects.create(
                user=user,
                token_hash=f'hash_{i}',
                expires_at=timezone.now() + timedelta(days=7)
            )
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 3

        authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        # All old tokens revoked, only the freshly issued one remains active
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_change_password_issues_new_tokens(self, authenticated_client, user, user_data):
        """New access and refresh tokens are issued after password change"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        # New access token cookie
        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie['httponly'] is True
        payload = decode_token(cookie.value)
        assert payload['user_id'] == str(user.id)
        assert payload['token_type'] == 'access'

        # New refresh token cookie
        assert 'refresh_token' in response.cookies
        refresh_cookie = response.cookies['refresh_token']
        assert refresh_cookie['httponly'] is True
        assert refresh_cookie['path'] == '/api/v1/auth/refresh'

    def test_change_password_with_wrong_current_password_returns_422(self, authenticated_client, user):
        """Wrong current password returns 422"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': 'wrongpassword123',
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_change_password_with_mismatched_passwords_returns_422(self, authenticated_client, user, user_data):
        """Mismatched new passwords returns 422"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'differentPass789'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_change_password_with_weak_new_password_returns_422(self, authenticated_client, user, user_data):
        """Weak new password returns 422"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'weak',
                'new_password_confirm': 'weak'
            },
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_change_password_with_missing_fields_returns_422(self, authenticated_client, user):
        """Missing required fields returns 422"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={},
            content_type='application/json'
        )

        assert response.status_code == 422
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_change_password_without_access_token_returns_401(self, client):
        """No access token returns 401"""
        response = client.put(
            self.ENDPOINT,
            data={
                'current_password': 'oldpass123',
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        assert response.status_code == 401
        data = response.json()
        assert data['success'] is False
        assert data['error']['code'] == 'UNAUTHORIZED'

    def test_change_password_with_expired_token_returns_401(self, client, user):
        """Expired access token returns 401"""
        import jwt as pyjwt
        payload = {
            'user_id': str(user.id),
            'email': user.email,
            'role': user.role,
            'token_type': 'access',
            'iat': int((timezone.now() - timedelta(hours=1)).timestamp()),
            'exp': int((timezone.now() - timedelta(minutes=1)).timestamp())
        }
        expired_token = pyjwt.encode(payload, settings.JWT_KEYS['private'], algorithm=settings.JWT_ALGORITHM)
        client.cookies['access_token'] = expired_token

        response = client.put(
            self.ENDPOINT,
            data={
                'current_password': 'testpass123',
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        assert response.status_code == 401
        data = response.json()
        assert data['error']['code'] == 'TOKEN_EXPIRED'

    def test_change_password_with_disabled_account_returns_403(self, client, user_data):
        """Disabled account returns 403"""
        disabled_user = User.objects.create_user(
            email='disabled@example.com',
            password='password123',
            is_active=False
        )
        access_token = generate_access_token(disabled_user)
        client.cookies['access_token'] = access_token

        response = client.put(
            self.ENDPOINT,
            data={
                'current_password': 'password123',
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        assert response.status_code == 403
        data = response.json()
        assert data['error']['code'] == 'ACCOUNT_DISABLED'

    def test_change_password_does_not_leak_password(self, authenticated_client, user, user_data):
        """Response never contains password fields"""
        response = authenticated_client.put(
            self.ENDPOINT,
            data={
                'current_password': user_data['password'],
                'new_password': 'newSecure456',
                'new_password_confirm': 'newSecure456'
            },
            content_type='application/json'
        )

        response_text = json.dumps(response.json())
        assert 'newSecure456' not in response_text
        assert user_data['password'] not in response_text
