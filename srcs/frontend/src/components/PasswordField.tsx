import { useState, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n'
import { PASSWORD_RULES } from '../validation'

// Tabler "eye" / "eye-off" (MIT, see Illustration.tsx).
const EYE = (
  <>
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
  </>
)
const EYE_OFF = (
  <>
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </>
)

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; rules?: boolean }

export default function PasswordField({ label, error, rules = false, onChange, ...props }: Props) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [caps, setCaps] = useState(false)
  const [value, setValue] = useState('')
  const id = `field-${props.name}`
  const described = [error && `${id}-err`, rules && `${id}-rules`, caps && `${id}-caps`].filter(Boolean).join(' ')
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'))

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">{label}</label>
      <div className="relative">
        <input {...props} id={id} type={visible ? 'text' : 'password'} aria-invalid={!!error}
          aria-describedby={described || undefined} aria-required={props.required || undefined}
          onKeyDown={onKey} onKeyUp={onKey}
          onChange={(e) => { setValue(e.target.value); onChange?.(e) }}
          className="w-full rounded-2xl border border-field bg-card py-3 pr-14 pl-4 focus-visible:outline-2 focus-visible:outline-accent" />
        <button type="button" aria-controls={id} aria-pressed={visible} aria-label={t('password.show')}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {visible ? EYE_OFF : EYE}
          </svg>
        </button>
      </div>
      {caps && <p id={`${id}-caps`} role="status" className="font-bold">{t('password.caps')}</p>}
      {rules && (
        <>
          <ul id={`${id}-rules`} className="flex flex-col gap-0.5">
            {PASSWORD_RULES.map((r) => {
              const met = r.test(value)
              return (
                <li key={r.id} data-rule={r.id} data-met={met} className="flex items-center gap-2">
                  <span aria-hidden="true">{met ? '✓' : '○'}</span>
                  {t(r.key)}<span className="sr-only">{t(met ? 'password.rule_met' : 'password.rule_unmet')}</span>
                </li>
              )
            })}
          </ul>
          <p aria-live="polite" className="sr-only">
            {t('password.rules_status').replace('{met}', String(PASSWORD_RULES.filter((r) => r.test(value)).length))}
          </p>
        </>
      )}
      {error && <p id={`${id}-err`} className="text-danger">{error}</p>}
    </div>
  )
}
