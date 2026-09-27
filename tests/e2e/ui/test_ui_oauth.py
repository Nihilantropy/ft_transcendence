"""Log in with 42 in Chromium, through nginx. The 42 intra itself is never reached."""
import re

import pytest
from playwright.sync_api import expect

START = "/api/v1/auth/oauth/42/start"
# Stands in for the intra's authorize page; complete enough for the axe watchdog.
INTRA_PAGE = ('<!doctype html><html lang="en"><head><title>42 intra</title></head>'
              '<body><main><h1>42 intra</h1></main></body></html>')
FAILED = "Logging in with 42 didn't work. Try again, or use your email and password."
UNAVAILABLE = "Logging in with 42 isn't available right now. Use your email and password."
EXISTS = "An account with this email already exists. Log in with your password."


def _error(code):
    return {"success": False, "data": None, "timestamp": "2026-09-27T00:00:00",
            "error": {"code": code, "message": code, "details": {}}}


@pytest.mark.parametrize("path", ["/login", "/register"])
def test_login_and_register_offer_42(page, path):
    page.goto(path)
    expect(page.get_by_role("link", name="Log in with 42")).to_have_attribute("href", START)


def test_42_link_leaves_for_the_intra_or_explains(page):
    """The real redirect chain (nginx → gateway → auth-service), under the CSP watchdog."""
    page.route("https://api.intra.42.fr/**",
               lambda r: r.fulfill(body=INTRA_PAGE, content_type="text/html"))
    page.goto("/login")
    page.get_by_role("link", name="Log in with 42").click()
    intra = page.get_by_role("heading", name="42 intra")
    expect(intra.or_(page.get_by_text(UNAVAILABLE))).to_be_visible()
    if intra.is_visible():  # srcs/auth-service/.env has a real intra application
        assert re.match(r"^https://api\.intra\.42\.fr/oauth/authorize\?", page.url), page.url
        assert "state=" in page.url and "client_id=" in page.url
    else:  # empty OAUTH_42_CLIENT_ID/SECRET
        expect(page).to_have_url(re.compile(r"/login$"))


@pytest.mark.parametrize("state, copy", [("error", FAILED), ("unavailable", UNAVAILABLE), ("exists", EXISTS)])
def test_failed_42_login_explains_and_cleans_the_url(page, state, copy):
    page.goto(f"/login?oauth={state}")
    expect(page.get_by_text(copy)).to_be_visible()
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_label("Email")).to_be_editable()  # the password form stays usable


def test_42_login_with_two_factor_asks_for_the_code(page):
    sent = []

    def handle(route):
        sent.append(route.request.post_data_json)
        route.fulfill(status=401, json=_error("INVALID_2FA_CODE"))

    page.route("**/api/v1/auth/login/2fa", handle)
    page.goto("/login?oauth=mfa#challenge-from-42")
    expect(page.get_by_role("heading", name="Two-step verification")).to_be_visible()
    expect(page).to_have_url(re.compile(r"/login$"))  # the challenge left the address bar
    code = page.get_by_label("Authentication code", exact=True)
    expect(code).to_be_focused()
    code.fill("123456")
    page.get_by_role("button", name="Verify").click()
    # A rejected code is field-level copy (validation.code_wrong), same as any other 2FA login —
    # error.INVALID_2FA_CODE (the brief's wording) is the ErrorNote fallback, unreachable here since
    # CodeStep's schema always has a `code` field claiming the error (see validation.serverFieldKey).
    expect(page.get_by_text(
        "That code isn't right. Check your app and try again, or wait for the next code.")).to_be_visible()
    assert sent == [{"mfa_token": "challenge-from-42", "code": "123456"}]


def test_back_from_42_the_session_is_checked(page, registered):
    """First 42 login on this browser: no session hint yet, the callback's cookies are there."""
    page.evaluate("localStorage.removeItem('session')")
    page.goto("/analyze")
    expect(page).to_have_url(re.compile(r"/$"))  # control: no hint, no marker → treated as anonymous

    page.goto("/analyze?oauth=ok")
    expect(page.get_by_role("heading", name="Analyze a photo")).to_be_visible()
    expect(page).to_have_url(re.compile(r"/analyze$"))
    assert page.evaluate("localStorage.getItem('session')") == "1"
