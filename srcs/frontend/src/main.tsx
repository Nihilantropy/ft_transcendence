import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import './index.css'
import { AuthProvider, PublicOnly, RequireAuth } from './auth'
import Layout from './components/Layout'
import { I18nProvider } from './i18n'
import Analyze from './pages/Analyze'
import AuthPage from './pages/Auth'
import Landing from './pages/Landing'
import Legal from './pages/Legal'
import Pets from './pages/Pets'
import PetDetail from './pages/PetDetail'
import Profile from './pages/Profile'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route element={<PublicOnly />}>
                <Route index element={<Landing />} />
                <Route path="login" element={<AuthPage mode="login" />} />
                <Route path="register" element={<AuthPage mode="register" />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route path="analyze" element={<Analyze />} />
                <Route path="pets" element={<Pets />} />
                <Route path="pets/:id" element={<PetDetail />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="privacy" element={<Legal doc="privacy" />} />
              <Route path="terms" element={<Legal doc="terms" />} />
              <Route path="accessibility" element={<Legal doc="accessibility" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
