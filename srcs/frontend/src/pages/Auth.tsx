import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import CodeField from '../components/CodeField'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import Field from '../components/Field'
import PasswordField from '../components/PasswordField'
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { CODE_RULES, email, required, sameAs, strongPassword, type CodeKind } from '../validation'

const LOGIN = { email: [required, email], password: [required] }
const REGISTER = {
  email: [required, email],
  password: [required, strongPassword],
  password_confirm: [required, sameAs('password')],
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const { login, register } = useAuth()
  const register_ = mode === 'register'
  const form = useForm(register_ ? REGISTER : LOGIN)
  // Set after a correct password on a 2FA account: the card switches to the code step.
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState('')
  usePageTitle(t(register_ ? 'page.register' : 'page.login'))

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
    // No onBlurCapture here (unlike other forms): the code step is a single field, and
    // re-validating on blur would clear its visible error the instant the user mouses down on
    // "Verify" to fix it, shifting the button out from under the click before mouseup lands.
    <form onSubmit={submit} aria-labelledby="mfa-title" className="flex flex-col gap-4" noValidate>
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
