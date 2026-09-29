import type { Pet } from '@/api/types'
import { BreedBadge } from '@/components/pet/BreedBadge'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Button } from '@/components/ui/Button'
import { Image } from '@/components/ui/Image'
import { Pencil, ScanHeart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface DetailHeroProps {
  pet: Pet
}

// top section of PetDetail: image, name, breed badge, analyze + edit actions
export function DetailHero({ pet }: DetailHeroProps) {
  const { t } = useTranslation('pets')

  const src = pet.photo || pet.image_url

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {src ? (
          <Image
            src={src}
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
        {/* the chat pre-selects this pet and offers to update it with the result */}
        <Button variant="outline" size="sm" asChild>
          <Link to="/analyze" state={{ pet: { id: pet.id } }}>
            <ScanHeart size={14} aria-hidden />
            {t('detail.analyzeAgain')}
          </Link>
        </Button>
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
