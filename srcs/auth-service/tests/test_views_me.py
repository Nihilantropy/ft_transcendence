"""
Tests for PATCH /api/v1/auth/me (update first name, last name, email)
"""
from unittest import mock

import pytest
from django.db import IntegrityError

from apps.authentication import two_factor
from apps.authentication.jwt_utils import decode_token
from apps.authentication.models import RefreshToken, User


ENDPOINT = '/api/v1/auth/me'


def patch(client, body=None, raw=None):
    return client.patch(ENDPOINT, data=raw if raw is not None else (body or {}), content_type='application/json')


def error_code(response):
    return response.json()['error']['code']


@pytest.mark.django_db
class TestUpdateProfileNames:
    def test_requires_authentication(self, client):
        response = patch(client, {'first_name': 'Ada'})

        assert response.status_code == 401
        assert error_code(response) == 'UNAUTHORIZED'

    def test_updates_both_names(self, authenticated_client, user):
        response = patch(authenticated_client, {'first_name': 'Ada', 'last_name': 'Lovelace'})

        assert response.status_code == 200
        body = response.json()
        assert body['success'] is True
        assert body['data']['user']['first_name'] == 'Ada'
        assert body['data']['user']['last_name'] == 'Lovelace'
        user.refresh_from_db()
        assert (user.first_name, user.last_name) == ('Ada', 'Lovelace')

    def test_partial_update_leaves_the_other_name_alone(self, authenticated_client, user):
        patch(authenticated_client, {'last_name': 'Lovelace'})

        user.refresh_from_db()
        assert (user.first_name, user.last_name) == ('Test', 'Lovelace')

    def test_names_are_trimmed(self, authenticated_client, user):
        patch(authenticated_client, {'first_name': '  Ada  '})

        user.refresh_from_db()
        assert user.first_name == 'Ada'

    def test_blank_name_clears_it(self, authenticated_client, user):
        response = patch(authenticated_client, {'first_name': ''})

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == ''

    def test_response_reports_two_factor_state(self, authenticated_client):
        response = patch(authenticated_client, {'first_name': 'Ada'})

        assert response.json()['data']['user']['two_factor_enabled'] is False

    def test_name_change_keeps_sessions_and_cookies(self, authenticated_client, user):
        """Names are not in the JWT, so there is no reason to log the user out or re-issue tokens"""
        session = RefreshToken.objects.create(user=user, token_hash='h', expires_at=user.created_at)

        response = patch(authenticated_client, {'first_name': 'Ada'})

        assert response.status_code == 200
        assert 'access_token' not in response.cookies
        assert 'refresh_token' not in response.cookies
        session.refresh_from_db()
        assert session.is_revoked is False

    def test_name_over_150_characters_is_422(self, authenticated_client, user):
        response = patch(authenticated_client, {'first_name': 'x' * 151})

        assert response.status_code == 422
        assert error_code(response) == 'VALIDATION_ERROR'
        assert 'first_name' in response.json()['error']['details']

    def test_name_change_needs_no_password_or_code(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)

        assert patch(authenticated_client, {'first_name': 'Ada'}).status_code == 200


@pytest.mark.django_db
class TestUpdateProfileEmail:
    def change(self, client, **extra):
        return patch(client, {'email': 'new@example.com', 'current_password': 'testpass123', **extra})

    def test_email_change_succeeds_and_is_lowercased(self, authenticated_client, user):
        response = patch(authenticated_client, {'email': 'New@Example.COM', 'current_password': 'testpass123'})

        assert response.status_code == 200
        assert response.json()['data']['user']['email'] == 'new@example.com'
        user.refresh_from_db()
        assert user.email == 'new@example.com'

    def test_email_change_reissues_tokens_carrying_the_new_email(self, authenticated_client, user):
        """The access token embeds the email, so the old one would go stale"""
        response = self.change(authenticated_client)

        assert response.cookies['access_token'].value
        assert decode_token(response.cookies['access_token'].value)['email'] == 'new@example.com'
        assert response.cookies['refresh_token'].value

    def test_email_change_revokes_every_previous_session(self, authenticated_client, user):
        for i in range(3):
            RefreshToken.objects.create(user=user, token_hash=f'h{i}', expires_at=user.created_at)

        self.change(authenticated_client)

        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1  # the fresh one

    def test_new_email_can_log_in_and_the_old_one_cannot(self, authenticated_client, client, user):
        self.change(authenticated_client)

        def login(email):
            return client.post('/api/v1/auth/login', data={'email': email, 'password': 'testpass123'},
                               content_type='application/json')

        assert login('new@example.com').status_code == 200
        assert login('test@example.com').status_code == 401

    def test_email_change_without_password_is_422_and_changes_nothing(self, authenticated_client, user):
        response = patch(authenticated_client, {'email': 'new@example.com'})

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']
        user.refresh_from_db()
        assert user.email == 'test@example.com'

    def test_email_change_with_wrong_password_is_422(self, authenticated_client, user):
        response = patch(authenticated_client, {'email': 'new@example.com', 'current_password': 'wrongpass1'})

        assert response.status_code == 422
        user.refresh_from_db()
        assert user.email == 'test@example.com'

    def test_duplicate_email_is_409_case_insensitively(self, authenticated_client, user):
        User.objects.create_user(email='taken@example.com', password='testpass123')

        response = patch(authenticated_client, {'email': 'TAKEN@example.com', 'current_password': 'testpass123'})

        assert response.status_code == 409
        assert error_code(response) == 'EMAIL_ALREADY_EXISTS'
        user.refresh_from_db()
        assert user.email == 'test@example.com'

    def test_taken_address_cannot_be_probed_without_the_password(self, authenticated_client, user):
        User.objects.create_user(email='taken@example.com', password='testpass123')

        response = patch(authenticated_client, {'email': 'taken@example.com'})

        assert response.status_code == 422  # not 409: nothing about the address is revealed

    def test_losing_a_race_on_the_unique_constraint_is_409(self, authenticated_client):
        with mock.patch.object(User, 'save', side_effect=IntegrityError('duplicate key')):
            response = self.change(authenticated_client)

        assert response.status_code == 409
        assert error_code(response) == 'EMAIL_ALREADY_EXISTS'

    def test_resubmitting_own_email_is_a_no_op(self, authenticated_client, user):
        response = patch(authenticated_client, {'email': 'TEST@example.com', 'first_name': 'Ada'})

        assert response.status_code == 200
        assert 'access_token' not in response.cookies  # not an email change: no re-issue, no password

    def test_own_email_alone_leaves_nothing_to_update(self, authenticated_client):
        assert patch(authenticated_client, {'email': 'test@example.com'}).status_code == 422

    def test_invalid_email_format_is_422(self, authenticated_client):
        response = patch(authenticated_client, {'email': 'not-an-email', 'current_password': 'testpass123'})

        assert response.status_code == 422
        assert 'email' in response.json()['error']['details']


