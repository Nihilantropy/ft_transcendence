"""
Shared fixtures for the auth-service test suite
"""
import pytest
from django.test import Client
from django.utils import timezone
from freezegun import freeze_time

from apps.authentication import two_factor
from apps.authentication.jwt_utils import generate_access_token
from apps.authentication.models import TwoFactorAuth, User


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


@pytest.fixture
def authenticated_client(client, user):
    """Client carrying a valid access_token cookie for `user`"""
    client.cookies['access_token'] = generate_access_token(user)
    return client


@pytest.fixture
def enable_two_factor():
    """Factory: switch 2FA on for a user, returns (base32_secret, recovery_codes)"""
    def _enable(target):
        secret = two_factor.generate_secret()
        TwoFactorAuth.objects.create(
            user=target,
            secret_encrypted=two_factor.encrypt_secret(secret),
            is_enabled=True,
            enabled_at=timezone.now(),
        )
        return secret, two_factor.generate_recovery_codes(target)
    return _enable


@pytest.fixture
def frozen_time():
    """
    Clock frozen at the current instant. Tokens minted before or after stay valid, and tests can
    `tick()` forward to move to the next TOTP step or past a lockout.
    """
    with freeze_time(timezone.now()) as frozen:
        yield frozen
