import base64
import hashlib
import hmac
import struct
import time

import httpx

PASSWORD = "Gate-Test-Pass-123"


class Client(httpx.Client):
    # ponytail: retries 429 by sleeping Retry-After (default 5 s, 12 tries ≈ one gateway window).
    # Keeps a growing suite green against the real nginx (200 r/m, burst 20) and gateway
    # (60 r/m) limits at the cost of wall-clock time; exempting the tester would stop the gate
    # testing the real config. Revisit if gate runtime becomes a problem.
    def send(self, request, **kwargs):
        for _ in range(12):
            resp = super().send(request, **kwargs)
            if resp.status_code != 429:
                return resp
            resp.close()
            # The gateway sends Redis TTL, which is -2/-1 if the key expired meanwhile; an
            # HTTP-date or missing header falls back to 5 s.
            after = resp.headers.get("Retry-After", "")
            time.sleep(max(1, int(after)) if after.lstrip("-").isdigit() else 5)
        return resp


def ok(resp, status=200):
    assert resp.status_code == status, (
        f"{resp.request.method} {resp.request.url.path} -> {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else None


def totp(secret, at=None, step=0):
    """RFC 6238 TOTP (SHA-1, 6 digits, 30 s) for a base32 secret, at epoch `at` (default now),
    shifted by `step` periods. auth-service never accepts a step twice, so the code after one it
    already took is totp(secret, step=1) — its ±1 step drift window accepts it straight away."""
    counter = int(time.time() if at is None else at) // 30 + step
    key = base64.b32decode(secret.replace(" ", "").upper())
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def second_factor(user):
    """A code that completes a 2FA login for a fixture user: an unused recovery code if the test
    left one (popped, so it is never reused), else the next TOTP step."""
    if user.get("recovery_codes"):
        return user["recovery_codes"].pop()
    return totp(user["totp_secret"], step=1)
