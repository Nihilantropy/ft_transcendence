import type { Pet } from '@/api/types'
import { BreedBadge } from '@/components/pet/BreedBadge'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Button } from '@/components/ui/Button'
import { Image } from '@/components/ui/Image'
import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface DetailHeroProps {
  pet: Pet
}

// top section of PetDetail: image, name, breed badge, edit action
export function DetailHero({ pet }: DetailHeroProps) {
  const { t } = useTranslation('pets')

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {pet.image_url ? (
          <Image
            src={pet.image_url}
            alt={pet.name}
            className="bg-elevated h-24 w-24 rounded-lg object-cover sm:h-32 sm:w-32"
          />
        ) : (
          <div
            className="bg-elevated text-text-lo flex h-24 w-24 items-center justify-center rounded-lg sm:h-32 sm:w-32"
            aria-hidden
          >
            {renderSpeciesIcon(pet.species, { size: 40, strokeWidth: 1.5 })}
          </div>
        )}
        <div>
          <h1 className="text-text-hi text-3xl font-bold tracking-tight sm:text-4xl">{pet.name}</h1>
          {pet.breed && (
            <div className="mt-2">
              <BreedBadge breed={pet.breed} confidence={pet.breed_confidence} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/pets/${pet.id}/edit`}>
            <Pencil size={14} aria-hidden />
            {t('detail.edit')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
