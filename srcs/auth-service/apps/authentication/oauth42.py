"""
"Log in with 42": OAuth 2.0 authorization code grant against the 42 intra (api.intra.42.fr).

Everything runs here, server side, so the client secret never reaches the browser. /start puts a
random `state` in a short-lived cookie and sends the browser to the intra; /callback checks it, swaps
the code for an intra token, reads /v2/me and signs the user in — or hands out the same 2FA challenge
as POST /login. Every outcome is a redirect back into the SPA.
"""
import logging
import secrets
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect
from rest_framework.views import APIView

from apps.authentication.jwt_utils import generate_mfa_token
from apps.authentication.models import OAuthAccount, RefreshToken, User
from apps.authentication.utils import issue_auth_tokens

logger = logging.getLogger(__name__)

PROVIDER = '42'
AUTHORIZE_URL = 'https://api.intra.42.fr/oauth/authorize'
TOKEN_URL = 'https://api.intra.42.fr/oauth/token'
ME_URL = 'https://api.intra.42.fr/v2/me'
TIMEOUT = 10  # seconds per intra call, no retries: the user can simply click again

STATE_COOKIE = 'oauth_state'
STATE_COOKIE_PATH = '/api/v1/auth/oauth'  # sent back to /oauth/42/callback, nowhere else
STATE_MAX_AGE = 600

# Where the browser lands in the SPA
SUCCESS = '/analyze?oauth=ok'  # the marker makes the SPA check the session it has no hint of yet
FAILED = '/login?oauth=error'
UNAVAILABLE = '/login?oauth=unavailable'
MFA = '/login?oauth=mfa#'  # + challenge token: a fragment is never sent to a server nor logged


def is_configured():
    """Both the id and the secret of the intra application are set"""
    return bool(settings.OAUTH_42_CLIENT_ID and settings.OAUTH_42_CLIENT_SECRET)


def authorize_url(state):
    return AUTHORIZE_URL + '?' + urlencode({
        'client_id': settings.OAUTH_42_CLIENT_ID,
        'redirect_uri': settings.OAUTH_42_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'public',
        'state': state,
    })


def _redirect(location):
    """A redirect into the SPA that also spends the state cookie (a no-op when there is none)."""
    response = HttpResponseRedirect(location)
    response.delete_cookie(STATE_COOKIE, path=STATE_COOKIE_PATH, samesite='Lax')
    return response


class OAuth42StartView(APIView):
    """
    GET /api/v1/auth/oauth/42/start

    Public at the gateway. The "Log in with 42" link points here: a plain navigation, so the
    browser itself follows the redirect to the intra.
    """

    def get(self, request):
        if not is_configured():
            return _redirect(UNAVAILABLE)

        state = secrets.token_urlsafe(32)
        response = HttpResponseRedirect(authorize_url(state))
        response.set_cookie(
            STATE_COOKIE,
            state,
            max_age=STATE_MAX_AGE,
            path=STATE_COOKIE_PATH,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite='Lax',  # not Strict: it must come back on the top-level redirect from the intra
        )
        return response
