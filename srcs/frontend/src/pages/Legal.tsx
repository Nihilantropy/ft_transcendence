// Legal.tsx — Privacy Policy and Terms of Service, reachable logged out.
import { useI18n } from '../i18n'

export default function Legal({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useI18n()
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t(`${doc}.title`)}</h1>
      {[1, 2, 3, 4, 5].map((i) => <p key={i}>{t(`${doc}.p${i}`)}</p>)}
    </article>
  )
}
