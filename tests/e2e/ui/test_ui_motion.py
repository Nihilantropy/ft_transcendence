"""Line-art animations: they run, and a paused page still shows complete drawings."""
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
