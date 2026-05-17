import { Button } from '@/components/ui/Button'
import { useLogoutMutation } from '@/queries/auth'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

export function DashboardPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const logoutMutation = useLogoutMutation()

  const onLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        void navigate('/', { replace: true })
      },
    })
  }

  return (
    <div className="py-section mx-auto max-w-5xl px-4">
      <h1 className="text-text-hi text-3xl font-bold">Dashboard</h1>
      <p className="text-text-mid mt-2 text-sm">This is just a placeholder. Hello hello.</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onLogout}
        isLoading={logoutMutation.isPending}
        className="mt-6"
      >
        {t('auth.logout')}
      </Button>
    </div>
  )
}
