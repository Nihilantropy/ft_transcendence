import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { api, ApiError, setLogoutHandler } from './api'

export type User = { id: string; email: string; role: string }

type Auth = {
  user: User | null | undefined // undefined while the session check runs
  login(email: string, password: string): Promise<void>
  register(email: string, password: string, password_confirm: string): Promise<void>
  logout(): Promise<void>
  clear(): void
}

const AuthCtx = createContext<Auth>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>()

  useEffect(() => {
    setLogoutHandler(() => setUser(null))
    // A 401 here goes through api.ts's refresh (which calls the logout handler above on
    // genuine failure), so an expired access token is renewed silently. A non-auth error
    // (429 rate limit, network blip, 5xx) must not be read as "logged out" — only a real
    // UNAUTHORIZED means that.
    api<{ user: User }>('/auth/verify').then(
      (d) => setUser(d.user),
      (e) => { if (e instanceof ApiError && e.code !== 'UNAUTHORIZED') return; setUser(null) },
    )
  }, [])

  const value: Auth = {
    user,
    async login(email, password) {
      setUser((await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } })).user)
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
