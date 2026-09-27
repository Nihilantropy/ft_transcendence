import { Link } from 'react-router'
import { buttonClass } from '../components/Button'
import Illustration from '../components/Illustration'
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'

export default function Landing() {
  const { t } = useI18n()
  usePageTitle(t('page.home'))
  return (
    <section className="flex flex-col items-center gap-6 py-12 text-center">
      <Illustration name="hello" className="h-40 w-40 text-accent" />
      <h1 className="text-2xl font-bold">{t('landing.title')}</h1>
      <p>{t('landing.subtitle')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/register" className={buttonClass('primary')}>{t('landing.register')}</Link>
        <Link to="/login" className={buttonClass('ghost')}>{t('landing.login')}</Link>
      </div>
    </section>
  )
}
