"""
Log in with 42 (OAuth 2.0 authorization code grant against the 42 intra) and what it implies for
accounts without a password. The intra is never contacted: httpx.post / httpx.get are patched.
"""
from types import SimpleNamespace
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from django.db import IntegrityError, transaction

from apps.authentication import oauth42
from apps.authentication import two_factor
from apps.authentication.jwt_utils import decode_token, generate_access_token
from apps.authentication.models import OAuthAccount, RefreshToken, User


@pytest.fixture
def oauth_user():
    """An account created through 42: linked, no usable password"""
    user = User.objects.create_user(email='marvin@student.42.fr', first_name='Marvin')
    OAuthAccount.objects.create(provider='42', provider_user_id='4242', user=user)
    return user


def signed_in(client, user):
    client.cookies['access_token'] = generate_access_token(user)
    return client


@pytest.mark.django_db
class TestOAuthAccountModel:
    def test_one_link_per_remote_identity(self, oauth_user, user):
        with pytest.raises(IntegrityError), transaction.atomic():
            OAuthAccount.objects.create(provider='42', provider_user_id='4242', user=user)

    def test_same_remote_id_on_another_provider_is_a_different_identity(self, oauth_user):
        OAuthAccount.objects.create(provider='github', provider_user_id='4242', user=oauth_user)

        assert oauth_user.oauth_accounts.count() == 2

    def test_deleting_the_user_deletes_the_link(self, oauth_user):
        oauth_user.delete()

        assert not OAuthAccount.objects.exists()

    def test_created_without_a_password(self, oauth_user):
        assert oauth_user.has_usable_password() is False


@pytest.mark.django_db
class TestSetPassword:
    """PUT /change-password without current_password, only for an account that has no password"""

    ENDPOINT = '/api/v1/auth/change-password'
    BODY = {'new_password': 'Fresh-pass-42', 'new_password_confirm': 'Fresh-pass-42'}

    def put(self, client, body):
        return client.put(self.ENDPOINT, data=body, content_type='application/json')

    def test_sets_the_first_password(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), self.BODY)

        assert response.status_code == 200, response.json()
        oauth_user.refresh_from_db()
        assert oauth_user.check_password('Fresh-pass-42')
        assert response.cookies['access_token'].value

    def test_revokes_the_other_sessions(self, client, oauth_user):
        session = RefreshToken.objects.create(user=oauth_user, token_hash='h', expires_at=oauth_user.created_at)

        self.put(signed_in(client, oauth_user), self.BODY)

        session.refresh_from_db()
        assert session.is_revoked is True

    def test_a_sent_current_password_is_ignored(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), {**self.BODY, 'current_password': 'whatever'})

        assert response.status_code == 200, response.json()

    def test_the_new_password_is_still_validated(self, client, oauth_user):
        response = self.put(signed_in(client, oauth_user), {'new_password': 'short', 'new_password_confirm': 'short'})

        assert response.status_code == 422
        assert 'new_password' in response.json()['error']['details']

    def test_an_account_with_a_password_still_needs_it(self, authenticated_client):
        response = self.put(authenticated_client, self.BODY)

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']

    def test_then_email_and_password_login_works(self, client, oauth_user):
        self.put(signed_in(client, oauth_user), self.BODY)

        response = client.post('/api/v1/auth/login', data={
            'email': 'marvin@student.42.fr', 'password': 'Fresh-pass-42'}, content_type='application/json')

        assert response.status_code == 200, response.json()
        assert response.json()['data']['user']['has_password'] is True

    def test_no_password_never_logs_in_with_one(self, client, oauth_user):
        response = client.post('/api/v1/auth/login', data={
            'email': 'marvin@student.42.fr', 'password': 'anything123'}, content_type='application/json')

        assert response.status_code == 401

    def test_turning_on_two_factor_needs_a_password_first(self, client, oauth_user):
        response = signed_in(client, oauth_user).post(
            '/api/v1/auth/2fa/enable', data={'current_password': 'anything123', 'code': '123456'},
            content_type='application/json')

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']

    def test_changing_the_email_needs_a_password_first(self, client, oauth_user):
        response = signed_in(client, oauth_user).patch(
            '/api/v1/auth/me', data={'email': 'new@example.com', 'current_password': 'anything123'},
            content_type='application/json')

        assert response.status_code == 422
        assert 'current_password' in response.json()['error']['details']


