import { FormField } from '@/components/form/FormField'
import { NumberInput } from '@/components/ui/NumberInput'
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

interface FormNumberInputProps<T extends FieldValues> extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'form' | 'type'
> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
  allowDecimal?: boolean
}

export function FormNumberInput<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  allowDecimal = false,
  id,
  className,
  ...rest
}: FormNumberInputProps<T>) {
  const inputId = id ?? String(name)
  const helperId = `${inputId}-helper`
  const fieldError = form.formState.errors[name] as { message?: string } | undefined
  const errorMessage = fieldError?.message

  const step = allowDecimal ? 0.1 : 1

  const bump = (direction: 1 | -1) => {
    const current = form.getValues(name)
    const base = typeof current === 'number' && Number.isFinite(current) ? current : 0
    const raw = base + direction * step
    const next = allowDecimal
      ? Math.max(0, Math.round(raw * 10) / 10)
      : Math.max(0, Math.round(raw))
    form.setValue(name, next as never, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <FormField
      label={label}
      hint={hint}
      error={errorMessage}
      htmlFor={inputId}
      className={className}
    >
      <NumberInput
        id={inputId}
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        step={step}
        onStep={bump}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={hint || errorMessage ? helperId : undefined}
        {...form.register(name, {
          setValueAs: (v: unknown) => {
            if (v === '' || v === null || v === undefined) return null
            const n = Number(v)
            return Number.isFinite(n) ? n : null
          },
        })}
        {...rest}
      />
    </FormField>
  )
}
