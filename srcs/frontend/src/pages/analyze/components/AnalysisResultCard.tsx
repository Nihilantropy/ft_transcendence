import { ANALYSIS_IMAGE_PLACEHOLDER, type VisionAnalysisData } from '@/api/types'
import { BreedBadge } from '@/components/pet/BreedBadge'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown'
import { Image } from '@/components/ui/Image'
import { MarkdownLite } from '@/components/ui/MarkdownLite'
import { toast } from '@/components/ui/Toast'
import { cn, getApiErrorMessage } from '@/lib/utils'
import { useCreateAnalysisMutation, useListPets, useUpdatePetMutation } from '@/queries/pets'
import { useUser } from '@/stores/auth'
import { Check, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface AnalysisResultCardProps {
  data: VisionAnalysisData
  // the analyzed photo for the "save to pet" section: optional, because the analysis can be opened from a saved analysis
  photo?: string
  // pre-selected pet when the chat was opened from a pet's analyses tab
  initialPetId?: string
  // read-only mode: viewing an already-saved analysis (no save section)
  hideSave?: boolean
}

const TRAIT_VALUE_KEYS = {
  size: 'sizes',
  energy_level: 'energy',
} as const

// analysis report
export function AnalysisResultCard({
  data,
  photo,
  initialPetId,
  hideSave,
}: AnalysisResultCardProps) {
  const { t } = useTranslation(['analyze', 'breeds', 'pets'])
  const { breed_analysis: breed } = data

  const traitEntries = (['size', 'energy_level', 'temperament'] as const).flatMap((k) => {
    const raw = data.traits[k]
    if (typeof raw !== 'string' || raw.trim() === '') return []
    const value =
      k === 'temperament'
        ? raw
        : t(`analyze:result.${TRAIT_VALUE_KEYS[k]}.${raw}`, { defaultValue: raw })
    return [{ key: k, value }]
  })
  // LLM output: guard every list/string against null and whitespace-only values
  const healthObservations = (data.health_observations ?? []).filter((o) => o.trim() !== '')

  return (
    <Card radius="lg" background="elevated" padding="md" className="space-y-6">
      {/* breed header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-text-lo" aria-hidden>
            {renderSpeciesIcon(data.species === 'cat' ? 'cat' : 'dog', {
              size: 18,
              strokeWidth: 1.5,
            })}
          </span>
          <BreedBadge breed={breed.primary_breed} confidence={breed.confidence} />
        </div>
        {breed.is_likely_crossbreed &&
          breed.crossbreed_analysis &&
          (breed.crossbreed_analysis.common_name ??
            breed.crossbreed_analysis.detected_breeds.length > 0) && (
            <div className="text-text-mid text-sm">
              <span className="text-text-hi font-medium">{t('analyze:result.crossbreed')}: </span>
              {breed.crossbreed_analysis.common_name ??
                breed.crossbreed_analysis.detected_breeds.join(' × ')}
              {breed.crossbreed_analysis.confidence_reasoning.trim() !== '' && (
                <p className="text-text-lo mt-0.5 text-xs">
                  {breed.crossbreed_analysis.confidence_reasoning}
                </p>
              )}
            </div>
          )}
      </div>

      {/* description of this animal */}
      {data.description.trim() !== '' && <MarkdownLite text={data.description} />}

      {/* traits (LLM output, keys optional) */}
      {traitEntries.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {traitEntries.map(({ key, value }) => (
            <div key={key}>
              <dt className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
                {t(`analyze:result.${key}`)}
              </dt>
              <dd className="text-text-hi mt-1 text-sm first-letter:uppercase">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* visible health observations */}
      {healthObservations.length > 0 && (
        <ResultSection title={t('analyze:result.health')}>
          <ul className="text-text-hi space-y-1.5 text-sm">
            {healthObservations.map((obs) => (
              <li key={obs} className="flex items-center gap-2.5">
                <span className="bg-text-lo/60 h-1 w-1 flex-shrink-0 rounded-full" aria-hidden />
                {obs}
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      {!hideSave && <SaveSection data={data} photo={photo} initialPetId={initialPetId} />}
    </Card>
  )
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

interface SaveSectionProps {
  data: VisionAnalysisData
  photo?: string
  initialPetId?: string
}

// save-to-pet: pet picker + save button
function SaveSection({ data, photo, initialPetId }: SaveSectionProps) {
  const { t } = useTranslation(['analyze', 'pets', 'breeds'])
  const user = useUser()
  const { data: pets } = useListPets()
  const [petId, setPetId] = useState(initialPetId ?? '')
  // opened for a specific pet: save straight to it, the picker only on request
  const [isPicking, setIsPicking] = useState(false)
  const [askUpdate, setAskUpdate] = useState(false)
  const [usePhoto, setUsePhoto] = useState(false)
  const saveMutation = useCreateAnalysisMutation()
  const updatePetMutation = useUpdatePetMutation()

  const detectedBreed = data.breed_analysis.primary_breed
  // the AI only answers for dogs and cats
  const detectedSpecies = data.species === 'cat' || data.species === 'dog' ? data.species : null
  const savedPet = (pets ?? []).find((p) => p.id === petId)

  const handleSave = () => {
    if (!petId || !user) return
    saveMutation.mutate(
      {
        pet_id: petId,
        user_id: user.id,
        image_url: ANALYSIS_IMAGE_PLACEHOLDER,
        breed_detected: detectedBreed,
        confidence: data.breed_analysis.confidence,
        traits: data.traits,
        raw_response: data,
      },
      {
        onSuccess: () => {
          if (!savedPet) return
          // propose the update only when it would change something
          const breedDiffers = savedPet.breed !== detectedBreed
          if (breedDiffers || photo) {
            // a pet without a photo gets this one by default; an existing photo stays
            setUsePhoto(Boolean(photo) && !savedPet.photo)
            setAskUpdate(true)
          }
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'analyze', t)),
      },
    )
  }

  const handleUpdate = () => {
    if (!savedPet) return
    updatePetMutation.mutate(
      {
        id: savedPet.id,
        payload: {
          species: detectedSpecies ?? savedPet.species,
          breed: detectedBreed,
          breed_confidence: data.breed_analysis.confidence,
          ...(usePhoto && photo ? { photo } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('analyze:save.updated', { name: savedPet.name }))
          setAskUpdate(false)
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'analyze', t)),
      },
    )
  }

  if (saveMutation.isSuccess) {
    return (
      <div className="border-border-soft text-success flex items-center gap-2 border-t pt-4 text-sm">
        <Check size={16} aria-hidden />
        {t('analyze:save.success')}

        <Dialog open={askUpdate} onOpenChange={setAskUpdate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('analyze:save.updateTitle', { name: savedPet?.name ?? '' })}
              </DialogTitle>
              <DialogDescription>
                {t('analyze:save.updateMessage', {
                  name: savedPet?.name ?? '',
                  breed: t(`breeds:${detectedBreed}`, { defaultValue: detectedBreed }),
                  confidence: Math.round(data.breed_analysis.confidence * 100),
                })}
              </DialogDescription>
            </DialogHeader>
            {/*the analyzed photo as the pet's profile photo */}
            {photo && (
              <Checkbox
                checked={usePhoto}
                onCheckedChange={setUsePhoto}
                className={cn(
                  'border-border-soft hover:border-accent/40 rounded-md border p-3 transition-colors',
                  usePhoto && 'border-accent/60 bg-accent/5',
                )}
              >
                <Image
                  src={photo}
                  alt=""
                  className="bg-base h-12 w-12 shrink-0 rounded-md object-cover"
                />
                <span className="text-text-hi">
                  {t('analyze:save.usePhoto', { name: savedPet?.name ?? '' })}
                </span>
              </Checkbox>
            )}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setAskUpdate(false)
                }}
                disabled={updatePetMutation.isPending}
              >
                {t('analyze:save.updateSkip')}
              </Button>
              <Button onClick={handleUpdate} isLoading={updatePetMutation.isPending}>
                {t('analyze:save.updateCta', { name: savedPet?.name ?? '' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const petOptions: DropdownOption[] = (pets ?? []).map((p) => ({ value: p.id, label: p.name }))
  const initialPet = (pets ?? []).find((p) => p.id === initialPetId)

  return (
    <div className="border-border-soft border-t pt-4">
      <p className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
        {t('analyze:save.title')}
      </p>
      {initialPet && !isPicking ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button size="sm" onClick={handleSave} isLoading={saveMutation.isPending}>
            {t('analyze:save.ctaFor', { name: initialPet.name })}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsPicking(true)
            }}
            disabled={saveMutation.isPending}
            className="h-auto min-w-0 px-0 text-xs font-medium"
          >
            {t('analyze:save.pickAnother')}
          </Button>
        </div>
      ) : petOptions.length === 0 ? (
        <Button variant="ghost" size="sm" asChild className="mt-3 -ml-2">
          <Link to="/pets/new">
            <Plus size={14} aria-hidden />
            {t('analyze:save.noPets')}
          </Link>
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-56">
            <Dropdown
              value={petId}
              onChange={setPetId}
              options={petOptions}
              placeholder={t('analyze:save.selectPet')}
              searchPlaceholder={t('analyze:save.selectPet')}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!petId}
            isLoading={saveMutation.isPending}
          >
            {t('analyze:save.cta')}
          </Button>
        </div>
      )}
    </div>
  )
}