START = '/api/v1/auth/oauth/42/start'
REDIRECT_URI = 'https://localhost:8443/api/v1/auth/oauth/42/callback'


@pytest.fixture
def configured(settings):
    settings.OAUTH_42_CLIENT_ID = 'uid-123'
    settings.OAUTH_42_CLIENT_SECRET = 's3cret'
    settings.OAUTH_42_REDIRECT_URI = REDIRECT_URI
    return settings


@pytest.fixture
def unconfigured(settings):
    settings.OAUTH_42_CLIENT_ID = ''
    settings.OAUTH_42_CLIENT_SECRET = ''
    return settings


@pytest.mark.django_db
class TestStart:
    def test_redirects_to_the_intra_authorize_page(self, client, configured):
        response = client.get(START)

        assert response.status_code == 302
        url = urlsplit(response['Location'])
        assert (url.scheme, url.netloc, url.path) == ('https', 'api.intra.42.fr', '/oauth/authorize')
        query = parse_qs(url.query)
        assert query['client_id'] == ['uid-123']
        assert query['redirect_uri'] == [REDIRECT_URI]
        assert query['response_type'] == ['code']
        assert query['scope'] == ['public']
        assert query['state'] == [response.cookies['oauth_state'].value]

    def test_state_cookie(self, client, configured):
        cookie = client.get(START).cookies['oauth_state']

        assert len(cookie.value) >= 43  # 32 random bytes, urlsafe base64
        assert cookie['httponly'] is True
        assert cookie['samesite'] == 'Lax'  # Strict would not come back on the redirect from the intra
        assert cookie['path'] == '/api/v1/auth/oauth'
        assert cookie['max-age'] == 600

    def test_state_cookie_is_secure_when_cookies_are(self, client, configured):
        configured.COOKIE_SECURE = True

        assert client.get(START).cookies['oauth_state']['secure'] is True

    def test_every_start_gets_a_new_state(self, client, configured):
        first = client.get(START).cookies['oauth_state'].value
        second = client.get(START).cookies['oauth_state'].value

        assert first != second

    def test_the_client_secret_never_reaches_the_browser(self, client, configured):
        response = client.get(START)

        assert 's3cret' not in response['Location']
        assert 's3cret' not in response.cookies.output()

    @pytest.mark.parametrize('client_id, secret', [('', ''), ('uid-123', ''), ('', 's3cret')])
    def test_unconfigured_says_unavailable(self, client, settings, client_id, secret):
        settings.OAUTH_42_CLIENT_ID = client_id
        settings.OAUTH_42_CLIENT_SECRET = secret

        response = client.get(START)

        assert response.status_code == 302
        assert response['Location'] == '/login?oauth=unavailable'
        assert response.cookies['oauth_state'].value == ''  # nothing to carry


CALLBACK = '/api/v1/auth/oauth/42/callback'
STATE = 'the-state-from-start'
PROFILE = {'id': 4242, 'email': 'Marvin@Student.42.fr', 'login': 'marvin',
           'first_name': 'Marvin', 'last_name': 'Paranoid'}


def intra_response(method, url, status=200, **body):
    return httpx.Response(status, request=httpx.Request(method, url), **body)


@pytest.fixture
def intra(configured):
    """The token exchange and /v2/me, patched with a happy intra; tests override return_value / side_effect"""
    with mock.patch.object(oauth42.httpx, 'post') as post, mock.patch.object(oauth42.httpx, 'get') as get:
        post.return_value = intra_response('POST', oauth42.TOKEN_URL,
                                           json={'access_token': 'intra-token', 'token_type': 'bearer'})
        get.return_value = intra_response('GET', oauth42.ME_URL, json=dict(PROFILE))
        yield SimpleNamespace(post=post, get=get)


def callback(client, cookie=STATE, **params):
    """GET the callback like a browser back from the intra. None drops a query parameter or the cookie."""
    query = {'code': 'the-code', 'state': STATE, **params}
    if cookie is not None:
        client.cookies['oauth_state'] = cookie
    return client.get(CALLBACK, {k: v for k, v in query.items() if v is not None})


def assert_failed(response):
    assert response.status_code == 302
    assert response['Location'] == '/login?oauth=error'
    assert 'access_token' not in response.cookies
    assert 'refresh_token' not in response.cookies
    assert response.cookies['oauth_state'].value == ''  # spent


