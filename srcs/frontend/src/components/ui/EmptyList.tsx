import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyListSize = 'md' | 'lg'

interface EmptyListProps {
  icon?: LucideIcon
  title: string
  message: string
  action?: ReactNode
  // 'lg' for a whole empty page, 'md' for an empty section inside one
  size?: EmptyListSize
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
    padding: 'px-6 py-16 sm:py-24',
    iconSize: 36,
    titleSize: 'text-xl',
    actionGap: 'mt-6',
  },
} as const

// generic empty state on the same surface as the dashboard widgets:
// centered icon (optional) + title + message + optional action
export function EmptyList({
  icon: Icon,
  title,
  message,
  action,
  size = 'md',
  headingLevel = 3,
  className,
}: EmptyListProps) {
  const s = sizeMap[size]
  const HeadingTag: 'h2' | 'h3' = `h${headingLevel}`

  return (
    <Card
      radius="lg"
      background="elevated"
      className={cn('flex flex-col items-center justify-center text-center', s.padding, className)}
    >
      {Icon && <Icon size={s.iconSize} strokeWidth={1.5} className="text-text-lo" aria-hidden />}
      <HeadingTag
        className={cn('text-text-hi font-bold tracking-tight', s.titleSize, Icon && 'mt-4')}
      >
        {title}
      </HeadingTag>
      <p className="text-text-mid mt-2 max-w-sm text-sm leading-relaxed">{message}</p>
      {action && <div className={s.actionGap}>{action}</div>}
    </Card>
  )
}
