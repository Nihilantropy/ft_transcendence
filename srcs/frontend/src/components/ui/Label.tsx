import { cn } from '@/lib/utils/cn'
import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react'

export const Label = forwardRef<
  ComponentRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-text-mid text-sm leading-none font-medium',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName
