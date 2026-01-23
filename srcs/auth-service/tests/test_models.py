import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from datetime import timedelta
from django.utils import timezone

User = get_user_model()

@pytest.mark.django_db
class TestUserModel:
    def test_create_user_with_email(self):
        """Test creating a user with email"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        assert user.email == 'test@example.com'
        assert user.check_password('testpass123')
        assert user.is_active is True
        assert user.is_verified is True
        assert user.role == User.ROLE_USER
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_create_user_with_names(self):
        """Test creating user with first and last name"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe'
        )

        assert user.first_name == 'John'
        assert user.last_name == 'Doe'

    def test_email_normalized(self):
        """Test email is normalized (lowercased)"""
        user = User.objects.create_user(
            email='Test@EXAMPLE.com',
            password='testpass123'
        )

        assert user.email == 'test@example.com'

    def test_email_unique(self):
        """Test email must be unique"""
        User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        with pytest.raises(IntegrityError):
            User.objects.create_user(
                email='test@example.com',
                password='anotherpass'
            )

    def test_create_superuser(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123'
        )

        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.role == User.ROLE_ADMIN


from apps.authentication.models import RefreshToken

@pytest.mark.django_db
class TestRefreshTokenModel:
    def test_create_refresh_token(self):
        """Test creating a refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        expires_at = timezone.now() + timedelta(days=7)
        token = RefreshToken.objects.create(
            user=user,
            token_hash='abc123hash',
            expires_at=expires_at
        )

        assert token.user == user
        assert token.token_hash == 'abc123hash'
        assert token.expires_at == expires_at
        assert token.is_revoked is False
        assert token.last_used_at is None

    def test_refresh_token_user_relationship(self):
        """Test refresh token has foreign key to user"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token1 = RefreshToken.objects.create(
            user=user,
            token_hash='hash1',
            expires_at=timezone.now() + timedelta(days=7)
        )
        token2 = RefreshToken.objects.create(
            user=user,
            token_hash='hash2',
            expires_at=timezone.now() + timedelta(days=7)
        )

        assert user.refresh_tokens.count() == 2
        assert token1 in user.refresh_tokens.all()
        assert token2 in user.refresh_tokens.all()

    def test_refresh_token_hash_unique(self):
        """Test token_hash must be unique"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        RefreshToken.objects.create(
            user=user,
            token_hash='samehash',
            expires_at=timezone.now() + timedelta(days=7)
        )

        with pytest.raises(IntegrityError):
            RefreshToken.objects.create(
                user=user,
                token_hash='samehash',
                expires_at=timezone.now() + timedelta(days=7)
            )

    def test_revoke_token(self):
        """Test revoking a refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token = RefreshToken.objects.create(
            user=user,
            token_hash='hash123',
            expires_at=timezone.now() + timedelta(days=7)
        )

        token.is_revoked = True
        token.save()

        token.refresh_from_db()
        assert token.is_revoked is True
