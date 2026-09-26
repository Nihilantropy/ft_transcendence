import { useId, type InputHTMLAttributes } from 'react'

export default function Field({ label, error, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className="rounded-2xl border border-line bg-card px-4 py-3 focus-visible:outline-2 focus-visible:outline-accent"
        {...props} />
      {error && <p id={`${id}-err`} className="text-danger">{error}</p>}
    </div>
  )
}
