"""Log in with 42 through nginx. The intra is never contacted: only the redirects are checked.

Works with either configuration of srcs/auth-service/.env: empty OAUTH_42_CLIENT_ID/SECRET (the
evaluation default) or a real intra application."""
import httpx
import pytest

START = "/api/v1/auth/oauth/42/start"
CALLBACK = "/api/v1/auth/oauth/42/callback"


def _set_cookies(resp):
    return resp.headers.get_list("set-cookie")


def test_start_redirects_to_the_intra_or_says_unavailable(edge):
    resp = edge.get(START)  # anonymous: the gateway must let it through
    assert resp.status_code == 302, resp.text
    location = resp.headers["location"]

    if location == "/login?oauth=unavailable":  # no credentials in srcs/auth-service/.env
        assert not any(c.startswith("oauth_state=") and not c.startswith('oauth_state="";')
                       for c in _set_cookies(resp))
        return

    url = httpx.URL(location)
    assert (url.scheme, url.host, url.path) == ("https", "api.intra.42.fr", "/oauth/authorize")
    assert url.params["client_id"]
    assert url.params["response_type"] == "code"
    assert url.params["scope"] == "public"
    assert url.params["redirect_uri"].endswith("/api/v1/auth/oauth/42/callback")
    state_cookie = next(c for c in _set_cookies(resp) if c.startswith("oauth_state="))
    assert state_cookie.startswith(f"oauth_state={url.params['state']};"), state_cookie
    for attribute in ("HttpOnly", "SameSite=Lax", "Path=/api/v1/auth/oauth", "Max-Age=600"):
        assert attribute in state_cookie, state_cookie


@pytest.mark.parametrize("cookie", [None, "oauth_state=the-real-one"])
def test_callback_with_a_forged_state_signs_nobody_in(edge, cookie):
    headers = {"Cookie": cookie} if cookie else {}
    resp = edge.get(CALLBACK, params={"code": "anything", "state": "forged"}, headers=headers)

    assert resp.status_code == 302, resp.text
    assert resp.headers["location"] == "/login?oauth=error"
    cookies = _set_cookies(resp)
    assert not any(c.startswith(("access_token=", "refresh_token=")) for c in cookies), cookies
    assert any(c.startswith('oauth_state="";') for c in cookies), cookies  # spent
