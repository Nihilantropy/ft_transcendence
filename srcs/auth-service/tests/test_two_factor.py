"""
Tests for apps.authentication.two_factor: TOTP primitives (RFC 4226 / 6238), secret encryption,
recovery codes, and second-factor verification (replay protection + per-account lockout)
"""
import base64
import re
import time
from datetime import timedelta
from urllib.parse import parse_qs, unquote, urlparse

import pytest
from cryptography.fernet import Fernet, InvalidToken
from django.utils import timezone
from freezegun import freeze_time

from apps.authentication import two_factor
from apps.authentication.jwt_utils import hash_token
from apps.authentication.models import RecoveryCode, TwoFactorAuth

# RFC 4226 Appendix D and RFC 6238 Appendix B share this ASCII secret: "12345678901234567890"
RFC_SECRET = base64.b32encode(b'12345678901234567890').decode()


class TestHotpAndTotp:
    """The one-time-password maths, pinned to the RFC test vectors"""

    @pytest.mark.parametrize('counter, expected', list(enumerate([
        '755224', '287082', '359152', '969429', '338314',
        '254676', '287922', '162583', '399871', '520489',
    ])))
    def test_hotp_matches_rfc_4226_vectors(self, counter, expected):
        assert two_factor.hotp(RFC_SECRET, counter) == expected

    @pytest.mark.parametrize('at, expected', [
        (59, '287082'),
        (1111111109, '081804'),   # leading zero must be preserved
        (1111111111, '050471'),
        (1234567890, '005924'),
        (2000000000, '279037'),
        (20000000000, '353130'),
    ])
    def test_totp_matches_rfc_6238_vectors(self, at, expected):
        """RFC 6238 lists 8-digit codes; the 6-digit code is their last six digits"""
        assert two_factor.totp(RFC_SECRET, at=at) == expected

    def test_totp_defaults_to_current_time(self):
        with freeze_time('2033-05-18 03:33:20'):  # epoch 2000000000
            assert two_factor.totp(RFC_SECRET) == '279037'

    def test_generate_secret_is_160_bit_base32(self):
        secret = two_factor.generate_secret()

        assert re.fullmatch(r'[A-Z2-7]{32}', secret)
        assert len(base64.b32decode(secret)) == 20

    def test_generate_secret_is_unique(self):
        assert len({two_factor.generate_secret() for _ in range(50)}) == 50


class TestMatchingStep:
    """Code -> time-step lookup with clock-drift tolerance"""

    NOW = 2000000000  # step 66666666

    def step(self, at=None):
        return int(at if at is not None else self.NOW) // two_factor.PERIOD

    def test_current_code_matches_current_step(self):
        code = two_factor.totp(RFC_SECRET, at=self.NOW)

        assert two_factor.matching_step(RFC_SECRET, code, at=self.NOW) == self.step()

    @pytest.mark.parametrize('drift', [-30, 30])
    def test_adjacent_steps_are_accepted(self, drift):
        code = two_factor.totp(RFC_SECRET, at=self.NOW + drift)

        assert two_factor.matching_step(RFC_SECRET, code, at=self.NOW) == self.step(self.NOW + drift)

    @pytest.mark.parametrize('drift', [-60, 60])
    def test_two_steps_away_is_rejected(self, drift):
        code = two_factor.totp(RFC_SECRET, at=self.NOW + drift)

        assert two_factor.matching_step(RFC_SECRET, code, at=self.NOW) is None

    def test_window_is_configurable(self, settings):
        settings.TWO_FACTOR_WINDOW = 0
        previous = two_factor.totp(RFC_SECRET, at=self.NOW - 30)

        assert two_factor.matching_step(RFC_SECRET, previous, at=self.NOW) is None

    def test_wrong_code_does_not_match(self):
        code = two_factor.totp(RFC_SECRET, at=self.NOW)
        wrong = f'{(int(code) + 1) % 1000000:06d}'

        assert two_factor.matching_step(RFC_SECRET, wrong, at=self.NOW) is None

    @pytest.mark.parametrize('bad', [
        '',
        '12345',            # too short
        '1234567',          # too long
        'abcdef',
        '12345a',
        '١٢٣٤٥٦',            # Arabic-Indic digits: str.isdigit() is True, compare_digest would raise
        '１２３４５６',        # full-width digits, same trap
    ])
    def test_malformed_codes_never_match_and_never_raise(self, bad):
        assert two_factor.matching_step(RFC_SECRET, bad, at=self.NOW) is None


