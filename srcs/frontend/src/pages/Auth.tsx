import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { fieldError } from '../api'
import { useAuth } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import Field from '../components/Field'
import { useI18n } from '../i18n'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const { login, register } = useAuth()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    setError(undefined)
    try {
      // On success the user is set and <PublicOnly> redirects to /analyze.
      if (mode === 'login') await login(get('email'), get('password'))
      else await register(get('email'), get('password'), get('password_confirm'))
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const register_ = mode === 'register'
  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <h1 className="text-2xl font-bold">{t(register_ ? 'auth.register_title' : 'auth.login_title')}</h1>
        <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required
          error={fieldError(error, 'email')} />
        <Field label={t('auth.password')} name="password" type="password" required
          autoComplete={register_ ? 'new-password' : 'current-password'} error={fieldError(error, 'password')} />
        {register_ && (
          <Field label={t('auth.password_confirm')} name="password_confirm" type="password" required
            autoComplete="new-password" error={fieldError(error, 'password_confirm')} />
        )}
        {error ? <ErrorNote error={error} /> : null}
        <Button disabled={busy}>{t(register_ ? 'auth.register_submit' : 'auth.login_submit')}</Button>
        <Link to={register_ ? '/login' : '/register'} className="text-center text-accent underline-offset-4 hover:underline">
          {t(register_ ? 'auth.to_login' : 'auth.to_register')}
        </Link>
      </form>
    </Card>
  )
}
