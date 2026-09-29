import { Button } from '@/components/ui/Button'
import { useLogoutMutation } from '@/queries/auth'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function LogoutButton({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const mutation = useLogoutMutation()

  const onLogout = () => {
    mutation.mutate(undefined, {
      onSettled: () => {
        window.location.replace('/login')
      },
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onLogout}
      isLoading={mutation.isPending}
      className={className}
    >
      <LogOut size={14} aria-hidden />
      {t('auth.logout')}
    </Button>
  )
}
