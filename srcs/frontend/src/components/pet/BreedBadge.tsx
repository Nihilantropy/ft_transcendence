import { splitMixBreed } from '@/lib/breeds'
import { cn, titleCase } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface BreedBadgeProps {
  breed: string
  confidence?: number | null
  className?: string
  // shown instead of the breed's name (e.g. "Crossbreed" for a mix)
  label?: string
}

// breed + AI-detection confidence
export function BreedBadge({ breed, confidence, className, label }: BreedBadgeProps) {
  const { t } = useTranslation('breeds')
  const name = (id: string) => t(id, { defaultValue: titleCase(id.replace(/_/g, ' ')) })
  const mix = splitMixBreed(breed)

  return (
    <span
      className={cn(
        'bg-accent/12 text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        className,
      )}
    >
      <span>
        {label ??
          (mix ? (
            <>
              {name(mix[0])}
              <span className="relative top-[0.12em] mx-1">×</span>
              {name(mix[1])}
            </>
          ) : (
            name(breed)
          ))}
      </span>
      {confidence && (
        <span className="text-accent/70 tabular-nums">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  )
}
