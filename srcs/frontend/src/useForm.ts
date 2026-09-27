import { useRef, useState, type FocusEvent } from 'react'
import { ApiError } from './api'
import { useI18n } from './i18n'
import { formValues, invalidKeyFor, serverFieldKey, validate, type Errors, type Rule, type Values } from './validation'

/**
 * Browser-side validation + translated server field errors for one form.
 * `prefix` namespaces the input ids, so two forms with a `current_password` field can share a page.
 */
export function useForm(schema: Record<string, Rule[]>, prefix = 'field') {
  const { t } = useI18n()
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiErrorState] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const submitted = useRef(false)

  const id = (field: string) => `${prefix}-${field}`

  /** Schema errors, plus a browser-rejected <input type="number"> value (validity.badInput) — a
   *  number input's `.value` is '' when unparseable, which schema rules read as "unknown". */
  function computeErrors(form: HTMLFormElement): Errors {
    const found = validate(formValues(form), schema)
    for (const el of form.elements) {
      if (el instanceof HTMLInputElement && el.name && el.validity.badInput) found[el.name] = invalidKeyFor(el.name)
    }
    return found
  }

  /** Validates; on failure focuses the first invalid field and returns null (nothing is sent). */
  function check(form: HTMLFormElement): Values | null {
    submitted.current = true
    const found = computeErrors(form)
    setErrors(found)
    setApiErrorState(undefined)
    const first = Object.keys(found)[0]
    if (!first) return formValues(form)
    form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    return null
  }

  /** Spec §4: re-validate on blur after the first submit, without moving focus.
   *  Skipped when focus is moving to this form's submit button: mousedown already blurred the
   *  field, and re-validating there can drop an error, shift the layout and move the button out
   *  from under the click before mouseup lands — the submit validates on its own regardless. */
  function onBlur(e: FocusEvent<HTMLFormElement>) {
    if (!submitted.current) return
    const target = e.relatedTarget
    const isSubmit =
      (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) &&
      target.type === 'submit' && target.form === e.currentTarget
    if (isSubmit) return
    setErrors(computeErrors(e.currentTarget))
  }

  /** Records a failed submit; a VALIDATION_ERROR also focuses the first server-invalid field. */
  function setApiError(form: HTMLFormElement | null, err: unknown) {
    setApiErrorState(err)
    if (form && err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
      const first = Object.keys(err.details).find((f) => form.querySelector(`[name="${f}"]`))
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    }
  }

  const message = (field: string) => {
    const key = errors[field] ?? serverFieldKey(apiError, field)
    return key ? t(key) : undefined
  }

  const summary = (labels: Record<string, string>) => {
    const items = Object.keys(errors).map((field) => ({ id: id(field), text: `${labels[field] ?? field}: ${t(errors[field])}` }))
    if (apiError instanceof ApiError && apiError.code === 'VALIDATION_ERROR') {
      for (const field of Object.keys(apiError.details)) {
        if (field in errors) continue
        const key = serverFieldKey(apiError, field)
        if (key) items.push({ id: id(field), text: `${labels[field] ?? field}: ${t(key)}` })
      }
    }
    return items
  }

  // An API error that no field of this form claims: rendered once, as a note under the form.
  const note = apiError !== undefined && !Object.keys(schema).some((f) => serverFieldKey(apiError, f)) ? apiError : undefined

  const reset = () => {
    setErrors({})
    setApiErrorState(undefined)
  }

  return { check, onBlur, message, summary, id, note, reset, apiError, setApiError, busy, setBusy }
}
