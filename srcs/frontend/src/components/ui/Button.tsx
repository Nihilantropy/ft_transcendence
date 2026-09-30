import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import {
  Children,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'cursor-pointer select-none',
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
          'bg-accent text-white shadow-[0_8px_24px_-8px_var(--c-accent-glow)]',
          'hover:bg-accent-hi hover:shadow-[0_12px_32px_-8px_var(--c-accent-glow)]',
        ],
        outline: [
          'border border-border-soft text-text-hi bg-transparent',
          'hover:bg-accent/10 hover:border-accent/40',
        ],
        ghost: ['text-text-mid hover:text-text-hi hover:bg-accent/10'],
        subtle: ['bg-accent/16 text-accent hover:bg-accent/24'],
        link: ['text-accent underline-offset-4 hover:underline px-0 py-0 h-auto'],
        naked: ['bg-transparent hover:bg-transparent'],
      },
      size: {
        sm: 'h-9 min-w-20 px-3 text-sm rounded-md',
        md: 'h-11 min-w-28 px-5 text-sm rounded-md',
        lg: 'h-14 min-w-36 px-7 text-base rounded-md',
        icon: 'h-10 w-10 rounded-md',
      },
      width: {
        auto: '',
        full: 'w-full',
        responsive: 'w-full sm:w-auto',
      },
    },
    compoundVariants: [
      {
        variant: 'naked',
        className: 'h-auto min-w-0 p-0 rounded-none active:scale-100',
      },
    ],
    defaultVariants: {
      variant: 'copper',
      size: 'md',
      width: 'auto',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      width,
      asChild = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, width }), className)}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? renderLoading(children, asChild) : children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

// handle loading display based on the children structure and asChild prop (e.g. icon only children will be replaced, text only children will remain and prepended)
function renderLoading(children: ReactNode, asChild: boolean): ReactNode {
  const spinner = <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  if (asChild) {
    return (
      <>
        {spinner}
        {children}
      </>
    )
  }
  const items = Children.toArray(children)
  const first = items[0]
  if (first !== undefined && isValidElement(first)) {
    // first child is an element (treat as the leading icon) -> replace
    return (
      <>
        {spinner}
        {items.slice(1)}
      </>
    )
  }
  // text-only
  return (
    <>
      {spinner}
      {children}
    </>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants }
