import { useIsAuthenticated, useIsAuthReady } from '@/stores/auth'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isReady = useIsAuthReady()
  const isAuthenticated = useIsAuthenticated()
  const location = useLocation()

  // render the page only once we known whether the user is authenticated or not, to prevent a flash of the protected pages for non logged users while we check their session
  if (!isReady) return null

  // bounce non authenticated users to /login, remembering the original destination via ?next= so LoginPage can send them back there after a successful login
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <>{children}</>
}
