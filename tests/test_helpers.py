"""Offline check of the retrying client (no stack needed)."""
import httpx

from helpers import Client, second_factor, totp

# RFC 6238 appendix B: the SHA-1 seed is the ASCII string "12345678901234567890".
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


def test_429_with_negative_retry_after_is_retried():
    # The gateway's Retry-After is a Redis TTL: -2 when the key expired between INCR and TTL.
    replies = iter([httpx.Response(429, headers={"Retry-After": "-2"}), httpx.Response(200)])
    with Client(transport=httpx.MockTransport(lambda req: next(replies)), base_url="http://x") as c:
        assert c.get("/").status_code == 200


def test_totp_matches_the_rfc_6238_vectors():
    # The RFC lists 8-digit values; authenticator apps (and auth-service) use the last 6.
    vectors = {59: "287082", 1111111109: "081804", 1111111111: "050471",
               1234567890: "005924", 2000000000: "279037", 20000000000: "353130"}
    for at, code in vectors.items():
        assert totp(RFC_SECRET, at=at) == code, at


def test_totp_step_moves_whole_periods():
    assert totp(RFC_SECRET, at=29, step=1) == totp(RFC_SECRET, at=59)


def test_second_factor_spends_a_recovery_code_before_falling_back_to_totp():
    user = {"totp_secret": RFC_SECRET, "recovery_codes": ["AAAA-BBBB-CCCC", "DDDD-EEEE-FFFF"]}
    assert second_factor(user) == "DDDD-EEEE-FFFF"
    assert user["recovery_codes"] == ["AAAA-BBBB-CCCC"]
    code = second_factor({"totp_secret": RFC_SECRET, "recovery_codes": []})
    assert len(code) == 6 and code.isdigit()
