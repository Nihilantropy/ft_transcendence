import { Button } from '@/components/ui/Button'
import { EmptyList } from '@/components/ui/EmptyList'
import { Skeleton } from '@/components/ui/Skeleton'
import { useListPets } from '@/queries/pets'
import { PawPrint, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { PetChips } from './components/PetChips'
import { PetRecommendations } from './components/PetRecommendations'

export function RecommendationsPage() {
  const { t } = useTranslation('recommendations')
  const { data: pets, isPending } = useListPets()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedPet = pets?.find((p) => p.id === searchParams.get('pet')) ?? pets?.[0]
  const focusedProductId = Number(searchParams.get('product')) || undefined

  return (
    <div className="page-container">
      <div>
        <h1 className="text-text-hi text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-text-mid mt-2 text-sm">{t('subtitle')}</p>
      </div>

      {isPending ? (
        <RecommendationsPageSkeleton />
      ) : !pets || !selectedPet ? (
        <div className="mt-10">
          {/* user has no pets */}
          <EmptyList
            icon={PawPrint}
            title={t('empty.noPets.title')}
            message={t('empty.noPets.message')}
            size="lg"
            headingLevel={2}
            action={
              <Button asChild>
                <Link to="/pets/new">
                  <Plus size={16} aria-hidden />
                  {t('empty.noPets.cta')}
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* a single pet needs no picker */}
          {pets.length > 1 && (
            <div className="mt-8">
              <PetChips
                pets={pets}
                selectedId={selectedPet.id}
                onSelect={(id) => {
                  setSearchParams({ pet: id })
                }}
                label={t('petPicker')}
              />
            </div>
          )}
          <PetRecommendations pet={selectedPet} focusedProductId={focusedProductId} />
        </>
      )}
    </div>
  )
}

function RecommendationsPageSkeleton() {
  return (
    <>
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="bg-elevated h-10 w-28 rounded-full" />
        ))}
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="bg-elevated h-80 rounded-lg" />
          </li>
        ))}
      </ul>
    </>
  )
}
