import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  className?: string
}

export function Checkbox({ checked, onCheckedChange, children, className }: CheckboxProps) {
  return (
    <label
      className={cn('text-text-mid flex cursor-pointer items-center gap-3 text-sm', className)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onCheckedChange(e.target.checked)
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'border-border-soft flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          'peer-checked:border-accent peer-checked:bg-accent text-white',
          'peer-focus-visible:ring-accent peer-focus-visible:ring-offset-base peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
          '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      {children}
    </label>
  )
}
