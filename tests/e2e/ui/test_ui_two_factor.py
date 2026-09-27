"""Two-factor authentication and profile details in Chromium, through nginx."""
import re

from playwright.sync_api import expect

from helpers import retry_429, totp

MFA = {"success": True, "error": None, "timestamp": "2026-09-27T00:00:00",
       "data": {"mfa_required": True, "mfa_token": "challenge"}}


def _error(code):
    return {"success": False, "data": None, "timestamp": "2026-09-27T00:00:00",
            "error": {"code": code, "message": code, "details": {}}}


def _log_out(page):
    # The real endpoint, never context.clear_cookies() (it races with the next request).
    retry_429(lambda: page.context.request.post("/api/v1/auth/logout"))


def _password_step(page, email, password):
    page.goto("/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Log in").click()
    code = page.get_by_label("Authentication code", exact=True)
    expect(code).to_be_focused()
    return code


def test_login_asks_for_the_code(page, two_factor):
    _log_out(page)
    code = _password_step(page, two_factor["email"], two_factor["password"])
    expect(page.get_by_role("heading", name="Two-step verification")).to_be_visible()
    code.fill(totp(two_factor["totp_secret"], step=1))  # enable spent the current step
    page.get_by_role("button", name="Verify").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_wrong_code_is_shown_on_the_field(page, two_factor):
    sent = []
    page.on("request", lambda r: sent.append(r.url) if r.url.endswith("/auth/login/2fa") else None)
    _log_out(page)
    code = _password_step(page, two_factor["email"], two_factor["password"])
    code.fill("12345")
    page.get_by_role("button", name="Verify").click()
    expect(page.get_by_text("Enter the 6 digits shown in your app.").first).to_be_visible()
    assert sent == []  # caught in the browser

    code.fill("000000")
    page.get_by_role("button", name="Verify").click()
    expect(code).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_text("That code isn't right. Check your app and try again.")).to_be_visible()
    # Ends mid-login on purpose: ui_user's teardown must finish the second step itself.


def test_recovery_code_login(page, two_factor):
    _log_out(page)
    _password_step(page, two_factor["email"], two_factor["password"])
    page.get_by_role("button", name="Use a recovery code instead").click()
    field = page.get_by_label("Recovery code", exact=True)
    expect(field).to_be_focused()
    field.fill(two_factor["recovery_codes"].pop(0).lower())
    page.get_by_role("button", name="Verify").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_expired_challenge_goes_back_to_the_password_step(page):
    page.route("**/api/v1/auth/login", lambda r: r.fulfill(json=MFA))
    page.route("**/api/v1/auth/login/2fa", lambda r: r.fulfill(status=401, json=_error("TOKEN_EXPIRED")))
    code = _password_step(page, "someone@example.com", "Whatever-123")
    code.fill("123456")
    page.get_by_role("button", name="Verify").click()
    expect(page.get_by_text("The code request expired — log in again.")).to_be_visible()
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()
    expect(page.get_by_label("Email")).to_have_value("someone@example.com")
    # mfa_required set no cookie, so it must not leave a "session" hint behind either
    assert page.evaluate("localStorage.getItem('session')") is None


def test_lockout_has_its_own_message(page):
    page.route("**/api/v1/auth/login", lambda r: r.fulfill(json=MFA))
    page.route("**/api/v1/auth/login/2fa", lambda r: r.fulfill(
        status=429, headers={"Retry-After": "1"}, json=_error("RATE_LIMIT_EXCEEDED")))
    code = _password_step(page, "someone@example.com", "Whatever-123")
    code.fill("123456")
    page.get_by_role("button", name="Verify").click()
    # api.ts retries a 429 twice (Retry-After: 1 s each) before giving up
    expect(page.get_by_text("Too many wrong codes. Wait 15 minutes and try again.")).to_be_visible(timeout=15_000)
    expect(code).to_have_attribute("aria-invalid", "true")
