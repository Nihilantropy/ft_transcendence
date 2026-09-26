import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { LANGS, useI18n, type Lang } from '../i18n'
import { useMotion } from '../motion'
import NavBar from './NavBar'
import Sky from './Sky'

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  const { user } = useAuth()
  const { paused, setPaused } = useMotion()
  const { pathname } = useLocation()
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return } // a fresh load keeps focus at the top
    // Move focus to the new page's heading so screen readers announce it (WCAG 2.4.3); pages that
    // load data render their h1 later, so fall back to <main>.
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (h1) { h1.tabIndex = -1; h1.focus() } else document.getElementById('main')?.focus()
  }, [pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only rounded-2xl bg-card px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">
        {t('a11y.skip')}
      </a>
      <Sky />
      {user && <NavBar />}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 outline-none">
        <Outlet />
      </main>
      {/* pb-24 on mobile: room for the bottom nav bar */}
      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 px-4 pt-6 pb-24 md:pb-6">
        <Link to="/privacy" className="underline-offset-4 hover:underline">{t('footer.privacy')}</Link>
        <Link to="/terms" className="underline-offset-4 hover:underline">{t('footer.terms')}</Link>
        <Link to="/accessibility" className="underline-offset-4 hover:underline">{t('footer.accessibility')}</Link>
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
