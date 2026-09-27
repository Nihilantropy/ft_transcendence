// NavBar.tsx — bottom on mobile, top on desktop.
import { NavLink } from 'react-router'
import { useI18n } from '../i18n'

const item = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-2xl px-4 py-2 text-center font-bold md:flex-none ${isActive ? 'bg-accent text-card' : 'hover:bg-card'}`

export default function NavBar() {
  const { t } = useI18n()
  return (
    <nav aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card md:static md:border-t-0 md:bg-transparent">
      <div className="mx-auto flex max-w-3xl gap-2 p-2 md:px-4 md:pt-4">
        <NavLink to="/analyze" className={item}>{t('nav.analyze')}</NavLink>
        <NavLink to="/pets" className={item}>{t('nav.pets')}</NavLink>
        <NavLink to="/profile" className={item}>{t('nav.profile')}</NavLink>
      </div>
    </nav>
  )
}
