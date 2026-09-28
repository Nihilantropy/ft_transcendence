"""Two-factor authentication and profile details in Chromium, through nginx."""
import re

from playwright.sync_api import expect

from helpers import axe_scan, describe_violations, retry_429, totp

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
    expect(page.get_by_text(
        "That code isn't right. Check your app and try again, or wait for the next code.")).to_be_visible()
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
    # /auth/login/2fa is on api.ts's no-429-retry list: the lockout copy shows immediately.
    expect(page.get_by_text("Too many wrong codes. Wait 15 minutes and try again.")).to_be_visible()
    expect(code).to_have_attribute("aria-invalid", "true")


NEW_PASSWORD = "Gate-Test-Pass-456"


def test_profile_names_are_saved(page, registered):
    page.goto("/profile")
    details = page.get_by_role("form", name="Your details")
    details.get_by_label("First name").fill("Ada")
    details.get_by_label("Last name").fill("Lovelace")
    details.get_by_role("button", name="Save details").click()
    expect(page.get_by_text("Details saved")).to_be_visible()
    page.reload()
    details = page.get_by_role("form", name="Your details")
    expect(details.get_by_label("First name")).to_have_value("Ada")
    expect(details.get_by_label("Last name")).to_have_value("Lovelace")


def test_email_change_asks_for_the_password(page, registered):
    page.goto("/profile")
    details = page.get_by_role("form", name="Your details")
    expect(details.get_by_label("Email")).to_have_value(registered["email"])
    expect(details.get_by_label("Current password")).to_have_count(0)
    new_email = registered["email"].replace("gate-", "gate-moved-")
    details.get_by_label("Email").fill(new_email)
    details.get_by_label("Current password").fill(registered["password"])
    details.get_by_role("button", name="Save details").click()
    expect(page.get_by_text("Details saved")).to_be_visible()
    registered["email"] = new_email  # teardown logs in with it if needed
    expect(details.get_by_label("Current password")).to_have_count(0)
    page.reload()
    expect(page.get_by_role("form", name="Your details").get_by_label("Email")).to_have_value(new_email)


def test_email_change_with_two_factor_needs_a_code(page, two_factor):
    page.goto("/profile")
    details = page.get_by_role("form", name="Your details")
    expect(details.get_by_label("Email")).to_have_value(two_factor["email"])
    new_email = two_factor["email"].replace("gate-", "gate-moved-")
    details.get_by_label("Email").fill(new_email)
    code = details.get_by_label("Authentication or recovery code", exact=True)
    expect(code).to_be_visible()
    # Both forms now show a current-password and a code field: ids must still be unique.
    violations = axe_scan(page)
    assert not violations, describe_violations(violations)

    details.get_by_label("Current password").fill(two_factor["password"])
    code.fill("000000")
    details.get_by_role("button", name="Save details").click()
    expect(code).to_have_attribute("aria-invalid", "true")
    code.fill(two_factor["recovery_codes"].pop(0))
    details.get_by_role("button", name="Save details").click()
    expect(page.get_by_text("Details saved")).to_be_visible()
    two_factor["email"] = new_email


def test_change_password_with_two_factor_needs_a_code(page, two_factor):
    page.goto("/profile")
    form = page.get_by_role("form", name="Change password")
    form.get_by_label("Current password").fill(two_factor["password"])
    form.get_by_label("New password", exact=True).fill(NEW_PASSWORD)
    form.get_by_label("Confirm new password").fill(NEW_PASSWORD)
    form.get_by_role("button", name="Change password").click()
    code = form.get_by_label("Authentication or recovery code", exact=True)
    expect(code).to_be_focused()  # required: caught in the browser, nothing sent
    code.fill(two_factor["recovery_codes"].pop(0))
    form.get_by_role("button", name="Change password").click()
    expect(page.get_by_text("Password changed")).to_be_visible()
    two_factor["password"] = NEW_PASSWORD


