// import { useTranslation } from 'react-i18next' // TODO Phase 4-6: restore with NAV_ITEMS
import { Brand } from '@/components/layout/Brand'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils/cn'

interface HeaderProps {
  bordered?: boolean
}

export function Header({ bordered = false }: HeaderProps) {
  return (
    <header
      className={cn(
        'bg-base shrink-0 border-b transition-colors duration-200',
        bordered ? 'border-border-soft' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-8">
          <Brand />
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
