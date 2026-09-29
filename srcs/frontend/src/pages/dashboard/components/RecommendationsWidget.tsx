import { ProductCard } from '@/components/recommendation/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { pickAcrossPets } from '@/lib/recommendations'
import { DashboardSection } from '@/pages/dashboard/components/widget-ui/DashboardSection'
import { ScrollableRow } from '@/pages/dashboard/components/widget-ui/ScrollableRow'
import { useListPets } from '@/queries/pets'
import { useFoodRecommendationsForPets } from '@/queries/recommendations'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function RecommendationsWidget() {
  const { t } = useTranslation('dashboard')
  const { data: pets, isPending: isPetsPending } = useListPets()
  const results = useFoodRecommendationsForPets(pets ?? [])

  const isPending = isPetsPending || results.some((r) => r.isPending)
  const hasPets = (pets?.length ?? 0) > 0
  // a pet whose request failed simply contributes nothing
  const picks = pickAcrossPets(
    pets ?? [],
    results.map((r) => r.data?.recommendations ?? []),
  )

  const rightSection = hasPets ? (
    <Link
      to="/recommendations"
      className="text-text-mid hover:text-accent text-xs underline-offset-4 hover:underline"
    >
      {t('blocks.recommendations.viewAll')}
    </Link>
  ) : undefined

  return (
    <DashboardSection
      label={t('blocks.recommendations.title')}
      rightSection={rightSection}
      className="lg:col-span-2"
    >
      {isPending ? (
        <RecommendationsRowSkeleton />
      ) : !hasPets ? (
        <div className="my-auto text-center lg:-translate-y-[22px]">
          <h3 className="text-text-hi text-base font-bold tracking-tight">
            {t('blocks.recommendations.empty.title')}
          </h3>
          <p className="text-text-mid mt-1 text-sm leading-relaxed">
            {t('blocks.recommendations.empty.message')}
          </p>
        </div>
      ) : picks.length === 0 ? (
        <p className="text-text-mid text-sm">{t('blocks.recommendations.noProducts')}</p>
      ) : (
        <ScrollableRow>
          <ul className="flex gap-3">
            {picks.map(({ pet, item }) => (
              <li key={`${pet.id}-${String(item.product_id)}`}>
                {/* with one pet every food is for it: no need to say so */}
                <ProductCard
                  item={item}
                  species={pet.species}
                  variant="compact"
                  petName={(pets?.length ?? 0) > 1 ? pet.name : undefined}
                  to={`/recommendations?pet=${pet.id}&product=${String(item.product_id)}`}
                />
              </li>
            ))}
          </ul>
        </ScrollableRow>
      )}
    </DashboardSection>
  )
}

function RecommendationsRowSkeleton() {
  return (
    <ul className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex-shrink-0">
          <Skeleton className="bg-text-lo/10 h-[154px] w-80 sm:w-88" />
        </li>
      ))}
    </ul>
  )
}
