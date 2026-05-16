import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ScanAnimation } from './components/ScanAnimation'

export function LandingPage() {
  const { t } = useTranslation('landing')

  return (
    <main className="pb-section mx-auto max-w-5xl px-6 pt-12">
      <ScanAnimation size={140} />

      <h1
        className="text-text-hi mt-8 font-sans font-extrabold"
        style={{
          fontSize: 'var(--text-5xl)',
          lineHeight: 0.95,
          letterSpacing: '-0.035em',
        }}
      >
        {t('hero.titleLine1')}
        <br />
        <span className="text-accent">{t('hero.titleHighlight')}</span>
      </h1>

      <p
        className="text-text-mid mt-6 max-w-xl"
        style={{ fontSize: 'var(--text-lg)', lineHeight: 1.5 }}
      >
        {t('hero.subtitle')}
      </p>

      <div className="mt-10 flex flex-wrap gap-4">
        <Button size="lg">
          {t('cta.uploadPhoto')}
          <ArrowRight size={18} aria-hidden />
        </Button>
        <Button size="lg" variant="outline">
          {t('cta.browseBreeds')}
        </Button>
        <Button size="lg" variant="ghost">
          {t('cta.learnMore')}
        </Button>
      </div>
    </main>
  )
}
