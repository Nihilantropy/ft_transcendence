import { BreedBadge } from '@/components/pet/BreedBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyList } from '@/components/ui/EmptyList'
import { Skeleton } from '@/components/ui/Skeleton'
import { useListPetAnalyses } from '@/queries/pets'
import { ArrowRight, ScanHeart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface AnalysesTabProps {
  petId: string
}

// list of analyses for a pet, with date and breed detected
export function AnalysesTab({ petId }: AnalysesTabProps) {
  const { t, i18n } = useTranslation('pets')
  const { data: analyses, isPending, isError } = useListPetAnalyses(petId)

  if (isPending) {
    return <AnalysesSkeleton />
  }

  if (isError) {
    return <p className="text-text-mid text-sm">{t('analyses.loadError')}</p>
  }

  if (!analyses || analyses.length === 0) {
    return <EmptyState />
  }

  return (
    <ul className="flex flex-col gap-3">
      {analyses.map((a) => (
        <Card
          asChild
          key={a.id}
          radius="md"
          background="elevated"
          className="flex items-center justify-between gap-4 p-4"
        >
          <li>
            <BreedBadge breed={a.breed_detected} confidence={a.confidence} />
            <time className="text-text-mid text-xs tabular-nums" dateTime={a.created_at}>
              {new Date(a.created_at).toLocaleDateString(i18n.language, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </time>
          </li>
        </Card>
      ))}
    </ul>
  )
}

function AnalysesSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="bg-elevated flex items-center justify-between rounded-md p-4">
          <Skeleton className="bg-base h-6 w-32 rounded-full" />
          <Skeleton className="bg-base h-4 w-24" />
        </li>
      ))}
    </ul>
  )
}

function EmptyState() {
  const { t } = useTranslation('pets')
  return (
    <EmptyList
      icon={ScanHeart}
      title={t('analyses.empty.title')}
      message={t('analyses.empty.message')}
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/analyze">
            {t('analyses.empty.cta')}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </Button>
      }
    />
  )
}
