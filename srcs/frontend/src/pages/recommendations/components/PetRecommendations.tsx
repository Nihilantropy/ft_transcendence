import type { Pet } from '@/api/types'
import { ProductCard } from '@/components/recommendation/ProductCard'
import { EmptyList } from '@/components/ui/EmptyList'
import { Skeleton } from '@/components/ui/Skeleton'
import { getApiErrorMessage } from '@/lib/utils'
import { useFoodRecommendations } from '@/queries/recommendations'
import { Bone } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface PetRecommendationsProps {
  pet: Pet
  // the product the page was opened on scrolled into view
  focusedProductId?: number
}

// the ranked foods for one pet, best first
export function PetRecommendations({ pet, focusedProductId }: PetRecommendationsProps) {
  const { t } = useTranslation('recommendations')
  const { data, isPending, isError, error } = useFoodRecommendations(pet.id)
  const focusedRef = useRef<HTMLLIElement>(null)

  // once the list is there, bring the focused product to the middle of the screen
  useEffect(() => {
    focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [data, focusedProductId])

  if (isPending) return <RecommendationsGridSkeleton />

  if (isError) {
    return (
      <p className="text-text-mid mt-8 text-sm">
        {getApiErrorMessage(error, 'recommendations', t)}
      </p>
    )
  }

  if (data.recommendations.length === 0) {
    return (
      <div className="mt-8">
        <EmptyList
          icon={Bone}
          title={t('empty.noProducts.title', { name: pet.name })}
          message={
            pet.species === 'other'
              ? t('empty.noProducts.unsupportedSpecies')
              : t('empty.noProducts.message')
          }
          headingLevel={2}
        />
      </div>
    )
  }

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.recommendations.map((item) => (
        <li
          key={item.product_id}
          ref={item.product_id === focusedProductId ? focusedRef : undefined}
        >
          <ProductCard item={item} species={pet.species} />
        </li>
      ))}
    </ul>
  )
}

function RecommendationsGridSkeleton() {
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="bg-elevated h-80 rounded-lg" />
        </li>
      ))}
    </ul>
  )
}
