/* eslint-disable react-refresh/only-export-components */

import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={(resolvedTheme as 'light' | 'dark' | undefined) ?? 'light'}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        style: { boxShadow: 'none' },
        classNames: {
          toast: 'border-border-soft bg-elevated text-text-hi border shadow-none',
        },
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
