import { Button } from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'

type Lang = 'it' | 'en'

export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage as Lang | undefined) ?? 'it'
  const next: Lang = current === 'it' ? 'en' : 'it'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        void i18n.changeLanguage(next)
      }}
      aria-label={t('accessibility.switchLanguage')}
      className="text-xs font-normal tracking-[0.18em] uppercase"
    >
      {current}
    </Button>
  )
}
