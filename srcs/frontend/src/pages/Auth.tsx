import { type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import Field from '../components/Field'
import PasswordField from '../components/PasswordField'
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { email, required, sameAs, strongPassword } from '../validation'

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
  usePageTitle(t(register_ ? 'page.register' : 'page.login'))

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const v = form.check(e.currentTarget)
    if (!v) return
    form.setBusy(true)
    try {
      // On success the user is set and <PublicOnly> redirects to /analyze.
      if (register_) await register(v.email, v.password, v.password_confirm)
      else await login(v.email, v.password)
    } catch (err) {
      form.setApiError(err)
      form.setBusy(false)
    }
  }

  const labels = { email: t('auth.email'), password: t('auth.password'), password_confirm: t('auth.password_confirm') }
  return (
    <Card className="mx-auto max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <h1 className="text-2xl font-bold">{t(register_ ? 'auth.register_title' : 'auth.login_title')}</h1>
        <Field label={labels.email} name="email" type="email" autoComplete="email" required error={form.message('email')} />
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
