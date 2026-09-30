import { useIsAuthenticated, useIsAuthReady, useSessionError } from '@/stores/auth'
import { Navigate, Outlet, useLocation } from 'react-router'

// wraps all child routes with an auth gate
export function ProtectedRoute() {
  const isReady = useIsAuthReady()
  const isAuthenticated = useIsAuthenticated()
  const sessionError = useSessionError()
  const location = useLocation()

  // render the page only once we known whether the user is authenticated or not, to prevent a flash of the protected pages for non logged users while we check their session
  if (!isReady) return null

  // the session could not be checked: the route's errorElement, not the login page
  if (sessionError) throw sessionError

  // bounce non authenticated users to /login, remembering the original destination via ?next= so LoginPage can send them back there after a successful login
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <Outlet />
}
