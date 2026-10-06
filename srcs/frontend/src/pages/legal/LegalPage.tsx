import { MarkdownLite } from '@/components/ui/MarkdownLite'
import { currentLanguage } from '@/i18n/i18n'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

// bump when the text of either document changes
const LAST_UPDATED = new Date('2026-10-06')

export type LegalDoc = 'privacy' | 'terms'

const OTHER: Record<LegalDoc, { doc: LegalDoc; to: string }> = {
  privacy: { doc: 'terms', to: '/terms' },
  terms: { doc: 'privacy', to: '/privacy' },
}

interface Section {
  title: string
  body: string
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation('legal')
  const sections = t(`${doc}.sections`, { returnObjects: true }) as Section[]
  const other = OTHER[doc]
  const updated = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'long' }).format(
    LAST_UPDATED,
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <header className="max-w-3xl">
        <p className="text-text-mid text-sm font-medium tracking-[0.2em] uppercase">
          {t('eyebrow')}
        </p>
        <h1
          className="text-text-hi mt-4 font-sans font-extrabold"
          style={{ fontSize: 'var(--text-4xl)', lineHeight: 1, letterSpacing: '-0.015em' }}
        >
          {t(`${doc}.title`)}
        </h1>
        <p className="text-text-lo mt-4 text-sm">{t('updated', { date: updated })}</p>
        <p className="text-text-mid mt-6" style={{ fontSize: 'var(--text-lg)', lineHeight: 1.5 }}>
          {t(`${doc}.intro`)}
        </p>
      </header>

      <div className="border-border-soft mt-12 grid gap-12 border-t pt-12 lg:grid-cols-[13rem_1fr] lg:gap-16">
        {/* table of contents, desktop only: on mobile the sections are short enough to scroll */}
        <nav aria-label={t('toc')} className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-text-lo mb-4 text-xs font-medium tracking-[0.2em] uppercase">
              {t('toc')}
            </p>
            <ol className="space-y-2.5">
              {sections.map((section, i) => (
                <li key={i}>
                  <a
                    href={`#${doc}-${i + 1}`}
                    className="text-text-mid hover:text-accent flex gap-3 text-sm leading-snug transition-colors"
                  >
                    <span className="text-text-lo tabular-nums">{pad(i + 1)}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-3xl space-y-12">
          {sections.map((section, i) => (
            <section
              key={i}
              id={`${doc}-${i + 1}`}
              aria-labelledby={`${doc}-${i + 1}-title`}
              className="scroll-mt-6"
            >
              <h2
                id={`${doc}-${i + 1}-title`}
                className="text-text-hi flex items-baseline gap-4 text-xl font-bold tracking-tight"
              >
                <span className="text-accent text-sm font-semibold tabular-nums">{pad(i + 1)}</span>
                {section.title}
              </h2>
              <MarkdownLite
                text={section.body}
                className="mt-4 space-y-3 leading-relaxed sm:pl-9"
              />
            </section>
          ))}

          {/* cross-link to the companion document */}
          <Link
            to={other.to}
            className="group bg-elevated border-border-soft hover:border-accent flex items-center justify-between gap-6 rounded-2xl border p-6 transition-colors"
          >
            <span>
              <span className="text-text-lo block text-xs font-medium tracking-[0.2em] uppercase">
                {t('seeAlso')}
              </span>
              <span className="text-text-hi mt-1 block text-lg font-bold tracking-tight">
                {t(`${other.doc}.title`)}
              </span>
            </span>
            <ArrowRight
              size={20}
              className="text-accent shrink-0 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </article>
      </div>
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
