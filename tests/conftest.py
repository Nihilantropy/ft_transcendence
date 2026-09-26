import os
import ssl
import uuid

import httpx
import pytest

from helpers import PASSWORD, Client, ok

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://api-gateway:8001")
EDGE_URL = os.environ.get("EDGE_URL", "https://nginx")
NGINX_CERT = os.environ.get("NGINX_CERT", "/nginx-ssl/selfsigned.crt")


def _tls():
    # nginx regenerates its self-signed cert on every start; trust exactly the current one.
    return ssl.create_default_context(cafile=NGINX_CERT)


@pytest.fixture(scope="session", autouse=True)
def stack_up():
    try:
        httpx.get(f"{GATEWAY_URL}/health", timeout=10).raise_for_status()
        httpx.get(f"{EDGE_URL}/health", verify=_tls(), timeout=10).raise_for_status()
    except (httpx.HTTPError, OSError) as e:
        pytest.exit(f"Stack not ready ({e!r}). Start it with `make up` (or run `make gate`).",
                    returncode=2)


@pytest.fixture
def gw():
    with Client(base_url=GATEWAY_URL, timeout=30) as c:
        yield c


@pytest.fixture
def edge():
    with Client(base_url=EDGE_URL, verify=_tls(), timeout=320) as c:
        yield c


def _throwaway_user(client):
    """Register a unique user (register already sets the session cookies), delete it after."""
    user = {"client": client, "email": f"gate-{uuid.uuid4().hex[:12]}@example.com",
            "password": PASSWORD}
    ok(client.post("/api/v1/auth/register", json={
        "email": user["email"], "password": PASSWORD, "password_confirm": PASSWORD}), 201)
    yield user
    resp = client.delete("/api/v1/auth/delete")
    if resp.status_code == 401:  # the test ended the session: log back in
        login = client.post("/api/v1/auth/login",
                            json={"email": user["email"], "password": user["password"]})
        if login.status_code == 401:  # the test already deleted the account
            return
        resp = client.delete("/api/v1/auth/delete")
    ok(resp)


@pytest.fixture
def gw_user(gw):
    yield from _throwaway_user(gw)


@pytest.fixture
def edge_user(edge):
    yield from _throwaway_user(edge)
