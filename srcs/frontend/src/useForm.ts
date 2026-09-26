import { useState } from 'react'
import { useI18n } from './i18n'
import { formValues, serverFieldKey, validate, type Errors, type Rule, type Values } from './validation'

/** Browser-side validation + translated server field errors for one form. */
export function useForm(schema: Record<string, Rule[]>) {
  const { t } = useI18n()
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  /** Validates; on failure focuses the first invalid field and returns null (nothing is sent). */
  function check(form: HTMLFormElement): Values | null {
    const values = formValues(form)
    const found = validate(values, schema)
    setErrors(found)
    setApiError(undefined)
    const first = Object.keys(found)[0]
    if (!first) return values
    form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    return null
  }

  const message = (field: string) => {
    const key = errors[field] ?? serverFieldKey(apiError, field)
    return key ? t(key) : undefined
  }

  const summary = (labels: Record<string, string>) =>
    Object.keys(errors).map((field) => ({ field, text: `${labels[field] ?? field}: ${t(errors[field])}` }))

  return { check, message, summary, apiError, setApiError, busy, setBusy }
}
