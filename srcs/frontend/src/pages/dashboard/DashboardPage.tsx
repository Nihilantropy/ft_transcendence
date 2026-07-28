import { getTimeOfDay } from '@/lib/utils'
import { useUser } from '@/stores/auth'
import { useTranslation } from 'react-i18next'
import { AnalyzeWidget } from './components/AnalyzeWidget'
import { PetsWidget } from './components/PetsWidget'

export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const user = useUser()

  const greeting = t(`greeting.${getTimeOfDay()}`)
  const firstName = user?.first_name?.trim()

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div>
        <h1 className="text-text-hi text-3xl font-bold tracking-tight">
          {firstName ? t('greeting.withName', { greeting, name: firstName }) : greeting}
        </h1>
        <p className="text-text-mid mt-2 text-sm">{t('intro')}</p>
      </div>

      <div className="mt-10 grid items-start gap-4 lg:grid-cols-2">
        <AnalyzeWidget />
        <PetsWidget />
      </div>
    </div>
  )
}
