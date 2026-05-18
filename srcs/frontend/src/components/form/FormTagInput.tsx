import { FormField } from '@/components/form/FormField'
import { Button } from '@/components/ui/Button'
import { X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'

interface FormTagInputProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
  placeholder?: string
  className?: string
  id?: string
}

// form field that holds a string[] of tags
// each tag renders as a chip with a remove x
export function FormTagInput<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  placeholder,
  className,
  id,
}: FormTagInputProps<T>) {
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
          <TagInputBody
            id={inputId}
            value={(field.value as string[] | undefined) ?? []}
            onChange={field.onChange}
            placeholder={placeholder}
            ariaInvalid={errorMessage ? true : undefined}
            ariaDescribedBy={hint || errorMessage ? helperId : undefined}
          />
        )}
      />
    </FormField>
  )
}

interface TagInputBodyProps {
  id: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

// nput draft state
function TagInputBody({
  id,
  value,
  onChange,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
}: TagInputBodyProps) {
  const [draft, setDraft] = useState('')

  // commit the draft input as a new tag if it's not empty and not a duplicate
  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) {
      setDraft('')
      return
    }
    onChange([...value, trimmed])
    setDraft('')
  }

  // remove a tag by index
  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  // handle key events for committing and removing tags
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      e.preventDefault()
      remove(value.length - 1)
    }
  }

  return (
    <div className="border-border-soft focus-within:border-accent focus-within:ring-accent/30 flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border bg-transparent px-2 py-2 transition-colors focus-within:ring-2">
      {value.map((tag, i) => (
        <span
          key={`${tag}-${String(i)}`}
          className="bg-accent/12 text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
        >
          {tag}
          <Button
            variant="naked"
            onClick={() => remove(i)}
            aria-label={`Remove ${tag}`}
            className="hover:bg-accent/10 inline-flex h-4 w-4 items-center justify-center rounded-full"
          >
            <X size={12} aria-hidden />
          </Button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        className="text-text-hi placeholder:text-text-lo min-w-[8rem] flex-1 bg-transparent px-2 py-1 text-sm outline-none"
      />
    </div>
  )
}
