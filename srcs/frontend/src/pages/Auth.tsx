import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import Button, { buttonClass } from '../components/Button'
import Card from '../components/Card'
import CodeField from '../components/CodeField'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import Field from '../components/Field'
import PasswordField from '../components/PasswordField'
import { useI18n } from '../i18n'
import { OAUTH_42_START, readOAuthReturn } from '../oauth'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { CODE_RULES, email, required, sameAs, strongPassword, type CodeKind } from '../validation'

const LOGIN = { email: [required, email], password: [required] }
const REGISTER = {
  email: [required, email],
  password: [required, strongPassword],
  password_confirm: [required, sameAs('password')],
}

// A frontend-only ApiError code per non-mfa ?oauth= return; error.<code> carries the copy.
const OAUTH_ERROR_CODE = { error: 'OAUTH_FAILED', unavailable: 'OAUTH_UNAVAILABLE', exists: 'OAUTH_EXISTS' } as const

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const { login, register } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const register_ = mode === 'register'
  const form = useForm(register_ ? REGISTER : LOGIN)
  // Back from "Log in with 42" (/login?oauth=…): read once, before the effect below cleans the URL.
  const [oauth] = useState(() => (register_ ? null : readOAuthReturn(location.search, location.hash)))
  // Set after a correct password — or by the 42 callback — on a 2FA account: the card switches to the code step.
  const [mfaToken, setMfaToken] = useState<string | null>(oauth?.kind === 'mfa' ? oauth.token : null)
  const [lastEmail, setLastEmail] = useState('')
  usePageTitle(t(register_ ? 'page.register' : 'page.login'))

  // Once, on arrival: drop ?oauth= and the #challenge from the address bar (a replace, so neither
  // stays in history nor in a copied link), and explain a failed, unavailable or pre-existing 42 login.
  useEffect(() => {
    if (!oauth) return
    navigate(location.pathname, { replace: true })
    if (oauth.kind !== 'mfa') {
      form.setApiError(null, new ApiError(OAUTH_ERROR_CODE[oauth.kind], '', 0))
    }
  }, [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form_ = e.currentTarget
    const v = form.check(form_)
    if (!v) return
    form.setBusy(true)
    try {
      // On success the user is set and <PublicOnly> redirects to /analyze.
      if (register_) await register(v.email, v.password, v.password_confirm)
      else {
        const challenge = await login(v.email, v.password)
        if (challenge) {
          setLastEmail(v.email)
          setMfaToken(challenge.mfaToken)
          form.setBusy(false)
        }
      }
    } catch (err) {
      form.setApiError(form_, err)
      form.setBusy(false)
    }
  }

  function expired() {
    setMfaToken(null)
    form.setApiError(null, new ApiError('TOKEN_EXPIRED', '', 401))
  }

  if (mfaToken) {
    return (
      <Card className="mx-auto max-w-md">
        <CodeStep mfaToken={mfaToken} onExpired={expired} />
      </Card>
    )
  }

  const labels = { email: t('auth.email'), password: t('auth.password'), password_confirm: t('auth.password_confirm') }
  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={submit} onBlurCapture={form.onBlur} className="flex flex-col gap-4" noValidate>
        <h1 className="text-2xl font-bold">{t(register_ ? 'auth.register_title' : 'auth.login_title')}</h1>
        <Field label={labels.email} name="email" type="email" autoComplete="email" required
          defaultValue={lastEmail} error={form.message('email')} />
        <PasswordField label={labels.password} name="password" required rules={register_}
          autoComplete={register_ ? 'new-password' : 'current-password'} error={form.message('password')} />
        {register_ && (
          <PasswordField label={labels.password_confirm} name="password_confirm" required
            autoComplete="new-password" error={form.message('password_confirm')} />
        )}
        <ErrorSummary items={form.summary(labels)} />
        {form.apiError ? <ErrorNote error={form.apiError} /> : null}
        <Button busy={form.busy} className="self-start">{t(register_ ? 'auth.register_submit' : 'auth.login_submit')}</Button>
        {/* A plain link, not fetch: the browser itself must follow the redirects to the 42 intra and back. */}
        <a href={OAUTH_42_START} className={`${buttonClass('ghost')} gap-2 self-start`}>
          {/* Tabler "login-2" (MIT, see Illustration.tsx); the 42 logo is a trademark. */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 8v-2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-2" />
            <path d="M3 12h13l-3 -3" />
            <path d="M13 15l3 -3" />
          </svg>
          {t('auth.oauth_42')}
        </a>
        <Link to={register_ ? '/login' : '/register'} className="text-accent underline-offset-4 hover:underline">
          {t(register_ ? 'auth.to_login' : 'auth.to_register')}
        </Link>
      </form>
    </Card>
  )
}

function CodeStep({ mfaToken, onExpired }: { mfaToken: string; onExpired(): void }) {
  const { t } = useI18n()
  const { loginWithCode } = useAuth()
  const [kind, setKind] = useState<CodeKind>('totp')
  const form = useForm({ code: CODE_RULES[kind] })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form_ = e.currentTarget
    const v = form.check(form_)
    if (!v) return
    form.setBusy(true)
    try {
      await loginWithCode(mfaToken, v.code) // sets the user: <PublicOnly> redirects to /analyze
    } catch (err) {
      form.setBusy(false)
      // Challenge older than 5 minutes, or voided (2FA turned off meanwhile): only a new password step helps.
      if (err instanceof ApiError && (err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN')) onExpired()
      else form.setApiError(form_, err)
    }
  }

  function toggle() {
    form.reset()
    setKind(kind === 'totp' ? 'recovery' : 'totp')
  }

  return (
    <form onSubmit={submit} onBlurCapture={form.onBlur} aria-labelledby="mfa-title" className="flex flex-col gap-4" noValidate>
      <h1 id="mfa-title" className="text-2xl font-bold">{t('auth.mfa_title')}</h1>
      <p>{t(kind === 'totp' ? 'auth.mfa_intro' : 'auth.mfa_recovery_intro')}</p>
      <CodeField key={kind} kind={kind} autoFocus error={form.message('code')} />
      <ErrorSummary items={form.summary({ code: t(`code.${kind}_label`) })} />
      {form.note ? <ErrorNote error={form.note} /> : null}
      <Button busy={form.busy} className="self-start">{t('auth.mfa_submit')}</Button>
      <button type="button" onClick={toggle} className="self-start text-accent underline-offset-4 hover:underline">
        {t(kind === 'totp' ? 'auth.mfa_use_recovery' : 'auth.mfa_use_app')}
      </button>
    </form>
  )
}
