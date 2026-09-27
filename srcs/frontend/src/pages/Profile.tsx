import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth, type User } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import CodeField from '../components/CodeField'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import Field from '../components/Field'
import PasswordField from '../components/PasswordField'
import TwoFactorSection from '../components/TwoFactorSection'
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { CODE_RULES, email, max150, required, sameAs, strongPassword } from '../validation'

const PASSWORD_FORM = {
  current_password: [required],
  new_password: [required, strongPassword],
  new_password_confirm: [required, sameAs('new_password')],
}

export default function Profile() {
  const { t } = useI18n()
  usePageTitle(t('profile.title'))
  const { user, logout, clear } = useAuth()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [delError, setDelError] = useState<unknown>()

  async function deleteAccount() {
    setDelError(undefined)
    try {
      await api('/auth/delete', { method: 'DELETE' })
      clear()
      navigate('/', { replace: true })
    } catch (err) {
      setDelError(err)
    }
  }

  if (!user) return null // <RequireAuth> only renders this page with a user
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          {name && <p className="font-bold">{name}</p>}
          <p>{user.email}</p>
        </div>
        <Button variant="ghost" className="self-start" onClick={async () => { await logout(); navigate('/', { replace: true }) }}>
          {t('profile.logout')}
        </Button>
      </div>

      <DetailsForm user={user} />
      <TwoFactorSection />
      <PasswordForm twoFactor={user.two_factor_enabled} />

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t('profile.delete_title')}</h2>
        {!confirming ? (
          <Button variant="ghost" className="self-start" onClick={() => setConfirming(true)}>{t('profile.delete_start')}</Button>
        ) : (
          <>
            <p>{t('profile.delete_warning')}</p>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)}
                className="h-5 w-5 accent-[var(--danger)]" />
              {t('profile.delete_check')}
            </label>
            {delError ? <ErrorNote error={delError} /> : null}
            <Button variant="danger" className="self-start" disabled={!understood} onClick={deleteAccount}>{t('profile.delete_submit')}</Button>
          </>
        )}
      </Card>
    </section>
  )
}

function DetailsForm({ user }: { user: User }) {
  const { t } = useI18n()
  const { refreshUser } = useAuth()
  const [newEmail, setNewEmail] = useState(user.email)
  const [done, setDone] = useState(false)
  // A new email is a credential change: auth-service wants the password (and a 2FA code when on).
  const emailChanged = newEmail.trim().toLowerCase() !== user.email.toLowerCase()
  const form = useForm({
    first_name: [max150],
    last_name: [max150],
    email: [required, email],
    ...(emailChanged ? { current_password: [required] } : {}),
    ...(emailChanged && user.two_factor_enabled ? { code: CODE_RULES.any } : {}),
  }, 'details')

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form_ = e.currentTarget
    setDone(false)
    const v = form.check(form_)
    if (!v) return
    const body: Record<string, string> = { first_name: v.first_name.trim(), last_name: v.last_name.trim() }
    if (emailChanged) {
      body.email = v.email.trim()
      body.current_password = v.current_password
      if (user.two_factor_enabled) body.code = v.code
    }
    form.setBusy(true)
    try {
      // An email change revokes every session and re-issues this one's cookies.
      await api('/auth/me', { method: 'PATCH', body })
      await refreshUser()
      setDone(true)
    } catch (err) {
      form.setApiError(form_, err)
    } finally {
      form.setBusy(false)
    }
  }

  const labels = {
    first_name: t('profile.first_name'),
    last_name: t('profile.last_name'),
    email: t('profile.email'),
    current_password: t('profile.current_password'),
    code: t('code.any_label'),
  }
  return (
    <Card>
      <form onSubmit={save} onBlurCapture={form.onBlur} aria-labelledby="details-title" className="flex flex-col gap-4" noValidate>
        <h2 id="details-title" className="text-2xl font-bold">{t('profile.details_title')}</h2>
        <Field label={labels.first_name} name="first_name" id={form.id('first_name')} autoComplete="given-name"
          defaultValue={user.first_name} error={form.message('first_name')} />
        <Field label={labels.last_name} name="last_name" id={form.id('last_name')} autoComplete="family-name"
          defaultValue={user.last_name} error={form.message('last_name')} />
        <Field label={labels.email} name="email" id={form.id('email')} type="email" autoComplete="email" required
          value={newEmail} onChange={(e) => setNewEmail(e.target.value)} error={form.message('email')} />
        {emailChanged && (
          <>
            <p>{t('profile.email_confirm')}</p>
            <PasswordField label={labels.current_password} name="current_password" id={form.id('current_password')}
              required autoComplete="current-password" error={form.message('current_password')} />
            {user.two_factor_enabled && <CodeField kind="any" id={form.id('code')} error={form.message('code')} />}
          </>
        )}
        <ErrorSummary items={form.summary(labels)} />
        {form.note ? <ErrorNote error={form.note} /> : null}
        {done && <p role="status" className="font-bold">{t('profile.details_done')}</p>}
        <Button busy={form.busy} className="self-start">{t('profile.details_submit')}</Button>
      </form>
    </Card>
  )
}

function PasswordForm({ twoFactor }: { twoFactor: boolean }) {
  const { t } = useI18n()
  const pw = useForm(twoFactor ? { ...PASSWORD_FORM, code: CODE_RULES.any } : PASSWORD_FORM)
  const [done, setDone] = useState(false)

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setDone(false)
    const v = pw.check(form)
    if (!v) return
    pw.setBusy(true)
    try {
      // The server revokes every session and re-issues this one's cookies.
      await api('/auth/change-password', { method: 'PUT', body: v })
      form.reset()
      setDone(true)
    } catch (err) {
      pw.setApiError(form, err)
    } finally {
      pw.setBusy(false)
    }
  }

  const labels = {
    current_password: t('profile.current_password'),
    new_password: t('profile.new_password'),
    new_password_confirm: t('profile.new_password_confirm'),
    code: t('code.any_label'),
  }
  return (
    <Card>
      <form onSubmit={changePassword} onBlurCapture={pw.onBlur} aria-labelledby="password-title" className="flex flex-col gap-4" noValidate>
        <h2 id="password-title" className="text-2xl font-bold">{t('profile.password_title')}</h2>
        <PasswordField label={labels.current_password} name="current_password" required
          autoComplete="current-password" error={pw.message('current_password')} />
        <PasswordField label={labels.new_password} name="new_password" required rules
          autoComplete="new-password" error={pw.message('new_password')} />
        <PasswordField label={labels.new_password_confirm} name="new_password_confirm" required
          autoComplete="new-password" error={pw.message('new_password_confirm')} />
        {twoFactor && <CodeField kind="any" error={pw.message('code')} />}
        <ErrorSummary items={pw.summary(labels)} />
        {pw.note ? <ErrorNote error={pw.note} /> : null}
        {done && <p role="status" className="font-bold">{t('profile.password_done')}</p>}
        <Button busy={pw.busy} className="self-start">{t('profile.password_submit')}</Button>
      </form>
    </Card>
  )
}
