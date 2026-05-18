import { FormField } from '@/components/form/FormField'
import { Button } from '@/components/ui/Button'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

  const bump = (delta: number) => {
    const current = form.getValues(name)
    const base = typeof current === 'number' && Number.isFinite(current) ? current : 0
    const next = allowDecimal
      ? Math.max(0, Math.round((base + delta) * 10) / 10)
      : Math.max(0, Math.round(base + delta))
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
      <div className="border-border-soft focus-within:border-accent focus-within:ring-accent/30 relative flex h-11 w-full items-center rounded-md border bg-transparent transition-colors focus-within:ring-2">
        <input
          id={inputId}
          type="number"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          step={step}
          min={0}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={hint || errorMessage ? helperId : undefined}
          // hide native spinner arrows so our custom buttons are the only control
          className="text-text-hi placeholder:text-text-lo h-full w-full bg-transparent px-3 py-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          {...form.register(name, {
            setValueAs: (v: unknown) => {
              if (v === '' || v === null || v === undefined) return null
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            },
          })}
          {...rest}
        />
        <div className="flex h-full flex-col">
          <Button
            variant="naked"
            type="button"
            tabIndex={-1}
            onClick={() => bump(step)}
            aria-label="Increment"
            className="text-text-mid hover:text-accent flex flex-1 items-end justify-center px-2 transition-colors"
          >
            <ChevronUp size={12} aria-hidden />
          </Button>
          <Button
            variant="naked"
            type="button"
            tabIndex={-1}
            onClick={() => bump(-step)}
            aria-label="Decrement"
            className="text-text-mid hover:text-accent flex flex-1 items-start justify-center px-2 pt-1 transition-colors"
          >
            <ChevronDown size={12} aria-hidden />
          </Button>
        </div>
      </div>
    </FormField>
  )
}
