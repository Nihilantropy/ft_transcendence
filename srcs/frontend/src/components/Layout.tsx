import { Link, Outlet } from 'react-router'
import { useAuth } from '../auth'
import { LANGS, useI18n, type Lang } from '../i18n'
import { useMotion } from '../motion'
import NavBar from './NavBar'
import Sky from './Sky'

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  const { user } = useAuth()
  const { paused, setPaused } = useMotion()
  return (
    <div className="flex min-h-dvh flex-col">
      <Sky />
      {user && <NavBar />}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      {/* pb-24 on mobile: room for the bottom nav bar */}
      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 px-4 pt-6 pb-24 md:pb-6">
        <Link to="/privacy" className="underline-offset-4 hover:underline">{t('footer.privacy')}</Link>
        <Link to="/terms" className="underline-offset-4 hover:underline">{t('footer.terms')}</Link>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}
          className={`ml-auto rounded-2xl border border-field px-3 py-1 ${paused ? 'bg-accent text-card' : 'bg-card'}`}>
          {t('motion.pause')}
        </button>
        <select aria-label={t('footer.language')} value={lang} onChange={(e) => setLang(e.target.value as Lang)}
          className="rounded-2xl border border-field bg-card px-3 py-1">
          {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </footer>
    </div>
  )
}
