import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
  error?: string
  className?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, hint, error, id, className, ...inputProps }, ref) => {
    const helperId = id ? `${id}-helper` : undefined
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Label htmlFor={id}>{label}</Label>
        <Input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? helperId : undefined}
          {...inputProps}
        />
        {(hint || error) && (
          <p id={helperId} className={cn('text-text-lo text-xs', error && 'text-danger')}>
            {error ?? hint}
          </p>
        )}
      </div>
    )
  },
)
FormField.displayName = 'FormField'
