import { getSafeNext } from '@/lib/utils'
import { useIsAuthenticated, useIsAuthReady } from '@/stores/auth'
import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'

interface PublicRouteProps {
  children: ReactNode
}

export function PublicRoute({ children }: PublicRouteProps) {
  const isReady = useIsAuthReady()
  const isAuthenticated = useIsAuthenticated()
  const [searchParams] = useSearchParams()

  // render the page only once we known whether the user is authenticated or not, to prevent a flash of the public pages for logged-in users while we check their session
  if (!isReady) return null

  // prevent authenticated users from seeing the landing/login page, honour any ?next= still on the URL (e.g. ProtectedRoute bounced them here but the session became valid in another tab in the meantime) so the original destination isn't lost
  // replace so the back button doesn't bounce them back here after redirecting away
  if (isAuthenticated) {
    return <Navigate to={getSafeNext(searchParams, '/dashboard')} replace />
  }

  return <>{children}</>
}
