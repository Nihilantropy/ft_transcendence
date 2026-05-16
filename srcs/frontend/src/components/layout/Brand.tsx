import { cn } from '@/lib/utils/cn'

interface BrandProps {
  href?: string
  className?: string
}

export function Brand({ href = '/', className }: BrandProps) {
  return (
    <a
      href={href}
      className={cn(
        'text-text-hi font-sans text-lg font-bold tracking-tight lowercase select-none',
        className,
      )}
    >
      smartbreeds.
    </a>
  )
}
