"""recommendation-service through the gateway: a real catalog, and an admin API that is admin-only."""
from helpers import ok


def test_pet_saved_from_an_analysis_gets_food_recommendations(gw_user):
    # What "Save as my pet" creates: species + breed only, no age, no weight.
    c = gw_user["client"]
    pet = ok(c.post("/api/v1/pets", json={
        "name": "Gate", "species": "dog", "breed": "Golden Retriever"}), 201)["data"]
    body = ok(c.get("/api/v1/recommendations/food", params={"pet_id": pet["id"], "limit": 3}))
    assert body["data"]["recommendations"], body["data"]["metadata"]


def test_regular_user_cannot_create_products(gw_user):
    resp = gw_user["client"].post("/api/v1/admin/products", json={
        "name": "Gate Sneaky Product", "brand": "Gate", "price": "1.00", "target_species": "dog"})
    if resp.status_code == 201:  # the bug is back: don't leave an active product in the catalog
        gw_user["client"].delete(f"/api/v1/admin/products/{resp.json()['data']['id']}")
    assert resp.status_code == 403, resp.text
