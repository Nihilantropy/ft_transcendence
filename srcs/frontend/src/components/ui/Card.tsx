import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'

const cardVariants = cva('border-border-soft border', {
  variants: {
    radius: {
      md: 'rounded-md',
      lg: 'rounded-lg',
    },
    background: {
      elevated: 'bg-elevated',
      base: 'bg-base',
      none: '',
    },
    padding: {
      none: '',
      sm: 'p-2',
      md: 'p-4 sm:p-5',
      lg: 'p-6',
    },
    borderStyle: {
      solid: 'border-solid',
      dashed: 'border-dashed',
    },
    // clickable cards get a hover state and cursor pointer
    interactive: {
      true: 'hover:border-accent/60 transition-colors group',
      false: '',
    },
  },
  defaultVariants: {
    radius: 'md',
    background: 'elevated',
    padding: 'none',
    borderStyle: 'solid',
    interactive: false,
  },
})

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  asChild?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, radius, background, padding, borderStyle, interactive, asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div'
    return (
      <Comp
        ref={ref}
        className={cn(
          cardVariants({ radius, background, padding, borderStyle, interactive }),
          className,
        )}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'
