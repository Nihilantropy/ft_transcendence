import { getInitials } from '@/lib/utils'
import { DetailsSection } from '@/pages/profile/components/DetailsSection'
import { LogoutButton } from '@/pages/profile/components/LogoutButton'
import { PasswordSection } from '@/pages/profile/components/PasswordSection'
import { TwoFactorSection } from '@/pages/profile/components/TwoFactorSection'
import { useUser } from '@/stores/auth'
import { useTranslation } from 'react-i18next'

// account settings: personal details, password, two-step verification
export function ProfilePage() {
  const { t } = useTranslation('profile')
  const user = useUser()
  if (!user) return null

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()

  return (
    <div className="page-container">
      {/* hero: large initials, name, email */}
      <div className="flex items-center gap-4 sm:gap-5">
        <div
          className="bg-accent/12 text-accent flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold tracking-wide sm:h-20 sm:w-20 sm:text-2xl"
          aria-hidden
        >
          {getInitials(user)}
        </div>
        <div className="min-w-0">
          <h1 className="text-text-hi truncate text-3xl font-bold tracking-tight">
            {fullName || t('title')}
          </h1>
          <p className="text-text-mid mt-1 truncate text-sm">{user.email}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-10">
        {/* key: re-mount the forms with fresh defaults when the user changes */}
        <DetailsSection key={`details-${user.email}`} user={user} />
        <PasswordSection key={`password-${String(user.has_password)}`} user={user} />
        <TwoFactorSection user={user} />
        {/* log out */}
        <div className="border-border-soft border-t pt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
