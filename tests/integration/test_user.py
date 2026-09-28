"""user-service through the API gateway: profile and pet CRUD, ownership enforced."""
from helpers import ok


def test_profile_read_and_update(gw_user):
    c = gw_user["client"]
    ok(c.get("/api/v1/users/me"))
    body = ok(c.patch("/api/v1/users/me", json={"phone": "+39 333 1234567"}))
    assert body["data"]["phone"] == "+39 333 1234567"


def test_pet_crud(gw_user):
    c = gw_user["client"]
    pet = ok(c.post("/api/v1/pets", json={"name": "Gate", "species": "cat", "age": 3}), 201)["data"]
    assert [p["id"] for p in ok(c.get("/api/v1/pets"))["data"]] == [pet["id"]]
    assert ok(c.patch(f"/api/v1/pets/{pet['id']}", json={"weight": 4.2}))["data"]["weight"] == 4.2
    ok(c.delete(f"/api/v1/pets/{pet['id']}"))
    assert ok(c.get("/api/v1/pets"))["data"] == []


def test_pet_of_another_user_is_not_found(gw_user, edge_user):
    pet = ok(gw_user["client"].post("/api/v1/pets", json={"name": "Mine", "species": "dog"}), 201)
    resp = edge_user["client"].get(f"/api/v1/pets/{pet['data']['id']}")
    assert resp.status_code == 404, resp.text
