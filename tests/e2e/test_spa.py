"""nginx serves the built SPA: deep links fall back to index.html, /api stays JSON."""
import re


def test_root_serves_the_app(edge):
    resp = edge.get("/")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert '<div id="root">' in resp.text


def test_client_route_reload_serves_the_app(edge):
    resp = edge.get("/pets/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 200
    assert '<div id="root">' in resp.text


def test_hashed_assets_are_cached(edge):
    script = re.search(r'src="(/assets/[^"]+\.js)"', edge.get("/").text).group(1)
    resp = edge.get(script)
    assert resp.status_code == 200
    assert "max-age=31536000" in resp.headers["cache-control"]


def test_security_headers_and_csp_on_the_app(edge):
    headers = edge.get("/").headers
    assert "script-src 'self'" in headers["content-security-policy"]
    assert "unsafe-eval" not in headers["content-security-policy"]
    assert "max-age=31536000" in headers["strict-transport-security"]


def test_api_is_not_swallowed_by_the_spa(edge):
    resp = edge.get("/api/v1/no-such-route")
    assert resp.headers["content-type"].startswith("application/json")
