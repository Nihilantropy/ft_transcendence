// Legal.tsx — Privacy Policy, Terms of Service and the accessibility statement, reachable logged out.
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'

export default function Legal({ doc }: { doc: 'privacy' | 'terms' | 'accessibility' }) {
  const { t } = useI18n()
  usePageTitle(t(`${doc}.title`))
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t(`${doc}.title`)}</h1>
      {/* p5 in the accessibility statement now carries a bare GitHub issues URL: break-words so
          it wraps instead of forcing horizontal scroll at 320px (WCAG 1.4.10 reflow). */}
      {[1, 2, 3, 4, 5].map((i) => <p key={i} className="break-words">{t(`${doc}.p${i}`)}</p>)}
    </article>
  )
}
