import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

interface DashboardSectionProps extends HTMLAttributes<HTMLElement> {
  label?: string
  rightSection?: ReactNode
}

// shared shell for the dashboard widgets
export function DashboardSection({
  label,
  rightSection,
  className,
  children,
  ...rest
}: DashboardSectionProps) {
  return (
    <Card
      asChild
      radius="lg"
      background="elevated"
      padding="md"
      className={cn('flex min-w-0 flex-col lg:min-h-[16rem]', className)}
    >
      <section {...rest}>
        {label && (
          <header className="flex min-h-7 items-center justify-between gap-4">
            <h2 className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
              {label}
            </h2>
            {rightSection}
          </header>
        )}
        <div className={cn('flex flex-1 flex-col', label && 'mt-4')}>{children}</div>
      </section>
    </Card>
  )
}