def _turn_on_from_profile(page, user):
    """Profile → Turn on → read the key from the page → confirm; returns the recovery-codes dialog."""
    page.goto("/profile")
    section = page.get_by_role("region", name="Two-factor authentication")
    expect(section).to_contain_text("Status: off")
    section.get_by_role("button", name="Turn on", exact=True).click()
    dialog = page.get_by_role("dialog", name="Set up two-factor authentication")
    expect(dialog.get_by_role("img", name="QR code to add SmartBreeds to your authenticator app")).to_be_visible()
    key = dialog.locator("code")
    expect(key).to_have_text(re.compile(r"^[A-Z2-7]{4}( [A-Z2-7]{4}){7}$"))
    secret = key.inner_text().replace(" ", "")
    dialog.get_by_role("button", name="Next").click()
    dialog.get_by_label("Current password").fill(user["password"])
    dialog.get_by_label("Authentication code", exact=True).fill(totp(secret))
    dialog.get_by_role("button", name="Confirm and turn on").click()
    codes = page.get_by_role("dialog", name="Your recovery codes")
    items = codes.get_by_role("listitem")
    expect(items).to_have_count(10)
    user["totp_secret"] = secret
    user["recovery_codes"] = items.all_inner_texts()
    return codes


def test_turn_on_shows_the_recovery_codes_once(page, registered):
    codes = _turn_on_from_profile(page, registered)
    assert all(re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}", c) for c in registered["recovery_codes"])
    page.emulate_media(color_scheme="dark")
    violations = axe_scan(page)  # the open dialog, dark theme
    assert not violations, describe_violations(violations)

    done = codes.get_by_role("button", name="Done")
    expect(done).to_be_disabled()
    with page.expect_download() as download:
        codes.get_by_role("button", name="Download .txt").click()
    assert download.value.suggested_filename == "smartbreeds-recovery-codes.txt"
    codes.get_by_label("I've saved my recovery codes").check()
    done.click()
    expect(codes).to_be_hidden()
    expect(page.get_by_role("region", name="Two-factor authentication")).to_contain_text("Status: on")
    expect(page.get_by_role("form", name="Change password")
           .get_by_label("Authentication or recovery code", exact=True)).to_be_visible()


def test_escape_does_not_lose_the_recovery_codes(page, registered):
    # Chromium's CloseWatcher makes the 2nd Escape (no fresh user activation) non-cancelable, so
    # onCancel's preventDefault only stops the 1st — onClose must catch the 2nd and reopen.
    codes = _turn_on_from_profile(page, registered)
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    expect(codes).to_be_visible()
    expect(codes.get_by_role("listitem")).to_have_count(10)
    codes.get_by_label("I've saved my recovery codes").check()
    codes.get_by_role("button", name="Done").click()
    expect(codes).to_be_hidden()
    expect(page.get_by_role("region", name="Two-factor authentication")).to_contain_text("Status: on")


def test_two_factor_round_trip_from_the_ui(page, registered):
    codes = _turn_on_from_profile(page, registered)
    codes.get_by_label("I've saved my recovery codes").check()
    codes.get_by_role("button", name="Done").click()
    expect(codes).to_be_hidden()

    page.get_by_role("button", name="Log out").click()
    expect(page).to_have_url(re.compile(r"/$"))
    page.goto("/login")
    page.get_by_label("Email").fill(registered["email"])
    page.get_by_label("Password", exact=True).fill(registered["password"])
    page.get_by_role("button", name="Log in").click()
    page.get_by_label("Authentication code", exact=True).fill(totp(registered["totp_secret"], step=1))
    page.get_by_role("button", name="Verify").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))

    page.goto("/profile")
    section = page.get_by_role("region", name="Two-factor authentication")
    section.get_by_role("button", name="Turn off", exact=True).click()
    dialog = page.get_by_role("dialog", name="Turn off two-factor authentication")
    dialog.get_by_label("Current password").fill(registered["password"])
    dialog.get_by_label("Authentication or recovery code", exact=True).fill(registered["recovery_codes"].pop(0))
    dialog.get_by_role("button", name="Confirm and turn off").click()
    expect(section).to_contain_text("Status: off")
