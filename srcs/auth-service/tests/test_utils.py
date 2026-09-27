"""
Tests for the request helpers shared by the authenticated views:
get_authenticated_user (cookie -> JWT -> user) and parse_json_body
"""
import json
from datetime import timedelta

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.conf import settings
from django.test import RequestFactory
from django.utils import timezone
from freezegun import freeze_time

from apps.authentication.jwt_utils import generate_access_token, generate_mfa_token, generate_refresh_token
from apps.authentication.models import RefreshToken
from apps.authentication.utils import get_authenticated_user, parse_json_body


def request_with_token(token=None):
    request = RequestFactory().get('/anything')
    if token is not None:
        request.COOKIES['access_token'] = token
    return request


def assert_rejected(result, status, code):
    user, error = result
    assert user is None
    assert error.status_code == status
    assert error.data['success'] is False
    assert error.data['error']['code'] == code


@pytest.mark.django_db
class TestGetAuthenticatedUser:
    def test_valid_access_token_returns_the_user(self, user):
        result = get_authenticated_user(request_with_token(generate_access_token(user)))

        assert result == (user, None)

    def test_missing_cookie_is_401_unauthorized(self):
        assert_rejected(get_authenticated_user(request_with_token()), 401, 'UNAUTHORIZED')

    def test_expired_token_is_401_token_expired(self, user):
        with freeze_time('2026-01-01'):
            token = generate_access_token(user)

        assert_rejected(get_authenticated_user(request_with_token(token)), 401, 'TOKEN_EXPIRED')

    def test_garbage_token_is_401_invalid_token(self):
        assert_rejected(get_authenticated_user(request_with_token('not.a.jwt')), 401, 'INVALID_TOKEN')

    def test_token_signed_by_another_key_is_401_invalid_token(self, user):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        forged = jwt.encode(
            {'user_id': str(user.id), 'token_type': 'access',
             'exp': int((timezone.now() + timedelta(minutes=5)).timestamp())},
            other_key, algorithm=settings.JWT_ALGORITHM,
        )

        assert_rejected(get_authenticated_user(request_with_token(forged)), 401, 'INVALID_TOKEN')

    def test_refresh_token_is_not_accepted_as_access_token(self, user):
        record = RefreshToken.objects.create(
            user=user, token_hash='x', expires_at=timezone.now() + timedelta(days=7)
        )

        token = generate_refresh_token(user, record.id)

        assert_rejected(get_authenticated_user(request_with_token(token)), 401, 'INVALID_TOKEN')

    def test_mfa_challenge_token_is_not_accepted_as_access_token(self, user):
        assert_rejected(
            get_authenticated_user(request_with_token(generate_mfa_token(user))), 401, 'INVALID_TOKEN'
        )

    def test_token_for_a_deleted_user_is_401_invalid_token(self, user):
        token = generate_access_token(user)
        user.delete()

        assert_rejected(get_authenticated_user(request_with_token(token)), 401, 'INVALID_TOKEN')

    def test_disabled_account_is_403(self, user):
        token = generate_access_token(user)
        user.is_active = False
        user.save(update_fields=['is_active'])

        assert_rejected(get_authenticated_user(request_with_token(token)), 403, 'ACCOUNT_DISABLED')


class TestParseJsonBody:
    def body(self, raw, content_type='application/json'):
        return RequestFactory().post('/anything', data=raw, content_type=content_type)

    def test_object_is_returned(self):
        assert parse_json_body(self.body(json.dumps({'a': 1}))) == {'a': 1}

    def test_empty_body_is_empty_dict(self):
        assert parse_json_body(self.body('')) == {}

    def test_invalid_json_is_empty_dict(self):
        assert parse_json_body(self.body('{not json')) == {}

    @pytest.mark.parametrize('raw', ['[1, 2]', '"text"', '42', 'null'])
    def test_non_object_json_is_empty_dict(self, raw):
        assert parse_json_body(self.body(raw)) == {}
