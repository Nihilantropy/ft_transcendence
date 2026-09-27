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
from django.db import DatabaseError, transaction
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
EXISTS = '/login?oauth=exists'  # local account with this email has a password: no auto-link
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


def exchange_code(code):
    """Authorization code → intra access token"""
    response = httpx.post(TOKEN_URL, data={
        'grant_type': 'authorization_code',
        'client_id': settings.OAUTH_42_CLIENT_ID,
        'client_secret': settings.OAUTH_42_CLIENT_SECRET,
        'code': code,
        'redirect_uri': settings.OAUTH_42_REDIRECT_URI,
    }, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()['access_token']


def fetch_profile(access_token):
    """The intra's /v2/me: id, email, login, first_name, last_name, …"""
    response = httpx.get(ME_URL, headers={'Authorization': f'Bearer {access_token}'}, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


class EmailTaken(Exception):
    """The intra's email belongs to a local account that already has a usable password: no auto-link."""


def user_for_profile(profile):
    """
    The local account for an intra profile: the linked one; else the user with the same email
    IF that account has no password yet, linked now; else a new user with no usable password and
    the intra's names.

    Linking by email trusts the intra: 42 addresses are issued by the school. Never reuse this for a
    provider whose users pick their own unverified email — whoever registered that address there
    would take the local account over. Even trusting the intra, an account that already has a
    password was not necessarily created by the 42 user: local registration never verifies email
    ownership, so auto-linking there would let whoever registered that address first take over the
    42 user's account (pre-hijacking) — raise EmailTaken instead.
    """
    profile_id = profile.get('id')
    if not isinstance(profile_id, int):
        raise ValueError('intra profile id is not an int')
    provider_user_id = str(profile_id)

    account = (OAuthAccount.objects.select_related('user')
               .filter(provider=PROVIDER, provider_user_id=provider_user_id).first())
    if account:
        return account.user

    email = (profile.get('email') or '').strip().lower()
    if not email:
        raise ValueError('intra profile has no email')

    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is not None and user.has_usable_password():
            raise EmailTaken(email)
        if user is None:
            user = User.objects.create_user(  # no password: unusable until set from Profile
                email=email,
                first_name=(profile.get('first_name') or '')[:150],
                last_name=(profile.get('last_name') or '')[:150],
            )
        OAuthAccount.objects.create(provider=PROVIDER, provider_user_id=provider_user_id, user=user)
    return user


class OAuth42CallbackView(APIView):
    """
    GET /api/v1/auth/oauth/42/callback?code=…&state=…

    Public at the gateway: the intra redirects the browser here. Signs the user in like POST /login
    (single session, or the 2FA challenge) and always answers with a redirect into the SPA.
    """

    def get(self, request):
        state = request.GET.get('state', '')
        expected = request.COOKIES.get(STATE_COOKIE, '')
        # Bytes: compare_digest raises TypeError on non-ASCII str, and the query is the caller's
        if not (state and expected and secrets.compare_digest(state.encode(), expected.encode())):
            logger.warning('42 login refused: state missing or mismatched')
            return _redirect(FAILED)

        code = request.GET.get('code')
        if not code:  # the user said no on the intra (?error=access_denied)
            logger.warning('42 login refused on the intra: %r', request.GET.get('error', 'no code')[:64])
            return _redirect(FAILED)

        if not is_configured():
            return _redirect(UNAVAILABLE)

        try:
            user = user_for_profile(fetch_profile(exchange_code(code)))
        except EmailTaken:
            logger.warning('42 login refused: email already registered with a password')
            return _redirect(EXISTS)
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError, DatabaseError) as e:
            # Type and status only: messages can carry the email or the intra's reply
            status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else ''
            logger.warning('42 login failed: %s %s', type(e).__name__, status)
            return _redirect(FAILED)

        if not user.is_active:
            logger.warning('42 login refused: account disabled')
            return _redirect(FAILED)

        if user.two_factor_enabled:
            # The same challenge as POST /login; the Log in page finishes it with POST /login/2fa
            return _redirect(MFA + generate_mfa_token(user))

        # Single-session policy, as on POST /login
        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)
        return issue_auth_tokens(user, _redirect(SUCCESS))
