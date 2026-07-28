import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ErrorPage } from '@/pages/error/ErrorPage'
import { NotFoundPage } from '@/pages/error/NotFoundPage'
import { PetDetail } from '@/pages/pets/PetDetail'
import { PetForm } from '@/pages/pets/PetForm'
import { PetsList } from '@/pages/pets/PetsList'
import { HomePage } from '@/routes/HomeRoute'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import { createBrowserRouter } from 'react-router'

export const router = createBrowserRouter([
  // public only auth pages
  // no appshell as they're self-contained and have specific layout behavior)
  // PublicRoute redirects authenticated users away to /
  {
    element: <PublicRoute />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  // app layer
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      // at '/' level HomePage decides at render time whether to show landing or dashboard based on auth state
      { index: true, element: <HomePage /> },

      // protected pages
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'pets',
            children: [
              { index: true, element: <PetsList /> },
              { path: 'new', element: <PetForm /> },
              { path: ':id', element: <PetDetail /> },
              { path: ':id/edit', element: <PetForm /> },
            ],
          },
        ],
      },

      // catch-all 404 (inherits AppShell + standard padding)
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
