import { useI18n } from '../i18n'

/** WCAG 3.3.1: one announced list of what to fix, each item linking to its field. */
export default function ErrorSummary({ items }: { items: { id: string; text: string }[] }) {
  const { t } = useI18n()
  if (items.length === 0) return null
  return (
    <div role="alert" className="rounded-2xl border-2 border-danger p-4">
      <p className="font-bold">{t('validation.summary')}</p>
      <ul className="list-disc pl-5">
        {items.map((i) => (
          <li key={i.id}><a href={`#${i.id}`} className="underline">{i.text}</a></li>
        ))}
      </ul>
    </div>
  )
}
