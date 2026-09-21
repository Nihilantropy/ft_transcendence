"""
Tests for the two-factor endpoints: 2fa/setup, 2fa/enable, 2fa/disable and the two-step login
(POST /login returns a challenge, POST /login/2fa completes it)
"""
import re
import time
import uuid
from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from apps.authentication import two_factor
from apps.authentication.jwt_utils import decode_token, generate_access_token, generate_refresh_token
from apps.authentication.models import RecoveryCode, RefreshToken, TwoFactorAuth, User

SETUP = '/api/v1/auth/2fa/setup'
ENABLE = '/api/v1/auth/2fa/enable'
DISABLE = '/api/v1/auth/2fa/disable'
LOGIN = '/api/v1/auth/login'
LOGIN_2FA = '/api/v1/auth/login/2fa'
PASSWORD = 'testpass123'


def post(client, path, body=None, raw=None):
    return client.post(path, data=raw if raw is not None else (body or {}), content_type='application/json')


def error_code(response):
    return response.json()['error']['code']


def password_step(client, password=PASSWORD):
    return post(client, LOGIN, {'email': 'test@example.com', 'password': password})


def confirm(code, password=PASSWORD):
    return {'current_password': password, 'code': code}


def next_step(frozen_time):
    """Move to the next 30 s TOTP step: the previous step's code is now spent"""
    frozen_time.tick(timedelta(seconds=two_factor.PERIOD))


@pytest.mark.django_db
class TestTwoFactorSetupView:
    def test_requires_authentication(self, client):
        response = post(client, SETUP)

        assert response.status_code == 401
        assert error_code(response) == 'UNAUTHORIZED'

    def test_returns_what_an_authenticator_app_needs(self, authenticated_client, user, settings):
        response = post(authenticated_client, SETUP)

        assert response.status_code == 200
        data = response.json()['data']
        assert re.fullmatch(r'[A-Z2-7]{32}', data['secret'])
        assert data['otpauth_uri'] == two_factor.provisioning_uri(data['secret'], user.email)
        assert (data['issuer'], data['algorithm'], data['digits'], data['period']) == (
            settings.TWO_FACTOR_ISSUER, 'SHA1', 6, 30
        )

    def test_response_carrying_a_secret_is_not_cacheable(self, authenticated_client):
        assert post(authenticated_client, SETUP)['Cache-Control'] == 'no-store'

    def test_stages_a_pending_secret_without_enabling_anything(self, authenticated_client, user):
        post(authenticated_client, SETUP)

        assert TwoFactorAuth.objects.get(user=user).is_enabled is False
        assert user.two_factor_enabled is False

    def test_secret_is_stored_encrypted(self, authenticated_client, user):
        secret = post(authenticated_client, SETUP).json()['data']['secret']

        stored = TwoFactorAuth.objects.get(user=user).secret_encrypted
        assert secret not in stored
        assert two_factor.decrypt_secret(stored) == secret

    def test_setting_up_again_replaces_the_pending_secret(self, authenticated_client, user):
        first = post(authenticated_client, SETUP).json()['data']['secret']
        second = post(authenticated_client, SETUP).json()['data']['secret']

        assert first != second
        assert TwoFactorAuth.objects.filter(user=user).count() == 1
        assert two_factor.decrypt_secret(TwoFactorAuth.objects.get(user=user).secret_encrypted) == second

    def test_refuses_when_already_enabled_and_leaves_the_secret_alone(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)
        before = TwoFactorAuth.objects.get(user=user).secret_encrypted

        response = post(authenticated_client, SETUP)

        assert response.status_code == 409
        assert error_code(response) == 'TWO_FACTOR_ALREADY_ENABLED'
        record = TwoFactorAuth.objects.get(user=user)
        assert (record.secret_encrypted, record.is_enabled) == (before, True)

    def test_does_not_touch_the_session(self, authenticated_client):
        response = post(authenticated_client, SETUP)

        assert response.status_code == 200
        assert 'access_token' not in response.cookies


@pytest.mark.django_db
class TestTwoFactorEnableView:
    @pytest.fixture
    def pending(self, authenticated_client):
        """Base32 secret of a setup that has been started but not confirmed"""
        return post(authenticated_client, SETUP).json()['data']['secret']

    def test_requires_authentication(self, client):
        assert post(client, ENABLE, confirm('123456')).status_code == 401

    def test_enables_and_returns_ten_recovery_codes(self, authenticated_client, user, pending, frozen_time):
        response = post(authenticated_client, ENABLE, confirm(two_factor.totp(pending)))

        assert response.status_code == 200
        codes = response.json()['data']['recovery_codes']
        assert len(codes) == 10 and len(set(codes)) == 10
        assert user.two_factor_enabled is True
        assert TwoFactorAuth.objects.get(user=user).enabled_at is not None
        assert RecoveryCode.objects.filter(user=user).count() == 10

    def test_response_carrying_recovery_codes_is_not_cacheable(self, authenticated_client, pending, frozen_time):
        response = post(authenticated_client, ENABLE, confirm(two_factor.totp(pending)))

        assert response['Cache-Control'] == 'no-store'

    def test_the_confirming_code_is_spent(self, authenticated_client, user, pending, frozen_time):
        post(authenticated_client, ENABLE, confirm(two_factor.totp(pending)))

        assert TwoFactorAuth.objects.get(user=user).last_used_step == int(time.time()) // two_factor.PERIOD

    def test_revokes_other_sessions_and_issues_fresh_cookies(self, authenticated_client, user, pending, frozen_time):
        RefreshToken.objects.create(user=user, token_hash='old', expires_at=timezone.now() + timedelta(days=7))

        response = post(authenticated_client, ENABLE, confirm(two_factor.totp(pending)))

        assert response.cookies['access_token'].value
        assert response.cookies['refresh_token'].value
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_wrong_code_is_422_and_nothing_is_enabled(self, authenticated_client, user, pending):
        response = post(authenticated_client, ENABLE, confirm('000000'))

        assert response.status_code == 422
        assert error_code(response) == 'INVALID_2FA_CODE'
        assert user.two_factor_enabled is False
        assert RecoveryCode.objects.filter(user=user).count() == 0

    def test_wrong_password_is_422_even_with_a_valid_code(self, authenticated_client, user, pending, frozen_time):
        """A bare stolen session must not be able to enrol its own authenticator"""
        response = post(authenticated_client, ENABLE, confirm(two_factor.totp(pending), password='wrongpass1'))

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']
        assert user.two_factor_enabled is False

    @pytest.mark.parametrize('missing', ['current_password', 'code'])
    def test_missing_field_is_422(self, authenticated_client, pending, missing):
        body = confirm('123456')
        del body[missing]

        assert post(authenticated_client, ENABLE, body).status_code == 422

    def test_without_setup_is_409(self, authenticated_client):
        response = post(authenticated_client, ENABLE, confirm('123456'))

        assert response.status_code == 409
        assert error_code(response) == 'TWO_FACTOR_SETUP_REQUIRED'

    def test_when_already_enabled_is_409(self, authenticated_client, user, enable_two_factor):
        secret, _ = enable_two_factor(user)

        response = post(authenticated_client, ENABLE, confirm(two_factor.totp(secret)))

        assert response.status_code == 409
        assert error_code(response) == 'TWO_FACTOR_ALREADY_ENABLED'

    def test_code_of_a_replaced_secret_is_rejected(self, authenticated_client, user, pending, frozen_time):
        stale_code = two_factor.totp(pending)
        post(authenticated_client, SETUP)  # rotates the pending secret

        assert post(authenticated_client, ENABLE, confirm(stale_code)).status_code == 422
        assert user.two_factor_enabled is False

    def test_code_shown_with_a_space_is_accepted(self, authenticated_client, user, pending, frozen_time):
        code = two_factor.totp(pending)

        response = post(authenticated_client, ENABLE, confirm(f'{code[:3]} {code[3:]}'))

        assert response.status_code == 200

    def test_a_recovery_style_code_cannot_confirm_setup(self, authenticated_client, pending):
        response = post(authenticated_client, ENABLE, confirm('AAAA-BBBB-CCCC'))

        assert response.status_code == 422
        assert error_code(response) == 'INVALID_2FA_CODE'


@pytest.mark.django_db
class TestLoginPasswordStep:
    """POST /login for an account with 2FA enabled"""

    def test_returns_a_challenge_and_no_session(self, client, user, enable_two_factor):
        enable_two_factor(user)

        response = password_step(client)

        assert response.status_code == 200
        data = response.json()['data']
        assert data['mfa_required'] is True
        assert decode_token(data['mfa_token'])['token_type'] == 'mfa'
        assert 'user' not in data
        assert 'access_token' not in response.cookies
        assert 'refresh_token' not in response.cookies
        assert RefreshToken.objects.filter(user=user).count() == 0

    def test_wrong_password_gets_no_challenge(self, client, user, enable_two_factor):
        enable_two_factor(user)

        response = password_step(client, password='wrongpass1')

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_CREDENTIALS'
        assert response.json()['data'] is None  # no challenge token to an unauthenticated caller

    def test_existing_sessions_survive_the_password_step(self, client, user, enable_two_factor):
        """Otherwise anyone who knows the password could log the victim out by retrying"""
        enable_two_factor(user)
        session = RefreshToken.objects.create(user=user, token_hash='h', expires_at=timezone.now() + timedelta(days=7))

        password_step(client)

        session.refresh_from_db()
        assert session.is_revoked is False

    def test_unconfirmed_setup_does_not_add_a_second_step(self, client, user):
        TwoFactorAuth.objects.create(
            user=user, secret_encrypted=two_factor.encrypt_secret(two_factor.generate_secret()), is_enabled=False
        )

        response = password_step(client)

        assert response.status_code == 200
        assert 'mfa_required' not in response.json()['data']
        assert response.cookies['access_token'].value

    def test_disabled_account_gets_no_challenge(self, client, user, enable_two_factor):
        enable_two_factor(user)
        user.is_active = False
        user.save(update_fields=['is_active'])

        assert password_step(client).status_code == 403

    def test_challenge_token_is_not_a_session_for_the_auth_service_itself(self, client, user, enable_two_factor):
        enable_two_factor(user)
        client.cookies['access_token'] = password_step(client).json()['data']['mfa_token']

        response = client.get('/api/v1/auth/verify')

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'


@pytest.mark.django_db
class TestLoginSecondStep:
    """POST /login/2fa"""

    @pytest.fixture
    def challenge(self, client, user, enable_two_factor, frozen_time):
        secret, codes = enable_two_factor(user)
        token = password_step(client).json()['data']['mfa_token']
        return SimpleNamespace(token=token, secret=secret, codes=codes)

    def complete(self, client, token, code):
        return post(client, LOGIN_2FA, {'mfa_token': token, 'code': code})

    def new_challenge(self, client):
        return password_step(client).json()['data']['mfa_token']

    def test_valid_code_completes_the_login(self, client, user, challenge):
        response = self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        assert response.status_code == 200
        data = response.json()['data']
        assert data['user']['email'] == 'test@example.com'
        assert data['user']['two_factor_enabled'] is True
        assert response.cookies['access_token'].value
        assert response.cookies['refresh_token'].value

    def test_the_session_it_creates_is_usable(self, client, challenge):
        self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        response = client.get('/api/v1/auth/verify')

        assert response.status_code == 200
        assert response.json()['data']['valid'] is True

    def test_completing_the_login_revokes_previous_sessions(self, client, user, challenge):
        old = RefreshToken.objects.create(user=user, token_hash='old', expires_at=timezone.now() + timedelta(days=7))

        self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        old.refresh_from_db()
        assert old.is_revoked is True
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_wrong_code_is_401_and_sets_no_cookies(self, client, challenge):
        response = self.complete(client, challenge.token, '000000')

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_2FA_CODE'
        assert 'access_token' not in response.cookies

    def test_a_code_from_another_users_authenticator_is_rejected(self, client, challenge, enable_two_factor):
        other = User.objects.create_user(email='other@example.com', password=PASSWORD)
        other_secret, _ = enable_two_factor(other)

        response = self.complete(client, challenge.token, two_factor.totp(other_secret))

        assert response.status_code == 401

    def test_a_code_cannot_be_replayed(self, client, challenge):
        code = two_factor.totp(challenge.secret)
        assert self.complete(client, challenge.token, code).status_code == 200

        replay = self.complete(client, self.new_challenge(client), code)

        assert replay.status_code == 401
        assert error_code(replay) == 'INVALID_2FA_CODE'

    def test_the_next_steps_code_works_after_a_login(self, client, challenge, frozen_time):
        assert self.complete(client, challenge.token, two_factor.totp(challenge.secret)).status_code == 200
        next_step(frozen_time)

        response = self.complete(client, self.new_challenge(client), two_factor.totp(challenge.secret))

        assert response.status_code == 200

    def test_a_recovery_code_works_exactly_once(self, client, challenge):
        assert self.complete(client, challenge.token, challenge.codes[0]).status_code == 200

        reuse = self.complete(client, self.new_challenge(client), challenge.codes[0])
        other = self.complete(client, self.new_challenge(client), challenge.codes[1])

        assert reuse.status_code == 401
        assert other.status_code == 200

    def test_repeated_failures_lock_the_account_even_for_the_right_code(self, client, challenge, settings):
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            assert self.complete(client, challenge.token, '000000').status_code == 401

        response = self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        assert response.status_code == 429
        assert error_code(response) == 'RATE_LIMIT_EXCEEDED'
        assert 'access_token' not in response.cookies

    def test_a_fresh_challenge_does_not_reset_the_lock(self, client, challenge, settings):
        """An attacker who knows the password can mint challenges at will: the lock is per account"""
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            self.complete(client, challenge.token, '000000')

        response = self.complete(client, self.new_challenge(client), two_factor.totp(challenge.secret))

        assert response.status_code == 429

    def test_the_lock_expires(self, client, challenge, settings, frozen_time):
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            self.complete(client, challenge.token, '000000')
        frozen_time.tick(timedelta(minutes=settings.TWO_FACTOR_LOCKOUT_MINUTES, seconds=1))

        response = self.complete(client, self.new_challenge(client), two_factor.totp(challenge.secret))

        assert response.status_code == 200

    def test_expired_challenge_is_401_token_expired(self, client, challenge, settings, frozen_time):
        frozen_time.tick(timedelta(minutes=settings.TWO_FACTOR_CHALLENGE_LIFETIME_MINUTES, seconds=1))

        response = self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        assert response.status_code == 401
        assert error_code(response) == 'TOKEN_EXPIRED'

    def test_garbage_token_is_401_invalid_token(self, client, challenge):
        response = self.complete(client, 'not.a.jwt', two_factor.totp(challenge.secret))

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'

    def test_access_token_is_not_a_challenge(self, client, user, challenge):
        response = self.complete(client, generate_access_token(user), two_factor.totp(challenge.secret))

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'

    def test_refresh_token_is_not_a_challenge(self, client, user, challenge):
        response = self.complete(
            client, generate_refresh_token(user, uuid.uuid4()), two_factor.totp(challenge.secret)
        )

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'

    def test_challenge_for_a_deleted_user_is_401(self, client, user, challenge):
        user.delete()

        response = self.complete(client, challenge.token, '123456')

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'

    def test_account_disabled_after_the_challenge_is_403(self, client, user, challenge):
        user.is_active = False
        user.save(update_fields=['is_active'])

        response = self.complete(client, challenge.token, two_factor.totp(challenge.secret))

        assert response.status_code == 403
        assert error_code(response) == 'ACCOUNT_DISABLED'

    def test_two_factor_switched_off_after_the_challenge_is_401(self, client, user, challenge):
        TwoFactorAuth.objects.filter(user=user).delete()

        response = self.complete(client, challenge.token, '123456')

        assert response.status_code == 401
        assert error_code(response) == 'INVALID_TOKEN'

    @pytest.mark.parametrize('body', [{}, {'mfa_token': 'a.b.c'}, {'code': '123456'}, {'mfa_token': 'a.b.c', 'code': ''}])
    def test_missing_or_blank_fields_are_422(self, client, body):
        response = post(client, LOGIN_2FA, body)

        assert response.status_code == 422
        assert error_code(response) == 'VALIDATION_ERROR'

    @pytest.mark.parametrize('raw', ['{not json', '[1]', 'null', ''])
    def test_malformed_body_is_422_not_500(self, client, raw):
        assert post(client, LOGIN_2FA, raw=raw).status_code == 422


