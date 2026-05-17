import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

interface FormTextInputProps<T extends FieldValues> extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'form'
> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
}

export function FormTextInput<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  id,
  className,
  ...rest
}: FormTextInputProps<T>) {
  const inputId = id ?? name
  const helperId = `${inputId}-helper`
  const fieldError = form.formState.errors[name] as { message?: string } | undefined
  const errorMessage = fieldError?.message

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Input
        id={inputId}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={hint || errorMessage ? helperId : undefined}
        {...form.register(name)}
        {...rest}
      />
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
