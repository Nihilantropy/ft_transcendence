import type { SpeciesFilter } from '@/api/types'
import { PetCard } from '@/components/pet/PetCard'
import { Button } from '@/components/ui/Button'
import { EmptyList } from '@/components/ui/EmptyList'
import { Skeleton } from '@/components/ui/Skeleton'
import { useListPets } from '@/queries/pets'
import { PawPrint, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Filters } from './components/Filters'

export function PetsList() {
  const { t } = useTranslation('pets')
  const { data: pets, isPending } = useListPets()

  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>('all')

  // client-side filter for search + species
  const filtered = useMemo(() => {
    if (!pets) return []
    const q = search.trim().toLowerCase()
    return pets.filter((p) => {
      if (speciesFilter !== 'all' && p.species !== speciesFilter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [pets, search, speciesFilter])

  const hasPets = (pets?.length ?? 0) > 0

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-text-hi text-3xl font-bold tracking-tight">{t('title')}</h1>
        {hasPets && (
          <Button asChild>
            <Link to="/pets/new">
              <Plus size={16} aria-hidden />
              {t('newPet')}
            </Link>
          </Button>
        )}
      </div>

      {isPending ? (
        <PetsGridSkeleton />
      ) : !hasPets ? (
        <div className="mt-10">
          {/* user has no pets */}
          <EmptyList
            icon={PawPrint}
            title={t('empty.title')}
            message={t('empty.message')}
            size="lg"
            headingLevel={2}
            action={
              <Button asChild>
                <Link to="/pets/new">
                  <Plus size={16} aria-hidden />
                  {t('empty.cta')}
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <Filters
              search={search}
              onSearchChange={setSearch}
              species={speciesFilter}
              onSpeciesChange={setSpeciesFilter}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <p className="text-text-mid text-sm">{t('noResults')}</p>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((pet) => (
                <li key={pet.id}>
                  <PetCard pet={pet} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function PetsGridSkeleton() {
  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="bg-elevated h-11 flex-1 rounded-md" />
        <Skeleton className="bg-elevated h-11 rounded-md sm:w-48" />
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="bg-elevated h-64 rounded-lg" />
          </li>
        ))}
      </ul>
    </>
  )
}
