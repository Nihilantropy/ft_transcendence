import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

interface FormPasswordInputProps<T extends FieldValues> extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'form' | 'type'
> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
  showLabel?: string
  hideLabel?: string
}

export function FormPasswordInput<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  id,
  className,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...rest
}: FormPasswordInputProps<T>) {
  const [visible, setVisible] = useState(false)
  const inputId = id ?? name
  const helperId = `${inputId}-helper`
  const fieldError = form.formState.errors[name] as { message?: string } | undefined
  const errorMessage = fieldError?.message

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className="pr-10"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={hint || errorMessage ? helperId : undefined}
          {...form.register(name)}
          {...rest}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          onClick={() => {
            setVisible((v) => !v)
          }}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 min-w-0"
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </Button>
      </div>
      {(hint || errorMessage) && (
        <p
          id={helperId}
          role={errorMessage ? 'alert' : undefined}
          className={cn('text-text-lo text-xs', errorMessage && 'text-danger')}
        >
          {errorMessage ?? hint}
        </p>
      )}
    </div>
  )
}