@pytest.mark.django_db
class TestCallbackState:
    @pytest.mark.parametrize('cookie, state', [
        (None, STATE),             # no cookie: the flow was not started in this browser
        ('another-state', STATE),  # another login attempt overwrote it, or a forged callback
        (STATE, None),             # no state in the query
        (STATE, ''),
        (STATE, 'é-not-ascii'),    # compare_digest on str would raise TypeError (a 500)
    ])
    def test_bad_state_is_refused_before_calling_the_intra(self, client, intra, cookie, state):
        response = callback(client, cookie=cookie, state=state)

        assert_failed(response)
        intra.post.assert_not_called()

    def test_denied_on_the_intra(self, client, intra):
        """The user pressed Cancel: the intra sends ?error=access_denied&state=… and no code"""
        response = callback(client, code=None, error='access_denied')

        assert_failed(response)
        intra.post.assert_not_called()

    def test_unconfigured_is_unavailable(self, client, unconfigured):
        response = callback(client)

        assert response['Location'] == '/login?oauth=unavailable'
        assert response.cookies['oauth_state'].value == ''

    def test_unconfigured_wins_over_a_missing_state(self, client, unconfigured):
        """is_configured() is checked before the state: an unconfigured deployment always answers
        unavailable, even for a forged callback with no state cookie at all."""
        response = callback(client, cookie=None)

        assert response['Location'] == '/login?oauth=unavailable'
        assert response.cookies['oauth_state'].value == ''


FAILURES = {
    'token refused': ('post', intra_response('POST', oauth42.TOKEN_URL, 401, json={'error': 'invalid_grant'})),
    'token not JSON': ('post', intra_response('POST', oauth42.TOKEN_URL, text='<html>oops</html>')),
    'token without access_token': ('post', intra_response('POST', oauth42.TOKEN_URL, json={})),
    'intra unreachable': ('post', httpx.ConnectTimeout('timed out')),
    '/me refused': ('get', intra_response('GET', oauth42.ME_URL, 500, json={})),
    '/me without id': ('get', intra_response('GET', oauth42.ME_URL, json={'email': 'marvin@student.42.fr'})),
    '/me with a null id': ('get', intra_response('GET', oauth42.ME_URL, json={**PROFILE, 'id': None})),
    '/me without email': ('get', intra_response('GET', oauth42.ME_URL, json={**PROFILE, 'email': None})),
    '/me with a non-string email': ('get', intra_response('GET', oauth42.ME_URL, json={**PROFILE, 'email': 12345})),
    '/me not an object': ('get', intra_response('GET', oauth42.ME_URL, json=[])),
}


@pytest.mark.django_db
class TestCallbackIntraFailures:
    @pytest.mark.parametrize('call, outcome', FAILURES.values(), ids=list(FAILURES))
    def test_intra_failure_signs_nobody_in(self, client, intra, call, outcome):
        mocked = getattr(intra, call)
        if isinstance(outcome, Exception):
            mocked.side_effect = outcome
        else:
            mocked.return_value = outcome

        response = callback(client)

        assert_failed(response)
        assert not User.objects.filter(email='marvin@student.42.fr').exists()

    def test_code_is_exchanged_with_the_secret_and_redirect_uri(self, client, intra):
        callback(client)

        intra.post.assert_called_once_with(oauth42.TOKEN_URL, data={
            'grant_type': 'authorization_code',
            'client_id': 'uid-123',
            'client_secret': 's3cret',
            'code': 'the-code',
            'redirect_uri': REDIRECT_URI,
        }, timeout=10)
        intra.get.assert_called_once_with(
            oauth42.ME_URL, headers={'Authorization': 'Bearer intra-token'}, timeout=10)

    def test_failures_are_logged_without_secrets(self, client, intra, caplog):
        intra.post.return_value = intra_response('POST', oauth42.TOKEN_URL, 401, json={'error': 'invalid_grant'})

        callback(client)

        assert '42 login failed: HTTPStatusError 401' in caplog.text
        for secret in ('the-code', 's3cret', 'intra-token', STATE):
            assert secret not in caplog.text


