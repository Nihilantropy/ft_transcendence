import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LandingPage } from '@/pages/landing/LandingPage'
import { useIsAuthenticated, useIsAuthReady } from '@/stores/auth'

// route element for the index of "/". decides at render time whether to show the landing page (for anon users) or the dashboard (for authenticated users).
// not showing anything until auth status is ready to avoid flashing the wrong page on first load
export function HomePage() {
  const isReady = useIsAuthReady()
  const isAuthenticated = useIsAuthenticated()

  if (!isReady) return null

  return isAuthenticated ? <DashboardPage /> : <LandingPage />
}
