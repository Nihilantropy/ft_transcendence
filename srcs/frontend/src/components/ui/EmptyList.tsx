import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyListSize = 'md' | 'lg'
type EmptyListVariant = 'card' | 'inline'

interface EmptyListProps {
  icon?: LucideIcon
  title: string
  message: string
  action?: ReactNode
  size?: EmptyListSize
  // 'card' (default) renders a dashed Card frame for standalone empty pages.
  // 'inline' renders only the centered content, for empty states that already live inside a parent surface (e.g. a dashboard widget) and should not double-frame
  variant?: EmptyListVariant
  headingLevel?: 2 | 3
  className?: string
}

const sizeMap = {
  md: {
    padding: 'px-6 py-12',
    iconSize: 32,
    titleSize: 'text-base',
    actionGap: 'mt-4',
  },
  lg: {
    padding: 'px-6 py-16',
    iconSize: 36,
    titleSize: 'text-lg',
    actionGap: 'mt-6',
  },
} as const

// generic empty state: centered icon (optional) + title + message + optional action.
// two variants:
// - 'card' for standalone empty pages
// - 'inline' for empties that nest inside another surface and should not double-frame
export function EmptyList({
  icon: Icon,
  title,
  message,
  action,
  size = 'md',
  variant = 'card',
  headingLevel = 3,
  className,
}: EmptyListProps) {
  const s = sizeMap[size]
  const HeadingTag: 'h2' | 'h3' = `h${headingLevel}`

  const content = (
    <>
      {Icon && <Icon size={s.iconSize} strokeWidth={1.5} className="text-text-lo" aria-hidden />}
      <HeadingTag
        className={cn('text-text-hi font-bold tracking-tight', s.titleSize, Icon && 'mt-4')}
      >
        {title}
      </HeadingTag>
      <p className="text-text-mid mt-2 max-w-sm text-sm leading-relaxed">{message}</p>
      {action && <div className={s.actionGap}>{action}</div>}
    </>
  )

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col items-center justify-center text-center', className)}>
        {content}
      </div>
    )
  }

  return (
    <Card
      radius="lg"
      background="none"
      borderStyle="dashed"
      className={cn('flex flex-col items-center justify-center text-center', s.padding, className)}
    >
      {content}
    </Card>
  )
}
