import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { downloadText, groupSecret, qrDataUri } from '../totp'
import { useForm } from '../useForm'
import { CODE_RULES, required, type CodeKind } from '../validation'
import Button from './Button'
import Card from './Card'
import CodeField from './CodeField'
import ErrorNote from './ErrorNote'
import ErrorSummary from './ErrorSummary'
import PasswordField from './PasswordField'

type Step = 'scan' | 'confirm' | 'codes' | 'off'
const ENABLE = { current_password: [required], code: CODE_RULES.totp }
const DISABLE = { current_password: [required], code: CODE_RULES.any }
const CODES_FILE = 'smartbreeds-recovery-codes.txt'

/** Profile section: turn TOTP 2FA on (QR + key → password + code → recovery codes) or off. */
export default function TwoFactorSection() {
  const { t } = useI18n()
  const { user, refreshUser } = useAuth()
  const on = !!user?.two_factor_enabled
  const dialog = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [setup, setSetup] = useState<{ secret: string; qr: string }>()
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [startError, setStartError] = useState<unknown>()
  const form = useForm(step === 'off' ? DISABLE : ENABLE, 'tfa')
  const kind: CodeKind = step === 'off' ? 'any' : 'totp'

  // Open once the step's content is rendered, so showModal() focuses its first control.
  useEffect(() => {
    if (step && !dialog.current?.open) dialog.current?.showModal()
  }, [step])

  function go(next: Step) {
    form.reset()
    setCopied(false)
    setStep(next)
  }

  function closed() {
    setStep(null)
    setSetup(undefined)
    setCodes([])
    setSaved(false)
    void refreshUser() // picks up two_factor_enabled after enable/disable
  }

  async function start() {
    setStartError(undefined)
    try {
      const d = await api<{ secret: string; otpauth_uri: string }>('/auth/2fa/setup', { method: 'POST' })
      setSetup({ secret: d.secret, qr: await qrDataUri(d.otpauth_uri) })
      go('scan')
    } catch (err) {
      setStartError(err)
    }
  }

  function copy(text: string) {
    // ponytail: no clipboard (denied, insecure context) → the text stays on screen to copy by hand
    navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const v = form.check(formEl)
    if (!v) return
    form.setBusy(true)
    try {
      if (step === 'off') {
        await api('/auth/2fa/disable', { method: 'POST', body: v })
        dialog.current?.close()
      } else {
        const d = await api<{ recovery_codes: string[] }>('/auth/2fa/enable', { method: 'POST', body: v })
        setCodes(d.recovery_codes)
        go('codes')
      }
    } catch (err) {
      form.setApiError(formEl, err)
    } finally {
      form.setBusy(false)
    }
  }

  const labels = { current_password: t('profile.current_password'), code: t(`code.${kind}_label`) }
  const cancel = <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>{t('tfa.cancel')}</Button>

  return (
    <Card>
      <section aria-labelledby="tfa-title" className="flex flex-col gap-4">
        <h2 id="tfa-title" className="text-2xl font-bold">{t('tfa.title')}</h2>
        <p className="font-bold">{t(on ? 'tfa.status_on' : 'tfa.status_off')}</p>
        <p>{t(on ? 'tfa.intro_on' : 'tfa.intro_off')}</p>
        {startError ? <ErrorNote error={startError} /> : null}
        <Button variant={on ? 'ghost' : 'primary'} className="self-start" onClick={on ? () => go('off') : start}>
          {t(on ? 'tfa.turn_off' : 'tfa.turn_on')}
        </Button>
      </section>

      {/* Escape may not skip the recovery codes: they are shown once. */}
      <dialog ref={dialog} aria-labelledby="tfa-dialog-title" onClose={closed}
        onCancel={(e) => { if (step === 'codes' && !saved) e.preventDefault() }}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl bg-card p-6 text-fg backdrop:bg-black/40">
        {step === 'scan' && setup && (
          <div className="flex flex-col gap-4">
            <h2 id="tfa-dialog-title" className="text-2xl font-bold">{t('tfa.dialog_title')}</h2>
            <p>{t('tfa.scan')}</p>
            <img src={setup.qr} alt={t('tfa.qr_alt')} width={200} height={200} className="self-center rounded-xl bg-white p-2" />
            <p className="font-bold">{t('tfa.secret_label')}</p>
            <code className="text-lg break-all">{groupSecret(setup.secret)}</code>
            <Button type="button" variant="ghost" className="self-start" onClick={() => copy(setup.secret)}>{t('tfa.copy')}</Button>
            <p role="status">{copied ? t('tfa.copied') : ''}</p>
            <div className="flex justify-end gap-3">
              {cancel}
              <Button type="button" onClick={() => go('confirm')}>{t('tfa.next')}</Button>
            </div>
          </div>
        )}

        {(step === 'confirm' || step === 'off') && (
          <form onSubmit={submit} onBlurCapture={form.onBlur} className="flex flex-col gap-4" noValidate>
            <h2 id="tfa-dialog-title" className="text-2xl font-bold">{t(step === 'off' ? 'tfa.off_title' : 'tfa.dialog_title')}</h2>
            <p>{t(step === 'off' ? 'tfa.off_intro' : 'tfa.confirm_intro')}</p>
            <PasswordField label={labels.current_password} name="current_password" id={form.id('current_password')}
              required autoFocus autoComplete="current-password" error={form.message('current_password')} />
            <CodeField kind={kind} id={form.id('code')} error={form.message('code')} />
            <ErrorSummary items={form.summary(labels)} />
            {form.note ? <ErrorNote error={form.note} /> : null}
            <div className="flex justify-end gap-3">
              {step === 'off'
                ? cancel
                : <Button type="button" variant="ghost" onClick={() => go('scan')}>{t('tfa.back')}</Button>}
              <Button busy={form.busy} variant={step === 'off' ? 'danger' : 'primary'}>
                {t(step === 'off' ? 'tfa.off_submit' : 'tfa.confirm_submit')}
              </Button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <div className="flex flex-col gap-4">
            <h2 id="tfa-dialog-title" className="text-2xl font-bold">{t('tfa.codes_title')}</h2>
            <p>{t('tfa.codes_intro')}</p>
            <ol className="grid grid-cols-1 gap-2 font-mono text-lg sm:grid-cols-2">
              {codes.map((c) => <li key={c}>{c}</li>)}
            </ol>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="ghost" autoFocus onClick={() => copy(codes.join('\n'))}>{t('tfa.copy')}</Button>
              <Button type="button" variant="ghost"
                onClick={() => downloadText(CODES_FILE, `${t('tfa.codes_title')}\n\n${codes.join('\n')}\n`)}>
                {t('tfa.download')}
              </Button>
            </div>
            <p role="status">{copied ? t('tfa.copied') : ''}</p>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)}
                className="h-5 w-5 accent-[var(--accent)]" />
              {t('tfa.codes_saved')}
            </label>
            <Button type="button" className="self-end" disabled={!saved} onClick={() => dialog.current?.close()}>
              {t('tfa.done')}
            </Button>
          </div>
        )}
      </dialog>
    </Card>
  )
}