class TestProvisioningUri:
    SECRET = 'JBSWY3DPEHPK3PXP'

    def test_uri_carries_everything_authenticator_apps_need(self, settings):
        settings.TWO_FACTOR_ISSUER = 'SmartBreeds'

        uri = two_factor.provisioning_uri(self.SECRET, 'alice@example.com')
        parsed = urlparse(uri)

        assert parsed.scheme == 'otpauth'
        assert parsed.netloc == 'totp'
        assert unquote(parsed.path) == '/SmartBreeds:alice@example.com'
        assert parse_qs(parsed.query) == {
            'secret': [self.SECRET],
            'issuer': ['SmartBreeds'],
            'algorithm': ['SHA1'],
            'digits': ['6'],
            'period': ['30'],
        }

    def test_special_characters_in_email_are_escaped(self):
        uri = two_factor.provisioning_uri(self.SECRET, 'a+b@example.com')

        assert 'a%2Bb%40example.com' in uri

    def test_spaces_in_issuer_are_percent_encoded_not_plus(self, settings):
        """Authenticator apps do not decode '+' as a space"""
        settings.TWO_FACTOR_ISSUER = 'Smart Breeds'

        uri = two_factor.provisioning_uri(self.SECRET, 'alice@example.com')

        assert 'Smart%20Breeds' in uri
        assert '+' not in uri


class TestSecretEncryption:
    def test_round_trip(self):
        secret = two_factor.generate_secret()

        assert two_factor.decrypt_secret(two_factor.encrypt_secret(secret)) == secret

    def test_ciphertext_does_not_contain_the_secret(self):
        secret = two_factor.generate_secret()

        assert secret not in two_factor.encrypt_secret(secret)

    def test_encryption_is_randomised(self):
        secret = two_factor.generate_secret()

        assert two_factor.encrypt_secret(secret) != two_factor.encrypt_secret(secret)

    def test_tampered_ciphertext_is_rejected(self):
        token = two_factor.encrypt_secret(two_factor.generate_secret())
        tampered = token[:-4] + ('AAAA' if not token.endswith('AAAA') else 'BBBB')

        with pytest.raises(InvalidToken):
            two_factor.decrypt_secret(tampered)

    def test_explicit_key_setting_is_used(self, settings):
        settings.TWO_FACTOR_ENCRYPTION_KEY = Fernet.generate_key().decode()
        token = two_factor.encrypt_secret('JBSWY3DPEHPK3PXP')

        # Same ciphertext must not decrypt under the SECRET_KEY-derived fallback key
        settings.TWO_FACTOR_ENCRYPTION_KEY = ''
        with pytest.raises(InvalidToken):
            two_factor.decrypt_secret(token)

    def test_fallback_key_is_derived_from_secret_key(self, settings):
        settings.TWO_FACTOR_ENCRYPTION_KEY = ''
        settings.SECRET_KEY = 'first-key'
        token = two_factor.encrypt_secret('JBSWY3DPEHPK3PXP')

        settings.SECRET_KEY = 'second-key'
        with pytest.raises(InvalidToken):
            two_factor.decrypt_secret(token)


