import type { Pet } from '@/api/types'
import { useTranslation } from 'react-i18next'

interface OverviewTabProps {
  pet: Pet
}

// pet info: species, breed, age, weight, created_at
export function OverviewTab({ pet }: OverviewTabProps) {
  const { t, i18n } = useTranslation(['pets', 'breeds'])

  const fields: { label: string; value: string }[] = [
    { label: t('overview.species'), value: t(`species.${pet.species}`) },
    {
      label: t('overview.breed'),
      value: pet.breed
        ? t(`breeds:${pet.breed}`, { defaultValue: pet.breed })
        : t('overview.breedUnknown'),
    },
    {
      label: t('overview.age'),
      value: pet.age != null ? t('age.years', { count: pet.age }) : t('overview.ageUnknown'),
    },
    {
      label: t('overview.weight'),
      value: pet.weight != null ? t('weight', { value: pet.weight }) : t('overview.weightUnknown'),
    },
    {
      label: t('overview.createdAt'),
      value: new Date(pet.created_at).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
  ]

  return (
    <dl className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
            {f.label}
          </dt>
          <dd className="text-text-hi mt-1 text-base">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
