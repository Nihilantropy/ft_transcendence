import { useId, type InputHTMLAttributes } from 'react'

export default function Field({ label, error, id, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generated = useId()
  const fieldId = id ?? (props.name ? `field-${props.name}` : generated)
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="font-bold">{label}</label>
      <input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-err` : undefined}
        aria-required={props.required || undefined}
        className="rounded-2xl border border-field bg-card px-4 py-3 focus-visible:outline-2 focus-visible:outline-accent" />
      {error && <p id={`${fieldId}-err`} className="text-danger">{error}</p>}
    </div>
  )
}
