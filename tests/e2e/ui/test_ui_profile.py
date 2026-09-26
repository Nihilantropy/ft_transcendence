import re

from playwright.sync_api import expect

NEW_PASSWORD = "Gate-Test-Pass-456"


def test_logout_ends_the_session(page, registered):
    page.goto("/profile")
    page.get_by_role("button", name="Log out").click()
    expect(page).to_have_url(re.compile(r"/$"))
    page.goto("/pets")
    expect(page).to_have_url(re.compile(r"/$"))


def test_change_password(page, registered):
    page.goto("/profile")
    page.get_by_label("Current password").fill(registered["password"])
    page.get_by_label("New password", exact=True).fill(NEW_PASSWORD)
    page.get_by_label("Confirm new password").fill(NEW_PASSWORD)
    page.get_by_role("button", name="Change password").click()
    expect(page.get_by_text("Password changed")).to_be_visible()
    registered["password"] = NEW_PASSWORD  # teardown logs back in with it

    page.get_by_role("button", name="Log out").click()
    expect(page).to_have_url(re.compile(r"/$"))
    page.goto("/login")
    page.get_by_label("Email").fill(registered["email"])
    page.get_by_label("Password", exact=True).fill(NEW_PASSWORD)
    page.get_by_role("button", name="Log in").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_wrong_current_password_shows_field_error(page, registered):
    page.goto("/profile")
    page.get_by_label("Current password").fill("Wrong-Pass-999")
    page.get_by_label("New password", exact=True).fill(NEW_PASSWORD)
    page.get_by_label("Confirm new password").fill(NEW_PASSWORD)
    page.get_by_role("button", name="Change password").click()
    expect(page.get_by_label("Current password")).to_have_attribute("aria-invalid", "true")


def test_delete_account_needs_double_confirmation(page, registered):
    page.goto("/profile")
    page.get_by_role("button", name="Delete account").click()
    final = page.get_by_role("button", name="Delete forever")
    expect(final).to_be_disabled()
    page.get_by_label("I understand, delete everything").check()
    final.click()
    expect(page).to_have_url(re.compile(r"/$"))

    page.goto("/login")
    page.get_by_label("Email").fill(registered["email"])
    page.get_by_label("Password", exact=True).fill(registered["password"])
    page.get_by_role("button", name="Log in").click()
    expect(page.get_by_text("Wrong email or password.")).to_be_visible()


def test_spanish_ui_and_report_language(page, registered, fake_vision):
    page.get_by_label("Language").select_option("es")
    expect(page.get_by_role("heading", name="Analiza una foto")).to_be_visible()
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_role("button", name="Guardar como mi mascota")).to_be_visible()
    assert fake_vision[0]["language"] == "es"
