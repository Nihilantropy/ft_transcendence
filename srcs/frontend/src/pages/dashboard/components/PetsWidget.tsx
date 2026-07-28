import { PetCard } from '@/components/pet/PetCard'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { DashboardSection } from '@/pages/dashboard/components/widget-ui/DashboardSection'
import { ScrollableRow } from '@/pages/dashboard/components/widget-ui/ScrollableRow'
import { useListPets } from '@/queries/pets'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

// bento widget that previews the user's pets as a horizontally scrollable row of compact tiles
export function PetsWidget() {
  const { t } = useTranslation('dashboard')
  const { data: pets, isPending } = useListPets()
  const hasPets = (pets?.length ?? 0) > 0

  const rightSection = hasPets ? (
    <div className="flex items-center gap-3">
      <Link
        to="/pets"
        className="text-text-mid hover:text-accent text-xs underline-offset-4 hover:underline"
      >
        {t('blocks.pets.viewAll')}
      </Link>
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="h-7 w-7"
        aria-label={t('blocks.pets.empty.cta')}
      >
        <Link to="/pets/new">
          <Plus size={14} aria-hidden />
        </Link>
      </Button>
    </div>
  ) : undefined

  return (
    <DashboardSection label={t('blocks.pets.title')} rightSection={rightSection}>
      {isPending ? (
        <PetsRowSkeleton />
      ) : hasPets ? (
        <ScrollableRow>
          <ul className="flex gap-3">
            {pets?.map((p) => (
              <li key={p.id}>
                <PetCard pet={p} variant="compact" />
              </li>
            ))}
          </ul>
        </ScrollableRow>
      ) : (
        <div className="text-center">
          <h3 className="text-text-hi text-base font-bold tracking-tight">
            {t('blocks.pets.empty.title')}
          </h3>
          <p className="text-text-mid mt-2 text-sm leading-relaxed">
            {t('blocks.pets.empty.message')}
          </p>
          <Button asChild className="mt-4">
            <Link to="/pets/new">
              <Plus size={16} aria-hidden />
              {t('blocks.pets.empty.cta')}
            </Link>
          </Button>
        </div>
      )}
    </DashboardSection>
  )
}

function PetsRowSkeleton() {
  return (
    <ul className="flex gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="bg-text-lo/10 h-[140px] w-28 sm:w-32" />
        </li>
      ))}
    </ul>
  )
}