@pytest.mark.django_db
class TestCallbackLinking:
    def test_new_user_is_created_linked_and_signed_in(self, client, intra):
        response = callback(client)

        assert response.status_code == 302
        assert response['Location'] == '/?oauth=ok'
        user = User.objects.get(email='marvin@student.42.fr')  # lower-cased
        assert (user.first_name, user.last_name) == ('Marvin', 'Paranoid')
        assert user.has_usable_password() is False
        assert OAuthAccount.objects.get(provider='42', provider_user_id='4242').user == user
        assert decode_token(response.cookies['access_token'].value)['user_id'] == str(user.id)
        assert response.cookies['refresh_token'].value
        assert response.cookies['oauth_state'].value == ''

    def test_password_account_with_same_email_is_not_linked(self, client, intra):
        """
        No auto-link to an account that has a password: local registration never verifies email
        ownership, so linking by email would let whoever registered that address first take over
        the 42 user's account (pre-hijacking). The user is told to log in with their password instead.
        """
        existing = User.objects.create_user(email='marvin@student.42.fr', password='testpass123', first_name='Mar')

        response = callback(client)

        assert response.status_code == 302
        assert response['Location'] == '/login?oauth=exists'
        assert 'access_token' not in response.cookies
        assert 'refresh_token' not in response.cookies
        assert response.cookies['oauth_state'].value == ''
        assert User.objects.count() == 1
        assert not OAuthAccount.objects.exists()
        existing.refresh_from_db()
        assert existing.check_password('testpass123')  # untouched

    def test_passwordless_account_with_same_email_is_linked(self, client, intra):
        existing = User.objects.create_user(email='marvin@student.42.fr', first_name='Mar')  # no password set

        response = callback(client)

        assert response['Location'] == '/?oauth=ok'
        assert User.objects.count() == 1
        assert OAuthAccount.objects.get(provider_user_id='4242').user == existing
        existing.refresh_from_db()
        assert existing.has_usable_password() is False
        assert existing.first_name == 'Mar'  # the intra never overwrites local data

    def test_linked_account_wins_over_the_email(self, client, intra):
        linked = User.objects.create_user(email='changed@example.com')
        OAuthAccount.objects.create(provider='42', provider_user_id='4242', user=linked)
        User.objects.create_user(email='marvin@student.42.fr', password='testpass123')  # someone else

        response = callback(client)

        assert decode_token(response.cookies['access_token'].value)['user_id'] == str(linked.id)
        assert OAuthAccount.objects.count() == 1

    def test_previous_sessions_are_revoked(self, client, intra, oauth_user):
        """Single-session policy, as on POST /login"""
        old = RefreshToken.objects.create(user=oauth_user, token_hash='h', expires_at=oauth_user.created_at)

        callback(client)

        old.refresh_from_db()
        assert old.is_revoked is True

    def test_disabled_account_is_refused(self, client, intra, oauth_user):
        oauth_user.is_active = False
        oauth_user.save(update_fields=['is_active'])

        assert_failed(callback(client))

    def test_long_or_missing_names_are_trimmed(self, client, intra):
        intra.get.return_value = intra_response(
            'GET', oauth42.ME_URL, json={**PROFILE, 'first_name': 'x' * 200, 'last_name': None})

        callback(client)

        user = User.objects.get(email='marvin@student.42.fr')
        assert (len(user.first_name), user.last_name) == (150, '')

    def test_losing_a_linking_race_is_a_failure_not_a_500(self, client, intra):
        with mock.patch.object(OAuthAccount.objects, 'create', side_effect=IntegrityError('duplicate')):
            response = callback(client)

        assert_failed(response)
        assert not User.objects.filter(email='marvin@student.42.fr').exists()  # rolled back


@pytest.mark.django_db
class TestCallbackTwoFactor:
    def test_two_factor_account_gets_the_login_challenge(self, client, intra, oauth_user, enable_two_factor):
        enable_two_factor(oauth_user)
        sessions = RefreshToken.objects.count()

        response = callback(client)

        location = response['Location']
        assert location.startswith('/login?oauth=mfa#')
        payload = decode_token(location.split('#', 1)[1])
        assert payload['token_type'] == 'mfa'
        assert payload['user_id'] == str(oauth_user.id)
        assert 'access_token' not in response.cookies
        assert 'refresh_token' not in response.cookies
        assert RefreshToken.objects.count() == sessions  # nothing issued, nothing revoked yet
        assert response.cookies['oauth_state'].value == ''

    def test_the_challenge_completes_with_login_2fa(self, client, intra, oauth_user, enable_two_factor):
        secret, _ = enable_two_factor(oauth_user)
        token = callback(client)['Location'].split('#', 1)[1]

        response = client.post('/api/v1/auth/login/2fa', data={
            'mfa_token': token, 'code': two_factor.totp(secret)}, content_type='application/json')

        assert response.status_code == 200, response.json()
        assert response.json()['data']['user']['email'] == 'marvin@student.42.fr'
