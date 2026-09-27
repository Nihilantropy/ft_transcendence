"""Keyboard, focus, titles and reflow checks (WCAG 2.1 AA). axe runs on every test (conftest)."""
import re

from playwright.sync_api import expect

from helpers import axe_scan, describe_violations

PUBLIC = ["/", "/login", "/register", "/privacy", "/terms", "/accessibility"]
PRIVATE = ["/analyze", "/pets", "/profile"]


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


def test_result_gets_focus_and_photo_has_alt(page, registered, fake_vision):
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    expect(page.get_by_role("heading", name="Golden Retriever")).to_be_focused()
    expect(page.get_by_alt_text("Your photo")).to_be_visible()


def test_recommendation_reasons_are_translated(page, registered, fake_vision):
    page.get_by_label("Language").select_option("it")
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    page.get_by_role("button", name="Salva come mio animale").click()
    page.get_by_role("dialog").get_by_label("Nome").fill("Biscotto")
    page.get_by_role("dialog").get_by_role("button", name="Salva").click()
    food = page.get_by_role("list", name="Cibo consigliato")
    expect(food.get_by_role("listitem").first).to_be_visible()
    expect(food).not_to_contain_text("Nutritionally compatible")
    expect(food).not_to_contain_text("Targets joint health")


def test_dark_theme_passes_axe(page, registered):
    page.emulate_media(color_scheme="dark")
    for path in ["/analyze", "/pets", "/profile"]:
        page.goto(path)
        page.wait_for_load_state("networkidle")
        violations = axe_scan(page)
        assert not violations, f"{path}\n{describe_violations(violations)}"


def test_dark_theme_public_pages_pass_axe(page):
    page.emulate_media(color_scheme="dark")
    for path in PUBLIC:
        page.goto(path)
        page.wait_for_load_state("networkidle")
        violations = axe_scan(page)
        assert not violations, f"{path}\n{describe_violations(violations)}"


def test_reflow_at_320px(page, registered):
    page.set_viewport_size({"width": 320, "height": 640})
    for path in PRIVATE + ["/privacy", "/accessibility"]:
        page.goto(path)
        page.wait_for_load_state("networkidle")
        assert page.evaluate("document.documentElement.scrollWidth") <= 320, path


def test_keyboard_journey(page, ui_user, fake_vision):
    page.goto("/")
    tab_to(page, page.get_by_role("link", name="Create account"))
    page.keyboard.press("Enter")
    expect(page).to_have_url(re.compile(r"/register$"))
    tab_to(page, page.get_by_label("Email"))
    page.keyboard.type(ui_user["email"])
    tab_to(page, page.get_by_label("Password", exact=True))
    page.keyboard.type(ui_user["password"])
    tab_to(page, page.get_by_label("Confirm password"))
    page.keyboard.type(ui_user["password"])
    tab_to(page, page.get_by_role("button", name="Create account"))
    page.keyboard.press("Enter")
    expect(page).to_have_url(re.compile(r"/analyze$"))

    tab_to(page, page.locator("input[type=file]"))
    with page.expect_file_chooser() as chooser:
        page.keyboard.press("Space")
    chooser.value.set_files("/test_data/golden_retriever_1.jpg")
    save = page.get_by_role("button", name="Save as my pet")
    tab_to(page, save)
    page.keyboard.press("Enter")
    expect(page.get_by_role("dialog").get_by_label("Name")).to_be_focused()
    page.keyboard.press("Escape")
    expect(save).to_be_focused()  # focus returns to the opener
    page.keyboard.press("Enter")
    page.keyboard.type("Biscotto")
    page.keyboard.press("Enter")  # submits the dialog form
    expect(page).to_have_url(re.compile(r"/pets/[0-9a-f-]{36}$"))
