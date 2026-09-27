import re

from playwright.sync_api import expect


def test_empty_state_invites_first_analysis(page, registered):
    page.goto("/pets")
    expect(page.get_by_text("No pets yet. Analyze a photo to add your first one.")).to_be_visible()
    page.get_by_role("link", name="Analyze a photo").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))


def test_save_as_pet_then_food_then_list(page, registered, fake_vision):
    page.set_input_files("input[type=file]", "/test_data/golden_retriever_1.jpg")
    page.get_by_role("button", name="Save as my pet").click()
    page.get_by_role("dialog").get_by_label("Name").fill("Biscotto")
    page.get_by_role("dialog").get_by_role("button", name="Save").click()

    expect(page).to_have_url(re.compile(r"/pets/[0-9a-f-]{36}$"))
    expect(page.get_by_role("heading", name="Biscotto")).to_be_visible()
    food = page.get_by_role("list", name="Recommended food")
    expect(food.get_by_role("listitem").first).to_be_visible()

    page.get_by_label("Age (months)").fill("36")
    page.get_by_label("Weight (kg)").fill("30")
    page.get_by_label("Joint health").check()
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_text("Saved")).to_be_visible()
    page.reload()
    expect(page.get_by_label("Age (months)")).to_have_value("36")
    expect(page.get_by_label("Joint health")).to_be_checked()

    page.get_by_role("link", name="All my pets").click()
    expect(page.get_by_role("link", name=re.compile("Biscotto"))).to_be_visible()
    expect(page.get_by_text("Golden Retriever")).to_be_visible()


def test_unknown_pet_is_friendly(page, registered):
    page.goto("/pets/00000000-0000-0000-0000-000000000000")
    expect(page.get_by_text("I couldn't find this pet.")).to_be_visible()
