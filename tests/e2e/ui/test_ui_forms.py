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


def test_blur_revalidates_after_first_submit(page):
    """Spec §4: validate on submit, then again on blur — a fixed field drops aria-invalid
    without another submit."""
    page.goto("/register")
    page.get_by_label("Email").fill("not-an-email")
    page.get_by_role("button", name="Create account").click()
    expect(page.get_by_label("Email")).to_have_attribute("aria-invalid", "true")
    page.get_by_label("Email").fill("ok@example.com")
    page.get_by_label("Password", exact=True).focus()  # blur Email without submitting
    expect(page.get_by_label("Email")).to_have_attribute("aria-invalid", "false")


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


def test_weak_new_password_is_not_sent(page, registered):
    calls = spy(page, r"/api/v1/auth/change-password")
    page.goto("/profile")
    page.get_by_label("Current password").fill(registered["password"])
    page.get_by_label("New password", exact=True).fill("weak")
    page.get_by_label("Confirm new password").fill("weak")
    page.get_by_role("button", name="Change password").click()
    expect(page.get_by_label("New password", exact=True)).to_be_focused()
    assert calls == []


def test_wrong_current_password_is_translated(page, registered):
    page.goto("/profile")
    page.get_by_label("Language").select_option("it")
    page.get_by_label("Password attuale").fill("Wrong-Pass-999")
    page.get_by_label("Nuova password", exact=True).fill("Brand-New-123")
    page.get_by_label("Conferma nuova password").fill("Brand-New-123")
    page.get_by_role("button", name="Cambia password").click()
    expect(page.get_by_text("La password attuale non è corretta.").first).to_be_visible()
    expect(page.get_by_text("Current password is incorrect.")).to_have_count(0)


def test_pet_name_required(page, registered, fake_vision):
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    page.get_by_role("button", name="Save as my pet").click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_role("button", name="Save").click()
    expect(dialog.get_by_label("Name")).to_have_attribute("aria-invalid", "true")
    expect(dialog.get_by_text("This field is required.").first).to_be_visible()


def test_pet_weight_must_be_positive(page, registered, fake_vision):
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    page.get_by_role("button", name="Save as my pet").click()
    page.get_by_role("dialog").get_by_label("Name").fill("Biscotto")
    page.get_by_role("dialog").get_by_role("button", name="Save").click()
    expect(page).to_have_url(re.compile(r"/pets/[0-9a-f-]{36}$"))
    patches = []
    page.on("request", lambda r: patches.append(r.url) if r.method == "PATCH" else None)
    page.get_by_label("Weight (kg)").fill("0")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_label("Weight (kg)")).to_have_attribute("aria-invalid", "true")
    assert patches == []


def test_pet_weight_unparseable_number_rejected(page, registered, fake_vision):
    """`1e` (or `-`) leaves a type=number input's .value === '' (validity.badInput): the schema
    alone would read that as "unknown" and silently save null over the real weight."""
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    page.get_by_role("button", name="Save as my pet").click()
    page.get_by_role("dialog").get_by_label("Name").fill("Biscotto")
    page.get_by_role("dialog").get_by_role("button", name="Save").click()
    expect(page).to_have_url(re.compile(r"/pets/[0-9a-f-]{36}$"))
    page.get_by_label("Weight (kg)").fill("12.5")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_text("Saved")).to_be_visible()

    patches = []
    page.on("request", lambda r: patches.append(r.url) if r.method == "PATCH" else None)
    weight = page.get_by_label("Weight (kg)")
    weight.fill("")
    weight.press_sequentially("1e")  # fill() refuses non-numeric text on type=number; real typing doesn't
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_label("Weight (kg)")).to_have_attribute("aria-invalid", "true")
    assert patches == []

    page.reload()
    expect(page.get_by_label("Weight (kg)")).to_have_value("12.5")
