import { useI18n } from '../i18n'
import type { CodeKind } from '../validation'
import Field from './Field'

/** The one 2FA code input: 6 digits from the app, a recovery code, or either. Always named "code". */
export default function CodeField({ kind, id, error, autoFocus }:
  { kind: CodeKind; id?: string; error?: string; autoFocus?: boolean }) {
  const { t } = useI18n()
  return (
    <Field label={t(`code.${kind}_label`)} hint={t(`code.${kind}_hint`)} name="code" id={id} required
      autoFocus={autoFocus} autoComplete={kind === 'recovery' ? 'off' : 'one-time-code'}
      inputMode={kind === 'totp' ? 'numeric' : 'text'} autoCapitalize="characters" spellCheck={false}
      maxLength={32} error={error} />
  )
}
