from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from src.main import PRODUCT_IMAGES_DIR, PRODUCT_IMAGES_PATH, app

CATALOG = Path(__file__).resolve().parents[2] / "scripts" / "products.yaml"


def catalog_image_urls() -> list[str]:
    with open(CATALOG) as f:
        return [p["image_url"] for p in yaml.safe_load(f)["products"]]


@pytest.mark.unit
def test_every_catalog_product_points_to_an_existing_image():
    """Each image_url sits under the images mount and names a file shipped in static/products."""
    for url in catalog_image_urls():
        assert url.startswith(PRODUCT_IMAGES_PATH + "/"), url
        assert (PRODUCT_IMAGES_DIR / url.removeprefix(PRODUCT_IMAGES_PATH + "/")).is_file(), url


@pytest.mark.unit
def test_product_image_is_served_as_jpeg():
    """The service itself serves the files (the gateway proxies them like any other call)."""
    response = TestClient(app).get(catalog_image_urls()[0])

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
