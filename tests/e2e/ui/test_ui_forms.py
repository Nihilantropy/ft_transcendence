"""Browser-side validation: nothing invalid is sent, errors are summarised and focused."""
import re

from playwright.sync_api import expect

from helpers import PASSWORD


def spy(page, pattern):
    """Count requests matching `pattern` (they still go through)."""
    calls = []
    page.on("request", lambda r: calls.append(r.url) if re.search(pattern, r.url) else None)
    return calls


def test_register_invalid_sends_nothing(page):
    calls = spy(page, r"/api/v1/auth/register")
    page.goto("/register")
    page.get_by_label("Email").fill("not-an-email")
    page.get_by_label("Password", exact=True).fill("short")
    page.get_by_role("button", name="Create account").click()
    summary = page.get_by_role("alert").filter(has_text="Please fix these fields")
    expect(summary).to_contain_text("Enter a valid email address.")
    expect(summary).to_contain_text("Use at least 8 characters, with a letter and a number.")
    expect(summary).to_contain_text("This field is required.")  # confirm password left empty
    expect(page.get_by_label("Email")).to_be_focused()
    expect(page.get_by_label("Email")).to_have_attribute("aria-invalid", "true")
    assert calls == []


def test_password_mismatch_caught_in_browser(page, ui_user):
    calls = spy(page, r"/api/v1/auth/register")
    page.goto("/register")
    page.get_by_label("Email").fill(ui_user["email"])
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_label("Confirm password").fill(PASSWORD + "x")
    page.get_by_role("button", name="Create account").click()
    expect(page.get_by_label("Confirm password")).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_text("Passwords don't match.").first).to_be_visible()
    assert calls == []


def test_password_reveal_toggle(page):
    page.goto("/login")
    field = page.get_by_label("Password", exact=True)
    field.fill("Secret-123")
    toggle = page.get_by_role("button", name="Show password")
    expect(toggle).to_have_attribute("aria-pressed", "false")
    toggle.click()
    expect(field).to_have_attribute("type", "text")
    expect(toggle).to_have_attribute("aria-pressed", "true")
    toggle.click()
    expect(field).to_have_attribute("type", "password")


def test_live_password_rules(page):
    page.goto("/register")
    page.get_by_label("Password", exact=True).fill("abc")
    expect(page.locator('[data-rule="length"]')).to_have_attribute("data-met", "false")
    expect(page.locator('[data-rule="letter"]')).to_have_attribute("data-met", "true")
    page.get_by_label("Password", exact=True).fill("abcdefg1")
    expect(page.locator('[data-rule="length"]')).to_have_attribute("data-met", "true")
    expect(page.locator('[data-rule="number"]')).to_have_attribute("data-met", "true")
