import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import PasswordField from '../components/PasswordField'
import { useI18n } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { required, sameAs, strongPassword } from '../validation'

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
  const pw = useForm(PASSWORD_FORM)
  const [pwDone, setPwDone] = useState(false)
  // Bumped on every successful change: remounts the PasswordFields so their internal
  // value/reveal/caps state resets along with the (already-reset) form.
  const [pwGen, setPwGen] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [delError, setDelError] = useState<unknown>()

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setPwDone(false)
    const v = pw.check(form)
    if (!v) return
    pw.setBusy(true)
    try {
      // The server revokes every session and re-issues this one's cookies.
      await api('/auth/change-password', { method: 'PUT', body: v })
      form.reset()
      setPwDone(true)
      setPwGen((g) => g + 1)
    } catch (err) {
      pw.setApiError(form, err)
    } finally {
      pw.setBusy(false)
    }
  }

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

  const labels = {
    current_password: t('profile.current_password'),
    new_password: t('profile.new_password'),
    new_password_confirm: t('profile.new_password_confirm'),
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          <p>{user?.email}</p>
        </div>
        <Button variant="ghost" className="self-start" onClick={async () => { await logout(); navigate('/', { replace: true }) }}>
          {t('profile.logout')}
        </Button>
      </div>

      <Card>
        <form onSubmit={changePassword} onBlurCapture={pw.onBlur} className="flex flex-col gap-4" noValidate>
          <h2 className="text-2xl font-bold">{t('profile.password_title')}</h2>
          <PasswordField key={`current-${pwGen}`} label={labels.current_password} name="current_password" required
            autoComplete="current-password" error={pw.message('current_password')} />
          <PasswordField key={`new-${pwGen}`} label={labels.new_password} name="new_password" required rules
            autoComplete="new-password" error={pw.message('new_password')} />
          <PasswordField key={`confirm-${pwGen}`} label={labels.new_password_confirm} name="new_password_confirm" required
            autoComplete="new-password" error={pw.message('new_password_confirm')} />
          <ErrorSummary items={pw.summary(labels)} />
          {pw.apiError && !(pw.apiError instanceof ApiError && pw.apiError.code === 'VALIDATION_ERROR')
            ? <ErrorNote error={pw.apiError} /> : null}
          {pwDone && <p role="status" className="font-bold">{t('profile.password_done')}</p>}
          <Button busy={pw.busy} className="self-start">{t('profile.password_submit')}</Button>
        </form>
      </Card>

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
