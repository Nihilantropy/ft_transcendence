import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'border-border-soft text-text-hi placeholder:text-text-lo flex h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm',
        'transition-colors duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:border-accent focus-visible:ring-accent/30 focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
