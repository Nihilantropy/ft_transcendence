import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useLogoutMutation } from '@/queries/auth'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

interface LogoutButtonProps {
  variant?: 'icon' | 'text'
  className?: string
  onLogoutClick?: () => void
}

export function LogoutButton({
  variant = 'icon',
  className,
  onLogoutClick,
}: LogoutButtonProps = {}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const mutation = useLogoutMutation()

  const onLogout = () => {
    onLogoutClick?.()
    mutation.mutate(undefined, {
      onSettled: () => {
        void navigate('/', { replace: true })
      },
    })
  }

  if (variant === 'text') {
    return (
      <Button
        variant="naked"
        onClick={onLogout}
        disabled={mutation.isPending}
        className={cn(
          'text-text-hi hover:text-accent justify-start py-3 text-xl font-semibold transition-colors',
          className,
        )}
      >
        {t('auth.logout')}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onLogout}
      isLoading={mutation.isPending}
      aria-label={t('auth.logout')}
      className={className}
    >
      <LogOut size={18} aria-hidden />
    </Button>
  )
}
