"""Two-factor authentication and profile editing through the gateway (real auth-service, real DB)."""
from helpers import ok, totp

NEW_PASSWORD = "Gate-Test-Pass-456"


def _login(c, user):
    return c.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})


def _login_2fa(c, token, code):
    return c.post("/api/v1/auth/login/2fa", json={"mfa_token": token, "code": code})


def _turn_on(user):
    """setup + enable with a TOTP computed from the returned secret; secret and codes kept on `user`."""
    c = user["client"]
    setup = ok(c.post("/api/v1/auth/2fa/setup"))["data"]
    assert setup["otpauth_uri"].startswith("otpauth://totp/")
    assert (setup["algorithm"], setup["digits"], setup["period"]) == ("SHA1", 6, 30)
    body = ok(c.post("/api/v1/auth/2fa/enable",
                     json={"current_password": user["password"], "code": totp(setup["secret"])}))
    user["totp_secret"] = setup["secret"]
    user["recovery_codes"] = body["data"]["recovery_codes"]


def _challenge(c, user):
    """Log out, then the password step: returns the mfa_token and checks it granted no session."""
    ok(c.post("/api/v1/auth/logout"))
    resp = _login(c, user)
    data = ok(resp)["data"]
    assert data["mfa_required"] is True
    assert resp.headers.get_list("set-cookie") == []
    return data["mfa_token"]


def test_two_factor_login_cycle(gw_user):
    c = gw_user["client"]
    _turn_on(gw_user)
    assert len(gw_user["recovery_codes"]) == 10
    assert ok(c.get("/api/v1/auth/verify"))["data"]["user"]["two_factor_enabled"] is True

    token = _challenge(c, gw_user)
    assert c.get("/api/v1/auth/verify").status_code == 401  # the password alone is no session
    # Signed with the same key as an access token: the gateway must still refuse it as one.
    assert c.get("/api/v1/users/me", headers={"Cookie": f"access_token={token}"}).status_code == 401

    # enable spent the current 30 s step (replay protection): the next step is the next valid code
    ok(_login_2fa(c, token, totp(gw_user["totp_secret"], step=1)))
    assert ok(c.get("/api/v1/auth/verify"))["data"]["user"]["email"] == gw_user["email"]


def test_recovery_code_works_once(gw_user):
    c = gw_user["client"]
    _turn_on(gw_user)
    code = gw_user["recovery_codes"].pop(0)

    token = _challenge(c, gw_user)
    ok(_login_2fa(c, token, code.lower().replace("-", " ")))  # typed the way people type

    token = _challenge(c, gw_user)
    resp = _login_2fa(c, token, code)
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "INVALID_2FA_CODE"
    ok(_login_2fa(c, token, gw_user["recovery_codes"].pop(0)))  # same challenge, a fresh code


def test_change_password_needs_a_code_then_turn_off(gw_user):
    c = gw_user["client"]
    _turn_on(gw_user)
    body = {"current_password": gw_user["password"], "new_password": NEW_PASSWORD,
            "new_password_confirm": NEW_PASSWORD}

    resp = c.put("/api/v1/auth/change-password", json=body)
    assert resp.status_code == 422, resp.text
    assert "code" in resp.json()["error"]["details"]
    resp = c.put("/api/v1/auth/change-password", json={**body, "code": "000000"})
    assert (resp.status_code, resp.json()["error"]["code"]) == (422, "INVALID_2FA_CODE")

    ok(c.put("/api/v1/auth/change-password", json={**body, "code": gw_user["recovery_codes"].pop(0)}))
    gw_user["password"] = NEW_PASSWORD  # teardown logs back in with it

    ok(c.post("/api/v1/auth/2fa/disable",
              json={"current_password": NEW_PASSWORD, "code": gw_user["recovery_codes"].pop(0)}))
    assert ok(c.get("/api/v1/auth/verify"))["data"]["user"]["two_factor_enabled"] is False
    ok(c.post("/api/v1/auth/logout"))
    data = ok(_login(c, gw_user))["data"]
    assert "mfa_required" not in data
    assert data["user"]["email"] == gw_user["email"]


def test_two_factor_error_codes(gw_user):
    c = gw_user["client"]
    password = gw_user["password"]

    resp = c.post("/api/v1/auth/2fa/enable", json={"current_password": password, "code": "123456"})
    assert (resp.status_code, resp.json()["error"]["code"]) == (409, "TWO_FACTOR_SETUP_REQUIRED")
    resp = c.post("/api/v1/auth/2fa/disable", json={"current_password": password, "code": "123456"})
    assert (resp.status_code, resp.json()["error"]["code"]) == (409, "TWO_FACTOR_NOT_ENABLED")

    secret = ok(c.post("/api/v1/auth/2fa/setup"))["data"]["secret"]
    resp = c.post("/api/v1/auth/2fa/enable", json={"current_password": "Wrong-Pass-999", "code": totp(secret)})
    assert resp.status_code == 422, resp.text
    assert "current_password" in resp.json()["error"]["details"]
    resp = c.post("/api/v1/auth/2fa/enable", json={"current_password": password, "code": "000000"})
    assert (resp.status_code, resp.json()["error"]["code"]) == (422, "INVALID_2FA_CODE")

    body = ok(c.post("/api/v1/auth/2fa/enable", json={"current_password": password, "code": totp(secret)}))
    gw_user["totp_secret"], gw_user["recovery_codes"] = secret, body["data"]["recovery_codes"]
    resp = c.post("/api/v1/auth/2fa/setup")
    assert (resp.status_code, resp.json()["error"]["code"]) == (409, "TWO_FACTOR_ALREADY_ENABLED")

    resp = _login_2fa(c, "not-a-token", "123456")
    assert (resp.status_code, resp.json()["error"]["code"]) == (401, "INVALID_TOKEN")


def test_profile_names_are_saved(gw_user):
    c = gw_user["client"]
    user = ok(c.patch("/api/v1/auth/me", json={"first_name": "Ada", "last_name": "Lovelace"}))["data"]["user"]
    assert (user["first_name"], user["last_name"]) == ("Ada", "Lovelace")
    user = ok(c.get("/api/v1/auth/verify"))["data"]["user"]
    assert (user["first_name"], user["last_name"]) == ("Ada", "Lovelace")


def test_email_change_needs_the_password_and_renews_the_session(gw_user):
    c = gw_user["client"]
    new_email = gw_user["email"].replace("gate-", "gate-moved-")

    resp = c.patch("/api/v1/auth/me", json={"email": new_email})
    assert resp.status_code == 422, resp.text
    assert "current_password" in resp.json()["error"]["details"]

    resp = c.patch("/api/v1/auth/me", json={"email": new_email, "current_password": gw_user["password"]})
    ok(resp)
    gw_user["email"] = new_email  # teardown logs in with it if needed
    assert "access_token" in resp.cookies  # the token embeds the email: re-issued
    assert ok(c.get("/api/v1/auth/verify"))["data"]["user"]["email"] == new_email
