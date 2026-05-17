import { verify } from '@/api/routes'
import '@/i18n/i18n'
import { QueryProvider } from '@/providers/queryClient'
import { useAuthStore } from '@/stores/auth'
import '@/styles/globals.css'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

// try to recover an existing session via the HTTP-only refresh cookie before mounting the router, so guards see the auth state on first render
async function init(): Promise<void> {
  try {
    const user = await verify()
    useAuthStore.getState().setUser(user)
  } catch {
    // no session, or session is invalid
  } finally {
    useAuthStore.getState().setReady(true)
  }
}

void init().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <App />
        </ThemeProvider>
      </QueryProvider>
    </StrictMode>,
  )
})
