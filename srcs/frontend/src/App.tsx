import { Toaster } from '@/components/ui/Toast'
import { router } from '@/routes/router'
import { RouterProvider } from 'react-router'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}

export default App
