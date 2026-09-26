import re
import uuid

from playwright.sync_api import expect

from helpers import PASSWORD, retry_429


def test_register_lands_on_analyze(page, registered):
    expect(page.get_by_role("heading", name="Analyze a photo")).to_be_visible()
    expect(page.get_by_role("navigation", name="Main")).to_be_visible()


def test_login_wrong_password_is_friendly(page):
    page.goto("/login")
    page.get_by_label("Email").fill(f"gate-{uuid.uuid4().hex[:12]}@example.com")
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="Log in").click()
    expect(page.get_by_text("Wrong email or password.")).to_be_visible()


def test_login_after_logout_cookies_cleared(page, registered):
    # ponytail: page.context.clear_cookies() is a CDP-level shortcut that raced with the very
    # next request in this Playwright/Chromium build — context.cookies() reported the cookies
    # gone, but the following navigation could still carry the stale access_token (confirmed at
    # the wire level). Going through the real /auth/logout endpoint clears cookies the way a
    # browser actually does it (Set-Cookie expiry on the response), which doesn't race.
    retry_429(lambda: page.context.request.post("/api/v1/auth/logout"))
    page.goto("/login")
    page.get_by_label("Email").fill(registered["email"])
    page.get_by_label("Password", exact=True).fill(registered["password"])
    page.get_by_role("button", name="Log in").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_protected_page_redirects_when_logged_out(page):
    page.goto("/analyze")
    expect(page).to_have_url(re.compile(r"/$"))


def test_logged_in_user_skips_landing(page, registered):
    page.goto("/")
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_expired_access_token_is_refreshed(page, registered):
    # The access cookie expiring (15 min) must not log the user out: one refresh, then carry on.
    # ponytail: page.context.clear_cookies(name="access_token") raced with the next request in
    # this Playwright/Chromium build - context.cookies() reported it gone while the wire could
    # still carry the stale value (same class of race as test_login_after_logout_cookies_cleared
    # above). Overwriting the cookie with add_cookies (a CDP-level call, works on HttpOnly cookies)
    # takes effect deterministically, and asserting on the actual refresh response proves a refresh
    # really happened rather than the stale token simply still working.
    page.context.add_cookies([{"name": "access_token", "value": "garbage", "url": page.url}])
    with page.expect_response("**/api/v1/auth/refresh") as refresh_info:
        page.reload()
    assert refresh_info.value.ok
    expect(page).to_have_url(re.compile(r"/analyze$"))
    expect(page.get_by_role("heading", name="Analyze a photo")).to_be_visible()