@pytest.mark.django_db
class TestRecoveryCodes:
    CODE_FORMAT = re.compile(r'[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){2}')  # no 0/O/1/I

    def test_generates_ten_unique_well_formed_codes(self, user):
        codes = two_factor.generate_recovery_codes(user)

        assert len(codes) == two_factor.RECOVERY_CODE_COUNT == 10
        assert len(set(codes)) == 10
        assert all(self.CODE_FORMAT.fullmatch(code) for code in codes)

    def test_only_hashes_are_stored(self, user):
        codes = two_factor.generate_recovery_codes(user)

        stored = set(RecoveryCode.objects.filter(user=user).values_list('code_hash', flat=True))
        assert stored == {hash_token(code.replace('-', '')) for code in codes}
        assert not stored & set(codes)

    def test_regenerating_replaces_previous_codes(self, user):
        old = two_factor.generate_recovery_codes(user)
        new = two_factor.generate_recovery_codes(user)

        assert RecoveryCode.objects.filter(user=user).count() == 10
        assert set(old).isdisjoint(new)
        assert not RecoveryCode.objects.filter(code_hash=hash_token(old[0].replace('-', ''))).exists()

    def test_other_users_codes_are_untouched(self, user):
        from apps.authentication.models import User
        other = User.objects.create_user(email='other@example.com', password='testpass123')
        two_factor.generate_recovery_codes(other)

        two_factor.generate_recovery_codes(user)

        assert RecoveryCode.objects.filter(user=other).count() == 10


@pytest.fixture
def frozen_time():
    """Pin the clock so TOTP steps and lock timers are deterministic"""
    with freeze_time('2026-03-01 12:00:10') as frozen:
        yield frozen


