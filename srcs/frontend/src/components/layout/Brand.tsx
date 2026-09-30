import { cn } from '@/lib/utils'
import { Link } from 'react-router'

interface BrandProps {
  to?: string
  className?: string
}

export function Brand({ to = '/', className }: BrandProps) {
  return (
    <Link
      to={to}
      className={cn(
        'text-text-hi font-sans text-lg font-bold tracking-tight lowercase select-none',
        className,
      )}
    >
      smartbreeds.
    </Link>
  )
}
