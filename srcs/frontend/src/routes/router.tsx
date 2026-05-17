import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ErrorPage } from '@/pages/error/ErrorPage'
import { NotFoundPage } from '@/pages/error/NotFoundPage'
import { LandingPage } from '@/pages/landing/LandingPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import { createBrowserRouter } from 'react-router'

export const router = createBrowserRouter([
  // auth routes, no appshell as they're self-contained and have specific layout behavior)
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
    errorElement: <ErrorPage />,
  },

  // app routes, wrapped in appshell which provides the common layout
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      // catch-all 404
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
