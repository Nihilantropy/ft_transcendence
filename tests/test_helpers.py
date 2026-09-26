"""Offline check of the retrying client (no stack needed)."""
import httpx

from helpers import Client


def test_429_with_negative_retry_after_is_retried():
    # The gateway's Retry-After is a Redis TTL: -2 when the key expired between INCR and TTL.
    replies = iter([httpx.Response(429, headers={"Retry-After": "-2"}), httpx.Response(200)])
    with Client(transport=httpx.MockTransport(lambda req: next(replies)), base_url="http://x") as c:
        assert c.get("/").status_code == 200
