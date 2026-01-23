import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from apps.authentication.jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    decode_token,
    hash_token
)
from apps.authentication.models import User
import hashlib

@pytest.mark.django_db
class TestJWTUtilities:
    def test_generate_access_token(self):
        """Test generating access token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token = generate_access_token(user)

        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are long strings

    def test_decode_access_token(self):
        """Test decoding access token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe'
        )

        token = generate_access_token(user)
        payload = decode_token(token)

        assert payload['user_id'] == str(user.id)
        assert payload['email'] == 'test@example.com'
        assert payload['role'] == 'user'
        assert payload['token_type'] == 'access'
        assert 'iat' in payload
        assert 'exp' in payload

    def test_generate_refresh_token(self):
        """Test generating refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token_id = 'test-token-id-123'
        token = generate_refresh_token(user, token_id)

        assert isinstance(token, str)
        assert len(token) > 50

    def test_decode_refresh_token(self):
        """Test decoding refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token_id = 'test-token-id-123'
        token = generate_refresh_token(user, token_id)
        payload = decode_token(token)

        assert payload['user_id'] == str(user.id)
        assert payload['token_id'] == token_id
        assert payload['token_type'] == 'refresh'

    def test_decode_invalid_token_fails(self):
        """Test decoding invalid token raises exception"""
        with pytest.raises(Exception):
            decode_token('invalid.token.here')

    def test_hash_token(self):
        """Test token hashing produces consistent SHA256 hash"""
        token = 'test-token-string'
        hashed = hash_token(token)

        # SHA256 produces 64 character hex string
        assert len(hashed) == 64
        assert isinstance(hashed, str)

        # Same input produces same hash
        assert hash_token(token) == hashed

        # Verify it's actually SHA256
        expected = hashlib.sha256(token.encode()).hexdigest()
        assert hashed == expected
