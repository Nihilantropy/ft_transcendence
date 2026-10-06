import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

const LEGAL_LINKS = [
  { to: '/privacy', labelKey: 'footer.privacy' },
  { to: '/terms', labelKey: 'footer.terms' },
] as const

export function Footer() {
  const { t } = useTranslation('common')

  return (
    <footer className="text-text-lo border-border-soft bg-base shrink-0 border-t text-xs">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 py-6">
        <p>{t('footer.rights')}</p>
        <nav aria-label={t('footer.legal')}>
          <ul className="flex items-center gap-6">
            {LEGAL_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="hover:text-text-hi focus-visible:text-text-hi underline-offset-4 transition-colors hover:underline"
                >
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
