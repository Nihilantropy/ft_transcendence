import type { Pet, PetPayload, Species } from '@/api/types'
import { FormAgeInput } from '@/components/form/FormAgeInput'
import { FormDropdown } from '@/components/form/FormDropdown'
import { FormNumberInput } from '@/components/form/FormNumberInput'
import { FormTagInput } from '@/components/form/FormTagInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { PetPhotoInput } from '@/components/pet/PetPhotoInput'
import { Button } from '@/components/ui/Button'
import type { DropdownOption } from '@/components/ui/Dropdown'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { applyAnalysisToPet, toAnalysisPayload, type NewPetFromAnalysisState } from '@/lib/analysis'
import { getBreedsForSpecies } from '@/lib/breeds'
import { HEALTH_CONDITION_CODES } from '@/lib/healthConditions'
import { getApiErrorMessage, titleCase } from '@/lib/utils'
import {
  useCreateAnalysisMutation,
  useCreatePetMutation,
  useDeletePetMutation,
  useGetPet,
  useUpdatePetMutation,
} from '@/queries/pets'
import { useUser } from '@/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { DeletePetDialog } from './components/DeletePetDialog'

function Form({ pet }: { pet?: Pet }) {
  const { t } = useTranslation(['pets', 'breeds'])
  const navigate = useNavigate()
  const isEdit = Boolean(pet)

  const createMutation = useCreatePetMutation()
  const updateMutation = useUpdatePetMutation()
  const saveAnalysisMutation = useCreateAnalysisMutation()
  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || saveAnalysisMutation.isPending

  // opened from the analysis chat with no pet to save the analysis to: it goes on the new one
  const user = useUser()
  const location = useLocation()
  const fromAnalysis = pet ? null : (location.state as NewPetFromAnalysisState | null)

  const deleteMutation = useDeletePetMutation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const handleDelete = () => {
    if (!pet) return
    deleteMutation.mutate(pet.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        void navigate('/pets')
      },
      onError: (error) => toast.error(getApiErrorMessage(error, 'pets', t)),
    })
  }

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t('pets:errors.nameRequired'))
      .max(100, t('pets:errors.nameTooLong')),
    species: z.enum(['dog', 'cat', 'other'], { message: t('pets:errors.speciesRequired') }),
    breed: z.string().max(100, t('pets:errors.breedTooLong')).optional(),
    age: z
      .number({ message: t('pets:errors.ageInvalid') })
      .int(t('pets:errors.ageInvalid'))
      .min(0, t('pets:errors.ageInvalid'))
      .max(150 * 12 + 11, t('pets:errors.ageTooLarge'))
      .nullable()
      .optional(),
    weight: z
      .number({ message: t('pets:errors.weightInvalid') })
      .positive(t('pets:errors.weightInvalid'))
      .max(500, t('pets:errors.weightTooLarge'))
      .nullable()
      .optional(),
    health_conditions: z.array(z.string()).optional(),
    photo: z.string().optional(),
  })

  const form = useForm<PetPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: pet?.name ?? '',
      species: pet?.species ?? undefined,
      breed: pet?.breed ?? '',
      age: pet?.age ?? null,
      weight: pet?.weight ?? null,
      health_conditions: pet?.health_conditions ?? [],
      photo: pet?.photo ?? '',
    },
  })

  const photo = useWatch({ control: form.control, name: 'photo' })

  // species drives the breed list
  const species = useWatch({ control: form.control, name: 'species' })

  const speciesOptions: DropdownOption<Species>[] = [
    { value: 'dog', label: t('pets:species.dog') },
    { value: 'cat', label: t('pets:species.cat') },
    { value: 'other', label: t('pets:species.other') },
  ]

  const breedOptions: DropdownOption[] = useMemo(
    () =>
      getBreedsForSpecies(species)
        .map((id) => ({
          value: id,
          label: t(`breeds:${id}`, { defaultValue: id }),
        }))
        // alphabetical by localized label
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [species, t],
  )

  // a breed belongs to one species: any change of species empties it
  const previousSpecies = useRef(species)
  useEffect(() => {
    if (previousSpecies.current === species) return
    previousSpecies.current = species
    form.setValue('breed', '')
  }, [species, form])

  // normalize user-typed proper nouns, then create or update based on mode
  const handleSubmit = (values: PetPayload) => {
    const payload: PetPayload = {
      ...values,
      name: titleCase(values.name),
      breed: values.species === 'other' && values.breed ? titleCase(values.breed) : values.breed,
    }

    if (pet) {
      updateMutation.mutate(
        { id: pet.id, payload },
        {
          onSuccess: (updated) => void navigate(`/pets/${updated.id}`),
          onError: (error) => toast.error(getApiErrorMessage(error, 'pets', t)),
        },
      )
    } else {
      const onCreated = (created: Pet) => {
        if (!fromAnalysis || !user) {
          void navigate(`/pets/${created.id}`)
          return
        }
        saveAnalysisMutation.mutate(toAnalysisPayload(fromAnalysis.analysis, created.id, user.id), {
          // the pet exists either way: land on it, and say so if the analysis did not stick
          onSettled: () => void navigate(`/pets/${created.id}`),
          onError: (error) => toast.error(getApiErrorMessage(error, 'analyze', t)),
        })
      }
      createMutation.mutate(fromAnalysis ? applyAnalysisToPet(payload, fromAnalysis) : payload, {
        onSuccess: onCreated,
        onError: (error) => toast.error(getApiErrorMessage(error, 'pets', t)),
      })
    }
  }

  // 'enter' in a text input must not implicitly submit, only the submit button does
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      onSubmit={(e) => {
        void form.handleSubmit(handleSubmit)(e)
      }}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-5"
    >
      <PetPhotoInput
        value={photo ?? ''}
        onChange={(value) => {
          form.setValue('photo', value, { shouldDirty: true })
        }}
        // a cleared species falls back to the generic paw icon
        species={species || undefined}
      />

      <FormTextInput
        form={form}
        name="name"
        label={t('pets:form.name')}
        placeholder={t('pets:form.namePlaceholder')}
        autoComplete="off"
      />

      <FormDropdown
        form={form}
        name="species"
        label={t('pets:form.species')}
        options={speciesOptions}
        placeholder={t('pets:form.speciesPlaceholder')}
        searchPlaceholder={t('pets:form.species')}
        clearable
        clearLabel={t('pets:form.clearSpecies')}
      />

      {species === 'other' ? (
        // no curated breed list for "other" species: let the user just type
        <FormTextInput
          form={form}
          name="breed"
          label={t('pets:form.breed')}
          placeholder={t('pets:form.breedPlaceholder')}
          autoComplete="off"
        />
      ) : (
        <FormDropdown
          form={form}
          name="breed"
          label={t('pets:form.breed')}
          placeholder={t('pets:form.breedPlaceholder')}
          searchPlaceholder={t('pets:form.breedPlaceholder')}
          options={breedOptions}
          clearable
          clearLabel={t('pets:form.clearBreed')}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormAgeInput
          form={form}
          name="age"
          yearsLabel={t('pets:form.ageYears')}
          monthsLabel={t('pets:form.ageMonths')}
          messages={{
            invalid: t('pets:errors.ageInvalid'),
            tooLarge: t('pets:errors.ageTooLarge'),
            monthsRange: t('pets:errors.monthsRange'),
          }}
        />
        <FormNumberInput
          form={form}
          name="weight"
          label={t('pets:form.weight')}
          placeholder={t('pets:form.weightPlaceholder')}
          allowDecimal
          autoComplete="off"
        />
      </div>

      <FormTagInput
        form={form}
        name="health_conditions"
        label={t('pets:form.healthConditions')}
        placeholder={t('pets:form.healthConditionsPlaceholder')}
        suggestions={HEALTH_CONDITION_CODES.map((code) => ({
          value: code,
          label: t(`pets:healthConditionCodes.${code}`),
        }))}
        suggestionsLabel={t('pets:form.healthConditionsSuggestions')}
      />

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
        {pet && (
          <Button
            type="button"
            variant="ghost"
            className="text-danger hover:text-danger font-normal sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={isSubmitting || deleteMutation.isPending}
          >
            <Trash2 size={14} aria-hidden />
            {t('pets:detail.delete')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => void navigate(-1)}
          disabled={isSubmitting}
        >
          {t('pets:form.cancel')}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? t('pets:form.submit.edit') : t('pets:form.submit.create')}
        </Button>
      </div>

      {pet && (
        <DeletePetDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          petName={pet.name}
          onConfirm={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </form>
  )
}

export function PetForm() {
  const { t } = useTranslation('pets')
  const { id } = useParams<{ id: string }>()
  // mode is derived from the route param / `pet` presence.
  const isEdit = Boolean(id)

  const { data: pet, isPending: isLoadingPet, isError } = useGetPet(id)

  if (isEdit && isLoadingPet) {
    return <PetFormSkeleton />
  }

  if (isEdit && (isError || !pet)) {
    return (
      <div className="mx-auto max-w-2xl px-4 text-center">
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

  return (
    <div className="mx-auto max-w-2xl px-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={pet ? `/pets/${pet.id}` : '/pets'}>
          <ArrowLeft size={16} aria-hidden />
          {pet ? pet.name : t('title')}
        </Link>
      </Button>

      <h1 className="text-text-hi mt-4 text-3xl font-bold tracking-tight">
        {isEdit ? t('form.title.edit') : t('form.title.create')}
      </h1>

      <div className="mt-8">
        <Form pet={pet} />
      </div>
    </div>
  )
}

function PetFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <Skeleton className="bg-elevated h-10 w-1/2" />
      <div className="mt-8 flex flex-col gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="bg-elevated h-12" />
        ))}
      </div>
    </div>
  )
}
