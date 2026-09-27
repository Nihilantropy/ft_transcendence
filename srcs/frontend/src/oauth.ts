/** Where "Log in with 42" goes: auth-service answers with a redirect to the 42 intra. */
export const OAUTH_42_START = '/api/v1/auth/oauth/42/start'

export type OAuthReturn = { kind: 'error' | 'unavailable' | 'exists' } | { kind: 'mfa'; token: string }

/** What the 42 callback left on /login: ?oauth=error|unavailable|exists, or ?oauth=mfa#<2FA challenge token>. */
export function readOAuthReturn(search: string, hash: string): OAuthReturn | null {
  const kind = new URLSearchParams(search).get('oauth')
  if (kind === 'error' || kind === 'unavailable' || kind === 'exists') return { kind }
  if (kind !== 'mfa') return null
  const token = hash.replace(/^#/, '')
  // ponytail: a challenge lost on the way can only be retried from the start, like any failure
  return token ? { kind: 'mfa', token } : { kind: 'error' }
}

/** /analyze?oauth=ok: the callback has just signed this browser in. */
export const cameBackFromOAuth = (search: string) => new URLSearchParams(search).get('oauth') === 'ok'
