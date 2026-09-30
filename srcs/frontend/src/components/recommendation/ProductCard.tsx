import type { RecommendationItem, Species } from '@/api/types'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Card } from '@/components/ui/Card'
import { Image } from '@/components/ui/Image'
import { currentLanguage } from '@/i18n/i18n'
import { formatPrice, matchReasonLabel, specificMatchReasons } from '@/lib/recommendations'
import { cn } from '@/lib/utils'
import { Bone, Fish, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface ProductCardProps {
  item: RecommendationItem
  // picks the placeholder when the catalog has no image
  species: Species
  variant?: 'default' | 'compact'
  petName?: string
  to?: string
  className?: string
}

export function ProductCard({
  item,
  species,
  variant = 'default',
  petName,
  to,
  className,
}: ProductCardProps) {
  const { t } = useTranslation('recommendations')

  if (variant === 'compact') {
    return (
      <ProductCardShell
        item={item}
        to={to}
        radius="md"
        background="base"
        className={cn('flex w-80 flex-shrink-0 items-center gap-4 px-4 py-5 sm:w-88', className)}
      >
        <ProductCardImage
          item={item}
          species={species}
          iconSize={20}
          className="bg-elevated h-28 w-28 flex-shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-text-lo truncate text-[10px] font-medium tracking-[0.15em] uppercase">
            {item.brand}
          </p>
          <p className="text-text-hi mt-1 line-clamp-3 text-sm leading-snug font-medium">
            {item.name}
          </p>
          {petName && (
            <span
              title={t('forPet', { name: petName })}
              className="bg-accent/12 text-accent mt-2.5 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            >
              {renderSpeciesIcon(species, { size: 12, strokeWidth: 1.75, 'aria-hidden': true })}
              <span className="sr-only">{t('forPet', { name: petName })}</span>
              <span aria-hidden className="truncate">
                {petName}
              </span>
            </span>
          )}
        </div>
      </ProductCardShell>
    )
  }

  const { protein_percentage, fat_percentage, calories_per_100g } = item.nutritional_highlights
  const nutrition = [
    protein_percentage != null && t('nutrition.protein', { value: protein_percentage }),
    fat_percentage != null && t('nutrition.fat', { value: fat_percentage }),
    calories_per_100g != null && t('nutrition.calories', { value: calories_per_100g }),
  ].filter(Boolean)
  const reasons = specificMatchReasons(item.match_reasons)

  return (
    <ProductCardShell
      item={item}
      to={to}
      radius="lg"
      background="elevated"
      className={cn('flex h-full flex-col overflow-hidden', className)}
    >
      <ProductCardImage
        item={item}
        species={species}
        iconSize={32}
        className="bg-base aspect-[4/3] w-full"
      />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-text-lo truncate text-xs font-medium tracking-[0.15em] uppercase">
          {item.brand}
        </p>
        <h3 className="text-text-hi mt-1 line-clamp-2 text-base font-bold tracking-tight">
          {item.name}
        </h3>
        <div className="mt-2 flex h-6 items-center gap-2">
          <ScoreBadge score={item.similarity_score} />
          {item.price != null && (
            <span className="text-text-hi ml-auto text-sm font-medium tabular-nums">
              {formatPrice(item.price, currentLanguage())}
            </span>
          )}
        </div>
        {reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="border-border-soft text-text-mid rounded-full border px-2.5 py-0.5 text-xs"
              >
                {matchReasonLabel(reason, t)}
              </li>
            ))}
          </ul>
        )}
        {nutrition.length > 0 && (
          // pushed to the bottom so the rows line up across the grid
          <p className="text-text-mid mt-auto pt-3 text-xs tabular-nums">{nutrition.join(' · ')}</p>
        )}
      </div>
    </ProductCardShell>
  )
}

interface ProductCardShellProps {
  item: RecommendationItem
  to?: string
  radius: 'md' | 'lg'
  background: 'elevated' | 'base'
  className: string
  children: ReactNode
}

// the card itself: an in-app link when given, a link to the shop when the catalog has one, a plain article otherwise
function ProductCardShell({
  item,
  to,
  radius,
  background,
  className,
  children,
}: ProductCardShellProps) {
  if (to) {
    return (
      <Card asChild radius={radius} background={background} interactive className={className}>
        <Link to={to}>{children}</Link>
      </Card>
    )
  }
  if (!item.product_url) {
    return (
      <Card asChild radius={radius} background={background} className={className}>
        <article>{children}</article>
      </Card>
    )
  }
  return (
    <Card asChild radius={radius} background={background} interactive className={className}>
      <a href={item.product_url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Card>
  )
}

// affinity with the pet
function ScoreBadge({ score }: { score: number }) {
  const { t } = useTranslation('recommendations')
  return (
    <span className="bg-accent/12 text-accent inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums">
      {t('score', { value: Math.round(score * 100) })}
    </span>
  )
}

const PLACEHOLDER_ICONS: Partial<Record<Species, LucideIcon>> = { dog: Bone, cat: Fish }

interface ProductCardImageProps {
  item: RecommendationItem
  species: Species
  iconSize: number
  className: string
}

// product picture / food icon fallback
function ProductCardImage({ item, species, iconSize, className }: ProductCardImageProps) {
  const Icon = PLACEHOLDER_ICONS[species] ?? Bone
  return (
    <div className={cn('overflow-hidden', className, item.image_url && 'bg-white p-2')}>
      {item.image_url ? (
        <Image src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
      ) : (
        <div className="text-text-lo flex h-full w-full items-center justify-center">
          <Icon size={iconSize} strokeWidth={1.5} aria-hidden />
        </div>
      )}
    </div>
  )
}
