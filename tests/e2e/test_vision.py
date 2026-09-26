"""Vision pipeline end to end, through nginx over verified HTTPS — the frontend's path.

Port of scripts/e2e-vision.py (which stays as a verbose demo). Needs the full stack:
classification-service, litellm and MISTRAL_API_KEY. A hosted-LLM 429 that survives
LiteLLM's fallback fails the test on purpose.
"""
import base64

import pytest

from helpers import ok

IMAGES = {
    "golden_retriever_1.jpg": "dog",                     # purebred
    "german_shepherd_golder_retriever_1.jpg": "dog",     # crossbreed
    "micio_1.jpeg": "cat",
}


@pytest.mark.parametrize("name,species", IMAGES.items())
def test_analyze(edge_user, name, species):
    with open(f"/test_data/{name}", "rb") as f:
        uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
    body = ok(edge_user["client"].post("/api/v1/vision/analyze", json={"image": uri}))
    data = body["data"]
    assert data["species"] == species
    assert data["breed_analysis"]["primary_breed"]
    assert data["description"].strip()