@pytest.mark.django_db
class TestUpdateProfileEmailWithTwoFactor:
    def change(self, client, **extra):
        return patch(client, {'email': 'new@example.com', 'current_password': 'testpass123', **extra})

    def test_email_change_without_code_is_422(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)

        response = self.change(authenticated_client)

        assert response.status_code == 422
        assert 'code' in response.json()['error']['details']

    def test_email_change_with_wrong_code_is_422_invalid_2fa_code(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)

        response = self.change(authenticated_client, code='000000')

        assert response.status_code == 422
        assert error_code(response) == 'INVALID_2FA_CODE'
        user.refresh_from_db()
        assert user.email == 'test@example.com'

    def test_email_change_with_valid_code_succeeds(self, authenticated_client, user, enable_two_factor, frozen_time):
        secret, _ = enable_two_factor(user)

        response = self.change(authenticated_client, code=two_factor.totp(secret))

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.email == 'new@example.com'

    def test_email_change_accepts_a_recovery_code(self, authenticated_client, user, enable_two_factor):
        _, codes = enable_two_factor(user)

        assert self.change(authenticated_client, code=codes[0]).status_code == 200

    def test_repeated_wrong_codes_lock_the_account(self, authenticated_client, user, enable_two_factor, settings, frozen_time):
        secret, _ = enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            assert self.change(authenticated_client, code='000000').status_code == 422

        response = self.change(authenticated_client, code=two_factor.totp(secret))

        assert response.status_code == 429
        assert error_code(response) == 'RATE_LIMIT_EXCEEDED'
        user.refresh_from_db()
        assert user.email == 'test@example.com'


@pytest.mark.django_db
class TestUpdateProfileInputHandling:
    @pytest.mark.parametrize('body', [{}, {'unknown': 'x'}])
    def test_nothing_to_update_is_422(self, authenticated_client, body):
        response = patch(authenticated_client, body)

        assert response.status_code == 422
        assert error_code(response) == 'VALIDATION_ERROR'

    @pytest.mark.parametrize('raw', ['{not json', '[1, 2]', '"text"', 'null', ''])
    def test_malformed_body_is_422_not_500(self, authenticated_client, raw):
        assert patch(authenticated_client, raw=raw).status_code == 422

    @pytest.mark.parametrize('body', [
        {'first_name': None},
        {'first_name': ['Ada']},
        {'last_name': {'x': 1}},
        {'first_name': True},
        {'email': None, 'current_password': 'testpass123'},
        {'email': ['a@b.co'], 'current_password': 'testpass123'},
    ])
    def test_wrongly_typed_values_are_422_not_500(self, authenticated_client, body):
        assert patch(authenticated_client, body).status_code == 422

    def test_privileged_fields_cannot_be_mass_assigned(self, authenticated_client, user):
        response = patch(authenticated_client, {
            'first_name': 'Ada',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
            'is_verified': False,
            'is_active': False,
            'id': '00000000-0000-0000-0000-000000000000',
            'password': 'hijacked123',
        })

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == 'Ada'
        assert user.role == 'user'
        assert (user.is_staff, user.is_superuser, user.is_verified, user.is_active) == (False, False, True, True)
        assert str(user.id) != '00000000-0000-0000-0000-000000000000'
        assert user.check_password('testpass123')

    def test_only_the_authenticated_user_is_modified(self, authenticated_client, user):
        other = User.objects.create_user(email='other@example.com', password='testpass123', first_name='Other')

        response = patch(authenticated_client, {'first_name': 'Ada', 'id': str(other.id), 'user_id': str(other.id)})

        assert response.status_code == 200
        user.refresh_from_db()
        other.refresh_from_db()
        assert user.first_name == 'Ada'
        assert other.first_name == 'Other'

    def test_expired_token_is_401(self, client, user):
        from freezegun import freeze_time
        from apps.authentication.jwt_utils import generate_access_token
        with freeze_time('2026-01-01'):
            client.cookies['access_token'] = generate_access_token(user)

        response = patch(client, {'first_name': 'Ada'})

        assert response.status_code == 401
        assert error_code(response) == 'TOKEN_EXPIRED'

    def test_disabled_account_is_403(self, authenticated_client, user):
        user.is_active = False
        user.save(update_fields=['is_active'])

        response = patch(authenticated_client, {'first_name': 'Ada'})

        assert response.status_code == 403
        assert error_code(response) == 'ACCOUNT_DISABLED'