@pytest.mark.django_db
@pytest.mark.usefixtures('frozen_time')
class TestVerifySecondFactor:
    def two_factor_row(self, user):
        return TwoFactorAuth.objects.get(user=user)

    def test_valid_totp_is_accepted(self, user, enable_two_factor):
        secret, _ = enable_two_factor(user)

        assert two_factor.verify_second_factor(user, two_factor.totp(secret)) == 'ok'

    def test_wrong_code_is_invalid(self, user, enable_two_factor):
        secret, _ = enable_two_factor(user)
        wrong = f'{(int(two_factor.totp(secret)) + 1) % 1000000:06d}'

        assert two_factor.verify_second_factor(user, wrong) == 'invalid'

    def test_code_shown_with_a_space_is_accepted(self, user, enable_two_factor):
        """Authenticator apps display codes as '123 456'"""
        secret, _ = enable_two_factor(user)
        code = two_factor.totp(secret)

        assert two_factor.verify_second_factor(user, f'{code[:3]} {code[3:]}') == 'ok'

    def test_same_code_cannot_be_used_twice(self, user, enable_two_factor):
        """RFC 6238 section 5.2: a verifier must not accept an OTP a second time"""
        secret, _ = enable_two_factor(user)
        code = two_factor.totp(secret)

        assert two_factor.verify_second_factor(user, code) == 'ok'
        assert two_factor.verify_second_factor(user, code) == 'invalid'

    def test_older_step_than_the_last_accepted_is_rejected(self, user, enable_two_factor):
        secret, _ = enable_two_factor(user)
        current = two_factor.totp(secret)
        next_step = two_factor.totp(secret, at=time.time() + 30)

        assert two_factor.verify_second_factor(user, next_step) == 'ok'
        assert two_factor.verify_second_factor(user, current) == 'invalid'

    def test_last_used_step_is_persisted(self, user, enable_two_factor):
        secret, _ = enable_two_factor(user)

        two_factor.verify_second_factor(user, two_factor.totp(secret))

        assert self.two_factor_row(user).last_used_step == int(time.time()) // 30

    def test_recovery_code_is_accepted_exactly_once(self, user, enable_two_factor):
        _, codes = enable_two_factor(user)

        assert two_factor.verify_second_factor(user, codes[0]) == 'ok'
        assert two_factor.verify_second_factor(user, codes[0]) == 'invalid'
        assert RecoveryCode.objects.filter(user=user, used_at__isnull=False).count() == 1

    def test_recovery_code_is_case_and_dash_insensitive(self, user, enable_two_factor):
        _, codes = enable_two_factor(user)

        assert two_factor.verify_second_factor(user, codes[0].lower().replace('-', ' ')) == 'ok'

    def test_recovery_code_of_another_user_is_invalid(self, user, enable_two_factor):
        from apps.authentication.models import User
        other = User.objects.create_user(email='other@example.com', password='testpass123')
        enable_two_factor(user)
        _, other_codes = enable_two_factor(other)

        assert two_factor.verify_second_factor(user, other_codes[0]) == 'invalid'

    def test_success_resets_the_failure_counter(self, user, enable_two_factor):
        secret, _ = enable_two_factor(user)
        for _ in range(2):
            two_factor.verify_second_factor(user, '000000')
        assert self.two_factor_row(user).failed_attempts == 2

        two_factor.verify_second_factor(user, two_factor.totp(secret))

        assert self.two_factor_row(user).failed_attempts == 0

    def test_account_locks_after_max_failures_even_for_a_correct_code(self, user, enable_two_factor, settings):
        secret, _ = enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            assert two_factor.verify_second_factor(user, '000000') == 'invalid'

        assert two_factor.verify_second_factor(user, two_factor.totp(secret)) == 'locked'

    def test_lock_covers_recovery_codes_too(self, user, enable_two_factor, settings):
        _, codes = enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            two_factor.verify_second_factor(user, '000000')

        assert two_factor.verify_second_factor(user, codes[0]) == 'locked'

    def test_wrong_recovery_code_counts_as_a_failure(self, user, enable_two_factor):
        enable_two_factor(user)

        two_factor.verify_second_factor(user, 'AAAA-BBBB-CCCC')

        assert self.two_factor_row(user).failed_attempts == 1

    def test_attempts_while_locked_do_not_extend_the_lock(self, user, enable_two_factor, settings, frozen_time):
        enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            two_factor.verify_second_factor(user, '000000')
        locked_until = self.two_factor_row(user).locked_until

        frozen_time.tick(timedelta(minutes=1))
        assert two_factor.verify_second_factor(user, '000000') == 'locked'

        row = self.two_factor_row(user)
        assert row.locked_until == locked_until
        assert row.failed_attempts == settings.TWO_FACTOR_MAX_ATTEMPTS

    def test_lock_lasts_the_configured_time(self, user, enable_two_factor, settings):
        enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            two_factor.verify_second_factor(user, '000000')

        assert self.two_factor_row(user).locked_until == (
            timezone.now() + timedelta(minutes=settings.TWO_FACTOR_LOCKOUT_MINUTES)
        )

    def test_lock_expires_and_counter_restarts(self, user, enable_two_factor, settings, frozen_time):
        secret, _ = enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            two_factor.verify_second_factor(user, '000000')

        frozen_time.tick(timedelta(minutes=settings.TWO_FACTOR_LOCKOUT_MINUTES, seconds=1))

        assert two_factor.verify_second_factor(user, two_factor.totp(secret)) == 'ok'
        row = self.two_factor_row(user)
        assert row.failed_attempts == 0
        assert row.locked_until is None

    def test_a_failure_after_lock_expiry_starts_a_fresh_count(self, user, enable_two_factor, settings, frozen_time):
        enable_two_factor(user)
        for _ in range(settings.TWO_FACTOR_MAX_ATTEMPTS):
            two_factor.verify_second_factor(user, '000000')
        frozen_time.tick(timedelta(minutes=settings.TWO_FACTOR_LOCKOUT_MINUTES, seconds=1))

        assert two_factor.verify_second_factor(user, '000000') == 'invalid'

        assert self.two_factor_row(user).failed_attempts == 1

    def test_thresholds_come_from_settings(self, user, enable_two_factor, settings):
        secret, _ = enable_two_factor(user)
        settings.TWO_FACTOR_MAX_ATTEMPTS = 2

        two_factor.verify_second_factor(user, '000000')
        two_factor.verify_second_factor(user, '000000')

        assert two_factor.verify_second_factor(user, two_factor.totp(secret)) == 'locked'

    def test_user_without_two_factor_is_invalid(self, user):
        assert two_factor.verify_second_factor(user, '123456') == 'invalid'

    def test_pending_setup_cannot_satisfy_a_login_challenge(self, user):
        secret = two_factor.generate_secret()
        TwoFactorAuth.objects.create(
            user=user, secret_encrypted=two_factor.encrypt_secret(secret), is_enabled=False
        )

        assert two_factor.verify_second_factor(user, two_factor.totp(secret)) == 'invalid'
