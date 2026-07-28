import type { Pet } from '@/api/types'
import { BreedBadge } from '@/components/pet/BreedBadge'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Card } from '@/components/ui/Card'
import { Image } from '@/components/ui/Image'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface PetCardProps {
  pet: Pet
  // default: full card with breed badge + age
  // compact: square tile, name only
  variant?: 'default' | 'compact'
  className?: string
}

export function PetCard({ pet, variant = 'default', className }: PetCardProps) {
  const { t } = useTranslation('pets')

  if (variant === 'compact') {
    return (
      <Card
        asChild
        radius="md"
        background="base"
        padding="sm"
        interactive
        className={cn('flex w-28 flex-shrink-0 flex-col gap-2 sm:w-32', className)}
      >
        <Link to={`/pets/${pet.id}`}>
          <PetCardImage
            pet={pet}
            iconSize={24}
            className="bg-elevated aspect-square w-full rounded-md"
          />
          <p className="text-text-hi truncate text-sm font-medium">{pet.name}</p>
        </Link>
      </Card>
    )
  }

  return (
    <Card
      asChild
      radius="lg"
      background="elevated"
      interactive
      className={cn('block overflow-hidden', className)}
    >
      <Link to={`/pets/${pet.id}`}>
        <PetCardImage pet={pet} iconSize={32} className="bg-base aspect-[4/3] w-full" />
        <div className="p-4">
          <h3 className="text-text-hi truncate text-base font-bold tracking-tight">{pet.name}</h3>
          {/* fixed row height keeps every card the same height
              regardless of what combination of breed / age is present */}
          <div className="mt-2 flex h-6 items-center gap-2">
            {pet.breed && <BreedBadge breed={pet.breed} confidence={pet.breed_confidence} />}
            {pet.age != null && (
              <span className="text-text-mid text-xs">{t('age.years', { count: pet.age })}</span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  )
}

interface PetCardImageProps {
  pet: Pet
  iconSize: number
  className: string
}

// pet image or species-icon fallback
function PetCardImage({ pet, iconSize, className }: PetCardImageProps) {
  return (
    <div className={cn('overflow-hidden', className)}>
      {pet.image_url ? (
        <Image src={pet.image_url} alt={pet.name} className="h-full w-full object-cover" />
      ) : (
        <div className="text-text-lo flex h-full w-full items-center justify-center">
          {renderSpeciesIcon(pet.species, {
            size: iconSize,
            strokeWidth: 1.5,
            'aria-hidden': true,
          })}
        </div>
      )}
    </div>
  )
}
