"""The gateway owns identity: client-sent identity headers and non-access tokens must not work."""
from conftest import GATEWAY_URL
from helpers import Client, ok


def _user_id(user):
    return ok(user["client"].get("/api/v1/auth/verify"))["data"]["user"]["id"]


def test_client_cannot_claim_the_admin_role(gw_user, edge_user):
    victim_pet = ok(gw_user["client"].post(
        "/api/v1/pets", json={"name": "Victim", "species": "dog"}), 201)["data"]
    # user-service returns every pet to X-User-Role: admin
    pets = ok(edge_user["client"].get("/api/v1/pets", headers={"X-User-Role": "admin"}))["data"]
    assert victim_pet["id"] not in [p["id"] for p in pets]


def test_client_cannot_claim_another_user_id(gw_user, edge_user):
    victim_id, attacker_id = _user_id(gw_user), _user_id(edge_user)
    me = ok(edge_user["client"].get("/api/v1/users/me", headers={"X-User-ID": victim_id}))["data"]
    assert me["user_id"] == attacker_id


def test_refresh_token_is_not_accepted_as_an_access_token(gw_user):
    c = gw_user["client"]
    refresh = next(k.value for k in c.cookies.jar if k.name == "refresh_token")
    with Client(base_url=c.base_url, timeout=30) as attacker:
        attacker.cookies.set("access_token", refresh)
        resp = attacker.get("/api/v1/users/me")
    assert resp.status_code == 401, resp.text


def test_anonymous_refresh_does_not_get_another_users_session(gw_user):
    """A cookie-less caller must never be handed the session the gateway last saw."""
    with Client(base_url=GATEWAY_URL, timeout=30) as anonymous:
        resp = anonymous.post("/api/v1/auth/refresh")
    assert resp.status_code == 401, resp.text
