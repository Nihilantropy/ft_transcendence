import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { api, setLogoutHandler } from './api'

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
    // A 401 here goes through api.ts's refresh, so an expired access token is renewed silently.
    api<{ user: User }>('/auth/verify').then((d) => setUser(d.user), () => setUser(null))
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
      // Synchronous XHR, not fetch: the access/refresh cookies are httpOnly, so only this
      // response's Set-Cookie can clear them, and a caller may hard-navigate immediately
      // after this call returns (e.g. straight to /login). An async fetch — even keepalive,
      // even sendBeacon — gets cancelled by Chromium before the response lands when the
      // document is torn down that fast; a synchronous request blocks until it's actually done.
      try {
        const req = new XMLHttpRequest()
        req.open('POST', '/api/v1/auth/logout', false)
        req.withCredentials = true
        req.send()
      } catch {
        // ponytail: best-effort; the local session ends regardless
      }
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
