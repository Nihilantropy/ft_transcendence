import { FormField } from '@/components/form/FormField'
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown'
import type { ReactNode } from 'react'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'

interface FormDropdownProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
  options: DropdownOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowCustom?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export function FormDropdown<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  allowCustom,
  disabled,
  className,
  id,
}: FormDropdownProps<T>) {
  const inputId = id ?? String(name)
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
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Dropdown
            id={inputId}
            value={field.value ?? ''}
            onChange={field.onChange}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            allowCustom={allowCustom}
            disabled={disabled}
            ariaInvalid={errorMessage ? true : undefined}
            ariaDescribedBy={hint || errorMessage ? helperId : undefined}
          />
        )}
      />
    </FormField>
  )
}
