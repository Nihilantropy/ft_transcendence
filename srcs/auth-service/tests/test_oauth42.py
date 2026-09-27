"""
Log in with 42 (OAuth 2.0 authorization code grant against the 42 intra) and what it implies for
accounts without a password. The intra is never contacted: httpx.post / httpx.get are patched.
"""
from types import SimpleNamespace
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from django.db import IntegrityError, transaction

from apps.authentication import two_factor
from apps.authentication.jwt_utils import decode_token, generate_access_token
from apps.authentication.models import OAuthAccount, RefreshToken, User


@pytest.fixture
def oauth_user():
    """An account created through 42: linked, no usable password"""
    user = User.objects.create_user(email='marvin@student.42.fr', first_name='Marvin')
    OAuthAccount.objects.create(provider='42', provider_user_id='4242', user=user)
    return user


def signed_in(client, user):
    client.cookies['access_token'] = generate_access_token(user)
    return client


@pytest.mark.django_db
class TestOAuthAccountModel:
    def test_one_link_per_remote_identity(self, oauth_user, user):
        with pytest.raises(IntegrityError), transaction.atomic():
            OAuthAccount.objects.create(provider='42', provider_user_id='4242', user=user)

    def test_same_remote_id_on_another_provider_is_a_different_identity(self, oauth_user):
        OAuthAccount.objects.create(provider='github', provider_user_id='4242', user=oauth_user)

        assert oauth_user.oauth_accounts.count() == 2

    def test_deleting_the_user_deletes_the_link(self, oauth_user):
        oauth_user.delete()

        assert not OAuthAccount.objects.exists()

    def test_created_without_a_password(self, oauth_user):
        assert oauth_user.has_usable_password() is False
