import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/Toast'
import { LandingPage } from '@/pages/landing/LandingPage'

function App() {
  return (
    <>
      <AppShell>
        <LandingPage />
      </AppShell>
      <Toaster />
    </>
  )
}

export default App
