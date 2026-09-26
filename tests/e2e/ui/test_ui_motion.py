"""Line-art animations: they run, and a paused page still shows complete drawings."""
import pytest
from playwright.sync_api import expect


def test_landing_dog_says_hello(page):
    page.goto("/")
    ear = page.locator(".ill-hello .ill-ear-l")
    expect(ear).to_have_count(1)
    assert page.evaluate("getComputedStyle(document.querySelector('.ill-hello .ill-ear-l')).animationName") != "none"


def test_paused_illustrations_are_fully_drawn(page):
    page.add_init_script("localStorage.setItem('motion', 'paused')")
    page.goto("/")
    path = ".ill-hello path"
    assert page.evaluate(f"getComputedStyle(document.querySelector('{path}')).animationName") == "none"
    # No leftover dash offset: the stroke is complete.
    assert page.evaluate(f"getComputedStyle(document.querySelector('{path}')).strokeDashoffset") in ("0", "0px")


def test_sky_has_five_hidden_cats(page):
    page.goto("/")
    sky = page.locator(".sky")
    expect(sky).to_have_attribute("aria-hidden", "true")
    expect(sky.locator(".sky-cat")).to_have_count(5)


def test_pause_toggle_persists(page):
    page.goto("/")
    toggle = page.get_by_role("button", name="Pause animations")
    expect(toggle).to_have_attribute("aria-pressed", "false")
    toggle.click()
    expect(page.locator("html")).to_have_attribute("data-motion", "paused")
    page.reload()
    expect(page.locator("html")).to_have_attribute("data-motion", "paused")
    expect(page.get_by_role("button", name="Pause animations")).to_have_attribute("aria-pressed", "true")
    assert page.evaluate("getComputedStyle(document.querySelector('.sky-cat')).animationPlayState") == "paused"


def test_reduced_motion_starts_paused_but_can_resume(browser, base_url):
    ctx = browser.new_context(base_url=base_url, ignore_https_errors=True, reduced_motion="reduce")
    ctx.add_init_script("if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'en')")
    page = ctx.new_page()
    try:
        page.goto("/")
        expect(page.locator("html")).to_have_attribute("data-motion", "paused")
        page.get_by_role("button", name="Pause animations").click()
        expect(page.locator("html")).to_have_attribute("data-motion", "running")
        assert page.evaluate("getComputedStyle(document.querySelector('.sky-cat')).animationPlayState") == "running"
    finally:
        ctx.close()
