import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage } from '@/lib/utils'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

// auth-service validation messages we know, mapped to localized copy
const KNOWN_MESSAGES: Record<string, string> = {
  'Current password is incorrect.': 'errors.wrongPassword',
  'Current password is required to change your email.': 'errors.passwordRequired',
  'A two-factor authentication code is required.': 'errors.codeRequired',
  'New passwords do not match.': 'errors.passwordMismatch',
  'New password must be different from the current password.': 'errors.samePassword',
  'A user with this email already exists.': 'errors.emailExists',
}

// generic message per field when the backend text is not in the table above
const FIELD_FALLBACK: Record<string, string> = {
  new_password: 'errors.weakPassword',
  current_password: 'errors.wrongPassword',
  code: 'errors.INVALID_2FA_CODE',
  email: 'errors.invalidEmail',
}

export function useFormErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
): (error: unknown) => void {
  const { t } = useTranslation('profile')

  return (error) => {
    const { code, details } = error as { code?: string; details?: Record<string, string[]> }
    const fields = Object.keys(form.getValues())

    const setField = (field: string, key: string) => {
      form.setError(field as Path<T>, { message: t(key) }, { shouldFocus: true })
    }

    if (code === 'INVALID_2FA_CODE' && fields.includes('code')) {
      setField('code', 'errors.INVALID_2FA_CODE')
      return
    }
    if (code === 'EMAIL_ALREADY_EXISTS' && fields.includes('email')) {
      setField('email', 'errors.emailExists')
      return
    }

    let pinned = false
    for (const [field, messages] of Object.entries(details ?? {})) {
      if (!fields.includes(field)) continue
      const known = messages.map((m) => KNOWN_MESSAGES[m]).find(Boolean)
      const key = known ?? FIELD_FALLBACK[field]
      if (!key) continue
      setField(field, key)
      pinned = true
    }
    if (!pinned) toast.error(getApiErrorMessage(error, 'profile', t))
  }
}
