"""Browser tests through nginx, like a user in Chrome. Fixtures shared by test_ui_*.py."""
import os
import re
import uuid

import pytest
from playwright.sync_api import expect

from helpers import PASSWORD

EDGE_URL = os.environ.get("EDGE_URL", "https://nginx")

# A successful analysis, for tests that exercise the UI rather than the model (the real pipeline
# is covered by test_ui_analyze.py::test_analyze_golden_retriever and e2e/test_vision.py).
CANNED = {
    "success": True, "error": None, "timestamp": "2026-09-26T00:00:00",
    "data": {
        "species": "dog",
        "breed_analysis": {
            "primary_breed": "golden_retriever", "confidence": 0.62, "is_likely_crossbreed": False,
            "breed_probabilities": [{"breed": "golden_retriever", "probability": 0.62}],
            "crossbreed_analysis": None,
        },
        "description": "A friendly golden dog sitting on the grass.",
        "traits": {"size": "large", "energy_level": "high", "temperament": "Friendly and eager"},
        "health_observations": ["Bright, clear eyes"],
        "enriched_info": None,
    },
}


@pytest.fixture(scope="session")
def base_url():
    return EDGE_URL


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    # Chromium takes no CA file the way httpx does; TLS verification is covered by the API e2e suite.
    return {**browser_context_args, "ignore_https_errors": True}


@pytest.fixture
def context(context):
    # English UI for stable selectors, unless the test itself switched language.
    context.add_init_script("if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'en')")
    return context


@pytest.fixture(autouse=True)
def no_csp_violations(page):
    """Every UI test doubles as a CSP check: any violation logged by the page fails it."""
    violations = []
    page.on("console", lambda m: violations.append(m.text)
            if m.type == "error" and "Content Security Policy" in m.text else None)
    yield
    assert not violations, violations


@pytest.fixture
def registered(page, ui_user):
    """ui_user, registered through the UI and signed in, on /analyze."""
    page.goto("/register")
    page.get_by_label("Email").fill(ui_user["email"])
    page.get_by_label("Password", exact=True).fill(ui_user["password"])
    page.get_by_label("Confirm password").fill(ui_user["password"])
    page.get_by_role("button", name="Create account").click()
    expect(page).to_have_url(re.compile(r"/analyze$"))
    return ui_user


@pytest.fixture
def ui_user(page):
    """A unique gate-…@example.com identity; the account (if the test created one) is deleted after."""
    user = {"email": f"gate-{uuid.uuid4().hex[:12]}@example.com", "password": PASSWORD}
    yield user
    req = page.context.request  # shares the browser's cookies
    resp = req.delete("/api/v1/auth/delete")
    if resp.status == 401:  # the test ended the session: log back in
        login = req.post("/api/v1/auth/login", data={"email": user["email"], "password": user["password"]})
        if login.status in (401, 422):  # never registered, or the test deleted the account
            return
        resp = req.delete("/api/v1/auth/delete")
    assert resp.ok, f"teardown delete -> {resp.status}: {resp.text()[:300]}"
