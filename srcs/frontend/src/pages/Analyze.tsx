import { useI18n } from '../i18n'

export default function Analyze() {
  const { t } = useI18n()
  return <h1 className="text-2xl font-bold">{t('analyze.title')}</h1>
}
