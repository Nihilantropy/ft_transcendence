import { FormField } from '@/components/form/FormField'
import { Input } from '@/components/ui/Input'
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
    <FormField
      label={label}
      hint={hint}
      error={errorMessage}
      htmlFor={inputId}
      className={className}
    >
      <Input
        id={inputId}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={hint || errorMessage ? helperId : undefined}
        {...form.register(name)}
        {...rest}
      />
    </FormField>
  )
}
