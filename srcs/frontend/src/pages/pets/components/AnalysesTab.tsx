import type { PetAnalysis, VisionAnalysisData } from '@/api/types'
import { BreedBadge } from '@/components/pet/BreedBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import { EmptyList } from '@/components/ui/EmptyList'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnalysisResultCard } from '@/pages/analyze/components/AnalysisResultCard'
import { useListPetAnalyses } from '@/queries/pets'
import { ArrowRight, ScanHeart } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface AnalysesTabProps {
  petId: string
}

// list of analyses for a pet, with date and breed detected
export function AnalysesTab({ petId }: AnalysesTabProps) {
  const { t, i18n } = useTranslation('pets')
  const { data: analyses, isPending, isError } = useListPetAnalyses(petId)
  const [openAnalysis, setOpenAnalysis] = useState<PetAnalysis | null>(null)

  if (isPending) {
    return <AnalysesSkeleton />
  }

  if (isError) {
    return <p className="text-text-mid text-sm">{t('analyses.loadError')}</p>
  }

  if (!analyses || analyses.length === 0) {
    return <EmptyState petId={petId} />
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {analyses.map((a) => {
          const hasReport = a.raw_response !== null
          const row = (
            <>
              <BreedBadge breed={a.breed_detected} confidence={a.confidence} />
              <time className="text-text-mid text-xs tabular-nums" dateTime={a.created_at}>
                {new Date(a.created_at).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </>
          )
          return (
            <Card
              asChild
              key={a.id}
              radius="md"
              background="elevated"
              interactive={hasReport}
              className="p-0"
            >
              <li>
                {hasReport ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenAnalysis(a)
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-4">{row}</div>
                )}
              </li>
            </Card>
          )
        })}
      </ul>

      <Dialog
        open={openAnalysis !== null}
        onOpenChange={(open) => {
          if (!open) setOpenAnalysis(null)
        }}
      >
        <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto pt-12">
          <DialogTitle className="sr-only">{t('analyses.reportTitle')}</DialogTitle>
          {openAnalysis?.raw_response && (
            <AnalysisResultCard
              data={openAnalysis.raw_response as unknown as VisionAnalysisData}
              hideSave
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AnalysesSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card asChild key={i} radius="md" background="elevated" className="p-0">
          <li className="flex items-center justify-between gap-4 p-4">
            <Skeleton className="bg-base rounded-full px-2.5 py-0.5 text-xs">
              <span className="invisible">Golden Retriever 00%</span>
            </Skeleton>
            <Skeleton className="bg-base w-24 text-xs">
              <span className="invisible">00 set 2026</span>
            </Skeleton>
          </li>
        </Card>
      ))}
    </ul>
  )
}

function EmptyState({ petId }: { petId: string }) {
  const { t } = useTranslation('pets')
  return (
    <EmptyList
      icon={ScanHeart}
      title={t('analyses.empty.title')}
      message={t('analyses.empty.message')}
      action={
        <Button variant="ghost" size="sm" asChild>
          {/* the chat pre-selects this pet in its save section */}
          <Link to="/analyze" state={{ pet: { id: petId } }}>
            {t('analyses.empty.cta')}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </Button>
      }
    />
  )
}
