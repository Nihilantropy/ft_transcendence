import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { api, setLogoutHandler } from './api'
import { cameBackFromOAuth } from './oauth'

export type User = {
  id: string
  email: string
  role: string
  first_name: string
  last_name: string
  two_factor_enabled: boolean
  has_password: boolean // false for an account created with 42 until a password is set on Profile
}

type Auth = {
  user: User | null | undefined // undefined while the session check runs
  /** Resolves with the 2FA challenge when the account has 2FA on; the user is set only after the code. */
  login(email: string, password: string): Promise<{ mfaToken: string } | void>
  loginWithCode(mfaToken: string, code: string): Promise<void>
  register(email: string, password: string, password_confirm: string): Promise<void>
  logout(): Promise<void>
  /** Re-read the signed-in user, after a profile or 2FA change. */
  refreshUser(): Promise<void>
  clear(): void
}

const AuthCtx = createContext<Auth>(null!)

const HINT = 'session'

// A UX hint, never an authorisation signal: HttpOnly cookies are invisible to JS, so remember
// whether a session may exist to spare anonymous visitors a pointless verify + refresh on every
// page load.
function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(HINT) === '1'
  } catch {
    return true // storage blocked → always ask the server
  }
}
function setSessionHint(on: boolean) {
  try {
    if (on) localStorage.setItem(HINT, '1')
    else localStorage.removeItem(HINT)
  } catch {
    // ponytail: not persisted; the next load simply asks the server
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>()
  const setUser = (u: User | null) => {
    setSessionHint(u !== null)
    setUserState(u)
  }

  // Back from "Log in with 42": the callback set the cookies in a redirect this tab never saw, so
  // there is no hint yet — ask the server anyway. Read once: StrictMode runs the effect twice.
  const [fromOAuth] = useState(() => cameBackFromOAuth(window.location.search))

  useEffect(() => {
    setLogoutHandler(() => setUser(null))
    if (fromOAuth) window.history.replaceState(window.history.state, '', window.location.pathname)
    if (!hasSessionHint() && !fromOAuth) {
      setUser(null)
      return
    }
    // A 401 here goes through api.ts's refresh, so an expired access token is renewed silently.
    api<{ user: User }>('/auth/verify').then((d) => setUser(d.user), () => setUser(null))
  }, [])

  const value: Auth = {
    user,
    async login(email, password) {
      const d = await api<{ user?: User; mfa_required?: boolean; mfa_token?: string }>(
        '/auth/login', { method: 'POST', body: { email, password } })
      // 2FA on: no cookies were set, so no user and no session hint until the code is accepted.
      if (d.mfa_required && d.mfa_token) return { mfaToken: d.mfa_token }
      setUser(d.user!)
    },
    async loginWithCode(mfaToken, code) {
      const body = { mfa_token: mfaToken, code }
      setUser((await api<{ user: User }>('/auth/login/2fa', { method: 'POST', body })).user)
    },
    async register(email, password, password_confirm) {
      const body = { email, password, password_confirm }
      setUser((await api<{ user: User }>('/auth/register', { method: 'POST', body })).user)
    },
    async logout() {
      // ponytail: the server call may fail (already expired); the local session ends regardless
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
      setUser(null)
    },
    async refreshUser() {
      // ponytail: a failed re-read keeps the current user; a dead session is api.ts's job (refresh, then logout)
      await api<{ user: User }>('/auth/verify').then((d) => setUser(d.user), () => {})
    },
    clear: () => setUser(null),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

export function RequireAuth() {
  const { user } = useAuth()
  if (user === undefined) return null
  return user ? <Outlet /> : <Navigate to="/" replace />
}

export function PublicOnly() {
  const { user } = useAuth()
  if (user === undefined) return null
  return user ? <Navigate to="/analyze" replace /> : <Outlet />
}
