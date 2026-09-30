import { buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/auth'
import { UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

export function UserAvatar({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const user = useUser()
  if (!user) return null

  return (
    <NavLink
      to="/profile"
      aria-label={t('nav.profile')}
      title={t('nav.profile')}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          isActive && 'text-accent hover:text-accent',
          className,
        )
      }
    >
      <UserRound size={18} aria-hidden />
    </NavLink>
  )
}
