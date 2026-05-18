import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface FormFieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}

// generic form wrapper: label + body + hint/error footer.
export function FormField({ label, hint, error, htmlFor, className, children }: FormFieldProps) {
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {(hint || error) && (
        <p
          id={helperId}
          role={error ? 'alert' : undefined}
          className={cn('text-text-lo text-xs', error && 'text-danger')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
