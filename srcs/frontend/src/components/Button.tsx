import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
const STYLES: Record<Variant, string> = {
  primary: 'bg-accent text-card hover:brightness-110',
  ghost: 'border border-field hover:bg-card',
  danger: 'bg-danger text-card hover:brightness-110',
}

// Also used on <Link>s that should look like buttons.
export function buttonClass(variant: Variant = 'primary') {
  return `inline-flex items-center justify-center rounded-2xl px-5 py-3 font-bold transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${STYLES[variant]}`
}

export default function Button({ variant = 'primary', className = '', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />
}
