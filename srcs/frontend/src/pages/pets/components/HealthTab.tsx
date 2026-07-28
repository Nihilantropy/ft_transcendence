import type { Pet } from '@/api/types'
import { useTranslation } from 'react-i18next'

interface HealthTabProps {
  pet: Pet
}

// health-condition list
// @TODO: future iterations can layer weight tracking, vaccinations, vet notes etc
// for now we list the conditions stored on the pet record
export function HealthTab({ pet }: HealthTabProps) {
  const { t } = useTranslation('pets')
  const conditions = pet.health_conditions ?? []

  return (
    <section>
      <h2 className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
        {t('health.conditions')}
      </h2>
      {conditions.length === 0 ? (
        <p className="text-text-mid mt-3 text-sm">{t('health.noConditions')}</p>
      ) : (
        <ul className="text-text-hi mt-3 space-y-1.5 text-sm">
          {conditions.map((c) => (
            <li key={c} className="flex items-center gap-2.5">
              {/* tiny dot */}
              <span className="bg-text-lo/60 h-1 w-1 flex-shrink-0 rounded-full" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
