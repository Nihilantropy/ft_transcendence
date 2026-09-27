import { useId, type InputHTMLAttributes } from 'react'

export default function Field({ label, error, hint, id, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generated = useId()
  const fieldId = id ?? (props.name ? `field-${props.name}` : generated)
  const described = [hint && `${fieldId}-hint`, error && `${fieldId}-err`].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="font-bold">{label}</label>
      {hint && <p id={`${fieldId}-hint`}>{hint}</p>}
      <input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={described || undefined}
        aria-required={props.required || undefined}
        className="rounded-2xl border border-field bg-card px-4 py-3 focus-visible:outline-2 focus-visible:outline-accent" />
      {error && <p id={`${fieldId}-err`} className="text-danger">{error}</p>}
    </div>
  )
}
