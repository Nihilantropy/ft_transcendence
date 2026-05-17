import { Button } from '@/components/ui/Button'
import { ArrowRight, HeartPulse, ImageUp, ScanEye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LandingSection } from './components/LandingSection'
import { ScanAnimation } from './components/ScanAnimation'

const STEPS = [
  { key: 'step1', Icon: ImageUp },
  { key: 'step2', Icon: ScanEye },
  { key: 'step3', Icon: HeartPulse },
] as const

const STATS = [
  { key: 'item1', value: '190+' },
  { key: 'item2', value: '15' },
  { key: 'item3', value: '3' },
] as const

export function LandingPage() {
  const { t } = useTranslation('landing')

  return (
    <div>
      {/* Hero */}
      <section className="flex lg:py-16 flex-col justify-center">
        <div className="mx-auto w-full max-w-5xl px-4">
          <ScanAnimation size={160} />

          <h1
            className="text-text-hi mt-8 font-sans font-extrabold"
            style={{
              fontSize: 'var(--text-5xl)',
              lineHeight: 0.95,
              letterSpacing: '-0.015em',
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

          {/* CTA */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Button size="lg" width="responsive" asChild>
              <a href="/register">
                {t('cta.start')}
                <ArrowRight size={18} aria-hidden />
              </a>
            </Button>
            <Button size="lg" variant="outline" width="responsive" asChild>
              <a href="/login">{t('cta.login')}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <LandingSection label={t('howItWorks.label')}>
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-16">
          {STEPS.map(({ key, Icon }) => (
            <div key={key}>
              <Icon className="text-accent" size={32} strokeWidth={1.5} aria-hidden />
              <h3 className="text-text-hi mt-4 text-xl font-bold tracking-tight">
                {t(`howItWorks.${key}.title`)}
              </h3>
              <p className="text-text-mid mt-2 text-sm leading-relaxed">
                {t(`howItWorks.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </LandingSection>

      {/* Stats */}
      <LandingSection label={t('stats.label')} background="elevated">
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-16">
          {STATS.map(({ key, value }) => (
            <div key={key}>
              <p
                className="text-accent font-bold tracking-tight"
                style={{ fontSize: 'var(--text-5xl)', lineHeight: 1 }}
              >
                {value}
              </p>
              <p className="text-text-mid mt-4 max-w-xs text-sm leading-relaxed">
                {t(`stats.${key}.label`)}
              </p>
            </div>
          ))}
        </div>
      </LandingSection>

      {/* Contact */}
      <LandingSection label={t('contact.label')}>
        <h2
          className="text-text-hi font-sans font-extrabold"
          style={{
            fontSize: 'var(--text-4xl)',
            lineHeight: 0.95,
            letterSpacing: '-0.015em',
          }}
        >
          {t('contact.title')}
        </h2>
        <p
          className="text-text-mid mt-6 max-w-xl"
          style={{ fontSize: 'var(--text-lg)', lineHeight: 1.5 }}
        >
          {t('contact.body')}
        </p>
        <div className="mt-8">
          <Button size="lg" width="responsive" asChild>
            <a href={`mailto:${t('contact.email')}`}>
              {t('contact.cta')}
              <ArrowRight size={18} aria-hidden />
            </a>
          </Button>
        </div>
      </LandingSection>
    </div>
  )
}
