import { Brand } from '@/components/layout/Brand'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { NavDrawer } from '@/components/layout/NavDrawer'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { AUTHED_NAV } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useIsAuthenticated } from '@/stores/auth'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

interface HeaderProps {
  bordered?: boolean
}

export function Header({ bordered = false }: HeaderProps) {
  const { t } = useTranslation('common')
  const isAuthenticated = useIsAuthenticated()

  return (
    <header
      className={cn(
        'bg-base shrink-0 border-b transition-colors duration-200',
        bordered ? 'border-border-soft' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        {/* left: logo and nav links */}
        <div className="flex items-baseline gap-8">
          <Brand />
          {isAuthenticated && (
            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-baseline gap-6">
                {AUTHED_NAV.map(({ to, labelKey }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          'text-text-mid hover:text-text-hi text-sm font-medium transition-colors',
                          isActive && 'text-text-hi',
                        )
                      }
                    >
                      {t(labelKey)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        {/* right: toggles, logout button, mobile only burger */}
        <div className="-mr-3 flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          {isAuthenticated && (
            <>
              <LogoutButton className="hidden lg:inline-flex" />
              <NavDrawer items={AUTHED_NAV} />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
