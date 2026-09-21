"""
TOTP two-factor authentication (RFC 6238) for authenticator apps such as Aegis, Microsoft
Authenticator and Google Authenticator: code maths, secret encryption at rest, recovery codes,
and verification with replay protection and a per-account lockout.

The protocol parameters are fixed at the only values every one of those apps honours
(SHA-1, 6 digits, 30 s); the tunables (issuer, drift window, lockout) live in settings.
"""
import base64
import hashlib
import hmac
import logging
import re
import secrets
import struct
import time
from datetime import timedelta
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.authentication.jwt_utils import hash_token
from apps.authentication.models import RecoveryCode, TwoFactorAuth

logger = logging.getLogger(__name__)

DIGITS = 6
PERIOD = 30
ALGORITHM = 'SHA1'

RECOVERY_CODE_COUNT = 10
# No 0/O/1/I: recovery codes are read off paper and typed by hand.
# 3 groups of 4 characters at 5 bits each = 60 bits, enough for an unsalted SHA-256 at rest.
_RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
_RECOVERY_GROUPS = 3
_RECOVERY_GROUP_LENGTH = 4


def generate_secret():
    """New random 160-bit shared secret, base32-encoded as authenticator apps expect"""
    return base64.b32encode(secrets.token_bytes(20)).decode()


def hotp(secret, counter):
    """RFC 4226 HMAC-based one-time password"""
    digest = hmac.new(base64.b32decode(secret), struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10 ** DIGITS).zfill(DIGITS)


def totp(secret, at=None):
    """RFC 6238 time-based one-time password for the step containing `at` (epoch seconds, default now)"""
    return hotp(secret, int(time.time() if at is None else at) // PERIOD)


def matching_step(secret, code, at=None):
    """Time step whose code equals `code`, within ±TWO_FACTOR_WINDOW steps of `at`; None if no match"""
    if len(code) != DIGITS or not (code.isascii() and code.isdigit()):
        return None  # non-ASCII digits (isdigit() is True for them) would make compare_digest raise
    current = int(time.time() if at is None else at) // PERIOD
    for step in range(current - settings.TWO_FACTOR_WINDOW, current + settings.TWO_FACTOR_WINDOW + 1):
        if hmac.compare_digest(hotp(secret, step), code):
            return step
    return None


def provisioning_uri(secret, email):
    """otpauth:// URI (Key URI Format) that the frontend renders as a QR code"""
    issuer = settings.TWO_FACTOR_ISSUER
    # quote_via=quote: spaces must be %20, authenticator apps do not decode '+'
    query = urlencode(
        {'secret': secret, 'issuer': issuer, 'algorithm': ALGORITHM, 'digits': DIGITS, 'period': PERIOD},
        quote_via=quote,
    )
    return f"otpauth://totp/{quote(issuer, safe='')}:{quote(email, safe='')}?{query}"


def _fernet():
    key = settings.TWO_FACTOR_ENCRYPTION_KEY
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(f'two-factor:{settings.SECRET_KEY}'.encode()).digest())
    return Fernet(key)


def encrypt_secret(secret):
    """Encrypt a base32 TOTP secret for storage"""
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token):
    """Inverse of encrypt_secret; raises cryptography.fernet.InvalidToken on tampering or a wrong key"""
    return _fernet().decrypt(token.encode()).decode()


def normalize_code(code):
    """Accept what people actually type: '123 456', 'abcd-efgh-jkmn'"""
    return re.sub(r'[\s-]', '', code).upper()


def generate_recovery_codes(user):
    """Replace the user's recovery codes with a fresh batch; returns the plaintext codes (shown once)"""
    codes = [
        '-'.join(
            ''.join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(_RECOVERY_GROUP_LENGTH))
            for _ in range(_RECOVERY_GROUPS)
        )
        for _ in range(RECOVERY_CODE_COUNT)
    ]
    with transaction.atomic():
        RecoveryCode.objects.filter(user=user).delete()
        RecoveryCode.objects.bulk_create(
            [RecoveryCode(user=user, code_hash=hash_token(normalize_code(code))) for code in codes]
        )
    return codes


def _consume_code(record, user, code, now):
    """True if `code` is a valid, unspent TOTP or recovery code; marks it spent"""
    if len(code) == DIGITS and code.isdigit():
        step = matching_step(decrypt_secret(record.secret_encrypted), code)
        if step is None or step <= record.last_used_step:
            return False  # wrong, or replayed (RFC 6238 section 5.2)
        record.last_used_step = step
        return True
    # Atomic single use: only one of two concurrent requests can flip used_at
    return RecoveryCode.objects.filter(
        user=user, code_hash=hash_token(code), used_at__isnull=True
    ).update(used_at=now) == 1


def verify_second_factor(user, code):
    """
    Check a TOTP or recovery code for a user who has 2FA enabled.

    Returns 'ok', 'invalid' or 'locked'. Failures are counted per account: MAX_ATTEMPTS
    consecutive failures lock verification for LOCKOUT_MINUTES, because gateway rate limits are
    per IP/user and a 6-digit code is otherwise guessable. The row is held with SELECT ... FOR
    UPDATE so concurrent requests can neither spend one code twice nor dodge the counter.
    """
    code = normalize_code(code)
    with transaction.atomic():
        try:
            record = TwoFactorAuth.objects.select_for_update().get(user=user, is_enabled=True)
        except TwoFactorAuth.DoesNotExist:
            return 'invalid'

        now = timezone.now()
        if record.locked_until:
            if record.locked_until > now:
                return 'locked'  # do not touch the row: attempts must not extend the lock
            record.failed_attempts, record.locked_until = 0, None  # lock served, start counting afresh

        if _consume_code(record, user, code, now):
            record.failed_attempts, record.locked_until = 0, None
            result = 'ok'
        else:
            record.failed_attempts += 1
            if record.failed_attempts >= settings.TWO_FACTOR_MAX_ATTEMPTS:
                record.locked_until = now + timedelta(minutes=settings.TWO_FACTOR_LOCKOUT_MINUTES)
                logger.warning(
                    'Two-factor lockout for user %s after %s failed attempts', user.id, record.failed_attempts
                )
            result = 'invalid'

        record.save(update_fields=['last_used_step', 'failed_attempts', 'locked_until'])
    return result
