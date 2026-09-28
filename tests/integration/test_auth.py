"""Auth flows through the API gateway (real auth-service, real DB, real JWT)."""
from helpers import ok


def test_register_gives_a_valid_session(gw_user):
    body = ok(gw_user["client"].get("/api/v1/auth/verify"))
    assert body["data"]["user"]["email"] == gw_user["email"]


def test_logout_then_login_again(gw_user):
    c = gw_user["client"]
    ok(c.post("/api/v1/auth/logout"))
    assert c.get("/api/v1/auth/verify").status_code == 401
    body = ok(c.post("/api/v1/auth/login",
                     json={"email": gw_user["email"], "password": gw_user["password"]}))
    assert body["data"]["user"]["email"] == gw_user["email"]


def test_wrong_password_is_rejected(gw_user):
    resp = gw_user["client"].post("/api/v1/auth/login",
                                  json={"email": gw_user["email"], "password": "Wrong-Pass-999"})
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_protected_route_needs_a_session(gw):
    assert gw.get("/api/v1/users/me").status_code == 401


def test_delete_account(gw_user):
    c = gw_user["client"]
    ok(c.post("/api/v1/pets", json={"name": "Gate", "species": "dog"}), 201)
    body = ok(c.delete("/api/v1/auth/delete"))
    assert body["data"]["deleted"]["user_service"]["pets"] == 1
    resp = c.post("/api/v1/auth/login",
                  json={"email": gw_user["email"], "password": gw_user["password"]})
    assert resp.status_code == 401


def _refresh_cookie(client):
    return next(c.value for c in client.cookies.jar if c.name == "refresh_token")


def test_logout_revokes_the_refresh_token_server_side(gw_user):
    # The refresh cookie is path-scoped to /api/v1/auth/refresh, so a browser never sends it
    # to /logout: logout must revoke the session from the access token alone.
    c = gw_user["client"]
    stolen = _refresh_cookie(c)
    ok(c.post("/api/v1/auth/logout"))
    resp = c.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={stolen}"})
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "TOKEN_REVOKED"
    ok(c.post("/api/v1/auth/login",  # so teardown can delete the user
              json={"email": gw_user["email"], "password": gw_user["password"]}))


def test_logout_works_without_an_access_token(gw_user):
    # Idle tab: the 15-minute access cookie is gone but the 7-day refresh cookie is not.
    c = gw_user["client"]
    c.cookies.delete("access_token")
    ok(c.post("/api/v1/auth/logout"))
