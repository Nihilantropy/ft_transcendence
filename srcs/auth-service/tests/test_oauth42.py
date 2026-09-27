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


@pytest.mark.django_db
class TestSetPassword:
    """PUT /change-password without current_password, only for an account that has no password"""

    ENDPOINT = '/api/v1/auth/change-password'
    BODY = {'new_password': 'Fresh-pass-42', 'new_password_confirm': 'Fresh-pass-42'}

    def put(self, client, body):
        return client.put(self.ENDPOINT, data=body, content_type='application/json')

    def test_sets_the_first_password(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), self.BODY)

        assert response.status_code == 200, response.json()
        oauth_user.refresh_from_db()
        assert oauth_user.check_password('Fresh-pass-42')
        assert response.cookies['access_token'].value

    def test_revokes_the_other_sessions(self, client, oauth_user):
        session = RefreshToken.objects.create(user=oauth_user, token_hash='h', expires_at=oauth_user.created_at)

        self.put(signed_in(client, oauth_user), self.BODY)

        session.refresh_from_db()
        assert session.is_revoked is True

    def test_a_sent_current_password_is_ignored(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), {**self.BODY, 'current_password': 'whatever'})

        assert response.status_code == 200, response.json()

    def test_the_new_password_is_still_validated(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), {'new_password': 'short', 'new_password_confirm': 'short'})

        assert response.status_code == 422
        assert 'new_password' in response.json()['error']['details']

    def test_an_account_with_a_password_still_needs_it(self, authenticated_client):
        response = self.put(authenticated_client, self.BODY)

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']

    def test_then_email_and_password_login_works(self, client, oauth_user):
        self.put(signed_in(client, oauth_user), self.BODY)

        response = client.post('/api/v1/auth/login', data={
            'email': 'marvin@student.42.fr', 'password': 'Fresh-pass-42'}, content_type='application/json')

        assert response.status_code == 200, response.json()
        assert response.json()['data']['user']['has_password'] is True

    def test_no_password_never_logs_in_with_one(self, client, oauth_user):
        response = client.post('/api/v1/auth/login', data={
            'email': 'marvin@student.42.fr', 'password': 'anything123'}, content_type='application/json')

        assert response.status_code == 401

    def test_turning_on_two_factor_needs_a_password_first(self, client, oauth_user):
        response = signed_in(client, oauth_user).post(
            '/api/v1/auth/2fa/enable', data={'current_password': 'anything123', 'code': '123456'},
            content_type='application/json')

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']

    def test_changing_the_email_needs_a_password_first(self, client, oauth_user):
        response = signed_in(client, oauth_user).patch(
            '/api/v1/auth/me', data={'email': 'new@example.com', 'current_password': 'anything123'},
            content_type='application/json')

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']