@pytest.mark.django_db
class TestTwoFactorDisableView:
    def test_requires_authentication(self, client):
        assert post(client, DISABLE, confirm('123456')).status_code == 401

    def test_disables_with_a_totp_code(self, authenticated_client, user, enable_two_factor, frozen_time):
        secret, _ = enable_two_factor(user)

        response = post(authenticated_client, DISABLE, confirm(two_factor.totp(secret)))

        assert response.status_code == 200
        assert user.two_factor_enabled is False
        assert TwoFactorAuth.objects.filter(user=user).count() == 0
        assert RecoveryCode.objects.filter(user=user).count() == 0

    def test_disables_with_a_recovery_code(self, authenticated_client, user, enable_two_factor):
        _, codes = enable_two_factor(user)

        assert post(authenticated_client, DISABLE, confirm(codes[0])).status_code == 200
        assert user.two_factor_enabled is False

    def test_revokes_sessions_and_issues_fresh_cookies(self, authenticated_client, user, enable_two_factor, frozen_time):
        secret, _ = enable_two_factor(user)
        RefreshToken.objects.create(user=user, token_hash='old', expires_at=timezone.now() + timedelta(days=7))

        response = post(authenticated_client, DISABLE, confirm(two_factor.totp(secret)))

        assert response.cookies['access_token'].value
        assert RefreshToken.objects.filter(user=user, is_revoked=False).count() == 1

    def test_wrong_password_is_422_and_keeps_2fa_on(self, authenticated_client, user, enable_two_factor, frozen_time):
        secret, _ = enable_two_factor(user)

        response = post(authenticated_client, DISABLE, confirm(two_factor.totp(secret), password='wrongpass1'))

        assert response.status_code == 422
        assert user.two_factor_enabled is True

    def test_wrong_code_is_422_counts_as_a_failure_and_keeps_2fa_on(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)

        response = post(authenticated_client, DISABLE, confirm('000000'))

        assert response.status_code == 422
        assert error_code(response) == 'INVALID_2FA_CODE'
        assert user.two_factor_enabled is True
        assert TwoFactorAuth.objects.get(user=user).failed_attempts == 1

    def test_repeated_wrong_codes_lock_it(self, authenticated_client, user, enable_two_factor, settings, frozen_time):
        secret, _ = enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            post(authenticated_client, DISABLE, confirm('000000'))

        response = post(authenticated_client, DISABLE, confirm(two_factor.totp(secret)))

        assert response.status_code == 429
        assert error_code(response) == 'RATE_LIMIT_EXCEEDED'
        assert user.two_factor_enabled is True

    def test_missing_code_is_422(self, authenticated_client, user, enable_two_factor):
        enable_two_factor(user)

        assert post(authenticated_client, DISABLE, {'current_password': PASSWORD}).status_code == 422

    def test_when_not_enabled_is_409(self, authenticated_client):
        response = post(authenticated_client, DISABLE, confirm('123456'))

        assert response.status_code == 409
        assert error_code(response) == 'TWO_FACTOR_NOT_ENABLED'

    def test_an_unconfirmed_setup_counts_as_not_enabled(self, authenticated_client):
        post(authenticated_client, SETUP)

        response = post(authenticated_client, DISABLE, confirm('123456'))

        assert response.status_code == 409
        assert error_code(response) == 'TWO_FACTOR_NOT_ENABLED'

    def test_login_is_single_step_again_afterwards(self, client, authenticated_client, user, enable_two_factor, frozen_time):
        secret, _ = enable_two_factor(user)
        assert post(authenticated_client, DISABLE, confirm(two_factor.totp(secret))).status_code == 200
        client.cookies.clear()

        response = password_step(client)

        assert 'mfa_required' not in response.json()['data']
        assert response.cookies['access_token'].value

    def test_can_be_set_up_again_afterwards(self, authenticated_client, user, enable_two_factor):
        secret, codes = enable_two_factor(user)
        post(authenticated_client, DISABLE, confirm(codes[0]))

        response = post(authenticated_client, SETUP)

        assert response.status_code == 200
        assert response.json()['data']['secret'] != secret


@pytest.mark.django_db
def test_full_lifecycle_through_the_http_api(client, frozen_time):
    """register -> setup -> enable -> log in with two steps -> disable -> log in with one"""
    email, password = 'life@example.com', 'Lifecycle123'
    register = post(client, '/api/v1/auth/register', {
        'email': email, 'password': password, 'password_confirm': password,
    })
    assert register.status_code == 201
    assert register.json()['data']['user']['two_factor_enabled'] is False

    secret = post(client, SETUP).json()['data']['secret']
    enabled = post(client, ENABLE, confirm(two_factor.totp(secret), password))
    assert enabled.status_code == 200
    assert len(enabled.json()['data']['recovery_codes']) == 10

    client.cookies.clear()  # a new browser
    challenge = post(client, LOGIN, {'email': email, 'password': password}).json()['data']
    assert challenge['mfa_required'] is True and not client.cookies

    next_step(frozen_time)
    login = post(client, LOGIN_2FA, {'mfa_token': challenge['mfa_token'], 'code': two_factor.totp(secret)})
    assert login.status_code == 200
    assert client.get('/api/v1/auth/verify').json()['data']['user']['two_factor_enabled'] is True

    next_step(frozen_time)
    assert post(client, DISABLE, confirm(two_factor.totp(secret), password)).status_code == 200

    client.cookies.clear()
    single_step = post(client, LOGIN, {'email': email, 'password': password}).json()['data']
    assert 'mfa_required' not in single_step
    assert single_step['user']['two_factor_enabled'] is False
