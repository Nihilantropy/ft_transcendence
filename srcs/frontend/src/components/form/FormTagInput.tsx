import { FormField } from '@/components/form/FormField'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Check, Plus, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'

// a ready-made tag: stored as value, shown as label
export interface TagSuggestion {
  value: string
  label: string
}

interface FormTagInputProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: Path<T>
  label?: ReactNode
  hint?: ReactNode
  placeholder?: string
  className?: string
  id?: string
  // toggle chips under the field
  suggestions?: TagSuggestion[]
  suggestionsLabel?: string
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
  suggestions,
  suggestionsLabel,
}: FormTagInputProps<T>) {
  const inputId = id ?? String(name)
  const helperId = `${inputId}-helper`
  const fieldError = form.formState.errors[name] as { message?: string } | undefined
  const errorMessage = fieldError?.message

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => {
        const value = (field.value as string[] | undefined) ?? []
        return (
          // the hint / error stays right under the input, the suggestions come after it
          <div className={cn('flex flex-col gap-2', className)}>
            <FormField label={label} hint={hint} error={errorMessage} htmlFor={inputId}>
              <TagInputBody
                id={inputId}
                value={value}
                onChange={field.onChange}
                placeholder={placeholder}
                ariaInvalid={errorMessage ? true : undefined}
                ariaDescribedBy={hint || errorMessage ? helperId : undefined}
                suggestions={suggestions}
              />
            </FormField>
            {suggestions && suggestions.length > 0 && (
              <TagSuggestions
                value={value}
                onChange={field.onChange}
                suggestions={suggestions}
                label={suggestionsLabel}
              />
            )}
          </div>
        )
      }}
    />
  )
}

interface TagInputBodyProps {
  id: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  suggestions?: TagSuggestion[]
}

// nput draft state
function TagInputBody({
  id,
  value,
  onChange,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
  suggestions,
}: TagInputBodyProps) {
  const [draft, setDraft] = useState('')

  // a suggested tag shows its label, anything typed shows as typed
  const labelOf = (tag: string) => suggestions?.find((s) => s.value === tag)?.label ?? tag

  // commit the draft input as a new tag if it's not empty and not a duplicate
  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase()
    // typing a suggestion's name stores its value, exactly as clicking its chip would
    const tag =
      suggestions?.find((s) => same(s.label, trimmed) || same(s.value, trimmed))?.value ?? trimmed
    const isDuplicate = value.some((v) => same(v, tag) || same(labelOf(v), labelOf(tag)))
    if (!isDuplicate) onChange([...value, tag])
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
          {labelOf(tag)}
          <Button
            variant="naked"
            onClick={() => remove(i)}
            aria-label={`Remove ${labelOf(tag)}`}
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

interface TagSuggestionsProps {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: TagSuggestion[]
  label?: string
}

function TagSuggestions({ value, onChange, suggestions, label }: TagSuggestionsProps) {
  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((v) => v !== tag) : [...value, tag])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="text-text-lo mr-1 text-xs">{label}</span>}
      {suggestions.map((s) => {
        const isOn = value.includes(s.value)
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => {
              toggle(s.value)
            }}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
              isOn
                ? 'bg-accent/12 text-accent border-transparent'
                : 'border-border-soft text-text-mid hover:border-accent/60 hover:text-text-hi',
            )}
          >
            {isOn ? <Check size={12} aria-hidden /> : <Plus size={12} aria-hidden />}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
