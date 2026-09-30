import { getSafeNext } from '@/lib/utils'
import { useIsAuthenticated, useIsAuthReady } from '@/stores/auth'
import { Navigate, Outlet, useSearchParams } from 'react-router'

// gates a group of routes to non authenticated users only
export function PublicRoute() {
  const isReady = useIsAuthReady()
  const isAuthenticated = useIsAuthenticated()
  const [searchParams] = useSearchParams()

  // render the page only once we known whether the user is authenticated or not, to prevent a flash of the public pages for logged-in users while we check their session
  if (!isReady) return null

  // prevent authenticated users from seeing the login/register page, honour any ?next= still on the URL (e.g. ProtectedRoute bounced them here but the session became valid in another tab in the meantime) so the original destination isn't lost
  // replace so the back button doesn't bounce them back here after redirecting away
  if (isAuthenticated) {
    return <Navigate to={getSafeNext(searchParams, '/')} replace />
  }

  return <Outlet />
}
