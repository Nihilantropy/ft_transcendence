import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, fieldError } from '../api'
import { useAuth } from '../auth'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import Field from '../components/Field'
import { useI18n } from '../i18n'

export default function Profile() {
  const { t } = useI18n()
  const { user, logout, clear } = useAuth()
  const navigate = useNavigate()
  const [pwError, setPwError] = useState<unknown>()
  const [pwDone, setPwDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [delError, setDelError] = useState<unknown>()

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setPwError(undefined)
    setPwDone(false)
    try {
      // The server revokes every session and re-issues this one's cookies.
      await api('/auth/change-password', { method: 'PUT', body: Object.fromEntries(new FormData(form)) })
      form.reset()
      setPwDone(true)
    } catch (err) {
      setPwError(err)
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

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          <p>{user?.email}</p>
        </div>
        <Button variant="ghost" onClick={async () => { await logout(); navigate('/', { replace: true }) }}>
          {t('profile.logout')}
        </Button>
      </div>

      <Card>
        <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
          <h2 className="text-2xl font-bold">{t('profile.password_title')}</h2>
          <Field label={t('profile.current_password')} name="current_password" type="password"
            autoComplete="current-password" required error={fieldError(pwError, 'current_password')} />
          <Field label={t('profile.new_password')} name="new_password" type="password"
            autoComplete="new-password" required error={fieldError(pwError, 'new_password')} />
          <Field label={t('profile.new_password_confirm')} name="new_password_confirm" type="password"
            autoComplete="new-password" required error={fieldError(pwError, 'new_password_confirm')} />
          {pwError ? <ErrorNote error={pwError} /> : null}
          {pwDone && <p role="status" className="font-bold">{t('profile.password_done')}</p>}
          <Button>{t('profile.password_submit')}</Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t('profile.delete_title')}</h2>
        {!confirming ? (
          <Button variant="ghost" onClick={() => setConfirming(true)}>{t('profile.delete_start')}</Button>
        ) : (
          <>
            <p>{t('profile.delete_warning')}</p>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)}
                className="h-5 w-5 accent-[var(--danger)]" />
              {t('profile.delete_check')}
            </label>
            {delError ? <ErrorNote error={delError} /> : null}
            <Button variant="danger" disabled={!understood} onClick={deleteAccount}>{t('profile.delete_submit')}</Button>
          </>
        )}
      </Card>
    </section>
  )
}
