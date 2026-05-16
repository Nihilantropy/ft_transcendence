import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export function Header() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <a
        href="/"
        className="text-text-hi font-sans text-lg font-bold tracking-tight lowercase select-none"
      >
        smartbreeds
      </a>
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}
