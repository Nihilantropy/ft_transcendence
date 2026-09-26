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
