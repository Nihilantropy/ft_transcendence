import { cn } from '@/lib/utils/cn'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'select-none',
    'font-sans font-semibold tracking-tight',
    'transition-[transform,background-color,border-color,color,box-shadow]',
    'duration-200 ease-[var(--ease-out-expo)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        copper: [
          'bg-accent text-base shadow-[0_0_0_1px_var(--c-accent-hi),0_8px_24px_-8px_var(--c-accent-glow)]',
          'hover:bg-accent-hi hover:shadow-[0_0_0_1px_var(--c-accent-hi),0_12px_32px_-8px_var(--c-accent-glow)]',
        ],
        outline: [
          'border border-border-soft text-text-hi bg-transparent',
          'hover:bg-elevated hover:border-text-lo',
        ],
        ghost: ['text-text-mid hover:text-text-hi hover:bg-elevated'],
        link: ['text-accent underline-offset-4 hover:underline px-0 py-0 h-auto'],
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-5 text-sm rounded-md',
        lg: 'h-14 px-7 text-base rounded-md',
        icon: 'h-10 w-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'copper',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    )
  },
)
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants }
