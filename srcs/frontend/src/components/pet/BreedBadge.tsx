import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface BreedBadgeProps {
  breed: string
  confidence?: number | null
  className?: string
}

// breed + AI-detection confidence
export function BreedBadge({ breed, confidence, className }: BreedBadgeProps) {
  const { t } = useTranslation('breeds')

  return (
    <span
      className={cn(
        'bg-accent/12 text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        className,
      )}
    >
      <span>{t(breed, { defaultValue: breed })}</span>
      {confidence && (
        <span className="text-accent/70 tabular-nums">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  )
}
