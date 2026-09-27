import re

from playwright.sync_api import expect


def test_landing_headline(page):
    page.goto("/")
    expect(page.get_by_role("heading", name="Discover your pet's breed from a photo")).to_be_visible()


def test_privacy_and_terms_reachable_logged_out(page):
    page.goto("/")
    page.get_by_role("link", name="Privacy").click()
    expect(page).to_have_url(re.compile(r"/privacy$"))
    expect(page.get_by_role("heading", name="Privacy Policy")).to_be_visible()
    page.get_by_role("link", name="Terms").click()
    expect(page.get_by_role("heading", name="Terms of Service")).to_be_visible()
    page.reload()  # served by nginx try_files, not only by the client router
    expect(page.get_by_role("heading", name="Terms of Service")).to_be_visible()


def test_language_switch_translates_and_persists(page):
    page.goto("/")
    page.get_by_label("Language").select_option("es")
    expect(page.get_by_role("heading", name="Descubre la raza de tu mascota con una foto")).to_be_visible()
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "es")


def test_unknown_route_goes_home(page):
    page.goto("/no/such/page")
    expect(page).to_have_url(re.compile(r"/$"))
