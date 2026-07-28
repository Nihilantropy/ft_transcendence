import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useGetPet } from '@/queries/pets'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AnalysesTab } from './components/AnalysesTab'
import { DetailHero } from './components/DetailHero'
import { HealthTab } from './components/HealthTab'
import { OverviewTab } from './components/OverviewTab'

type Tab = 'overview' | 'health' | 'analyses'

export function PetDetail() {
  const { t } = useTranslation('pets')
  const { id } = useParams<{ id: string }>()

  const { data: pet, isPending, isError } = useGetPet(id)

  const [tab, setTab] = useState<Tab>('overview')

  if (isPending) return <DetailSkeleton />

  if (isError || !pet) {
    return (
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-text-mid">{t('detail.loadError')}</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/pets">
            <ArrowLeft size={16} aria-hidden />
            {t('title')}
          </Link>
        </Button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('detail.tabs.overview') },
    { id: 'health', label: t('detail.tabs.health') },
    { id: 'analyses', label: t('detail.tabs.analyses') },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/pets">
          <ArrowLeft size={16} aria-hidden />
          {t('title')}
        </Link>
      </Button>

      <div className="mt-6">
        <DetailHero pet={pet} />
      </div>

      <div className="border-border-soft mt-10 flex gap-6 border-b" role="tablist">
        {tabs.map((tInfo) => (
          <button
            key={tInfo.id}
            type="button"
            role="tab"
            aria-selected={tab === tInfo.id}
            onClick={() => setTab(tInfo.id)}
            className={cn(
              'text-text-mid hover:text-text-hi -mb-px cursor-pointer border-b-2 border-transparent px-1 py-3 text-sm font-medium transition-colors',
              tab === tInfo.id && 'border-accent text-text-hi',
            )}
          >
            {tInfo.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && <OverviewTab pet={pet} />}
        {tab === 'health' && <HealthTab pet={pet} />}
        {tab === 'analyses' && <AnalysesTab petId={pet.id} />}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <Skeleton className="bg-elevated h-8 w-32" />
      <div className="mt-6 flex items-center gap-4">
        <Skeleton className="bg-elevated h-24 w-24 rounded-lg sm:h-32 sm:w-32" />
        <div className="flex-1 space-y-3">
          <Skeleton className="bg-elevated h-9 w-48" />
          <Skeleton className="bg-elevated h-5 w-24" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="bg-elevated h-12" />
        ))}
      </div>
    </div>
  )
}
