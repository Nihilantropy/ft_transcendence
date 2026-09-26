"""Keyboard, focus, titles and reflow checks (WCAG 2.1 AA). axe runs on every test (conftest)."""
import re

from playwright.sync_api import expect


def tab_to(page, locator, limit=40):
    """Press Tab until `locator` has focus; fail if it never does."""
    for _ in range(limit):
        page.keyboard.press("Tab")
        if locator.evaluate("el => el === document.activeElement"):
            return
    raise AssertionError(f"never reached {locator} with Tab")


def test_skip_link_moves_to_main(page):
    page.goto("/")
    page.keyboard.press("Tab")
    skip = page.get_by_role("link", name="Skip to content")
    expect(skip).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator("#main")).to_be_focused()


def test_navigation_moves_focus_to_heading_and_sets_title(page):
    page.goto("/")
    page.get_by_role("link", name="Privacy").click()
    expect(page.get_by_role("heading", level=1, name="Privacy Policy")).to_be_focused()
    expect(page).to_have_title("Privacy Policy · SmartBreeds")


def test_accessibility_statement_is_public(page):
    page.goto("/")
    page.get_by_role("link", name="Accessibility").click()
    expect(page).to_have_url(re.compile(r"/accessibility$"))
    expect(page.get_by_role("heading", level=1, name="Accessibility statement")).to_be_visible()
