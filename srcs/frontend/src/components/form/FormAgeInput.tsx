import { Label } from '@/components/ui/Label'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState } from 'react'
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form'

const MAX_YEARS = 150
const MONTHS_PER_YEAR = 12

interface AgeMessages {
  invalid: string
  tooLarge: string
  monthsRange: string
}

interface FormAgeInputProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: Path<T>
  yearsLabel: string
  monthsLabel: string
  messages: AgeMessages
  id?: string
}

export function FormAgeInput<T extends FieldValues>({
  form,
  name,
  yearsLabel,
  monthsLabel,
  messages,
  id,
}: FormAgeInputProps<T>) {
  const baseId = id ?? String(name)
  const errorId = `${baseId}-helper`

  const [parts, setParts] = useState(() => {
    const total = form.getValues(name) as number | null | undefined
    return total == null
      ? { years: '', months: '' }
      : {
          years: String(Math.floor(total / MONTHS_PER_YEAR)),
          months: String(total % MONTHS_PER_YEAR),
        }
  })

  const [partError, setPartError] = useState<string | null>(null)

  const update = (next: { years: string; months: string }) => {
    setParts(next)
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted }
    const setAge = (value: number | null) => {
      form.setValue(name, value as PathValue<T, Path<T>>, options)
    }

    if (next.years === '' && next.months === '') {
      setPartError(null)
      setAge(null)
      return
    }
    const years = next.years === '' ? 0 : Number(next.years)
    const months = next.months === '' ? 0 : Number(next.months)
    const problem =
      !Number.isInteger(years) || years < 0
        ? messages.invalid
        : years > MAX_YEARS
          ? messages.tooLarge
          : !Number.isInteger(months) || months < 0 || months >= MONTHS_PER_YEAR
            ? messages.monthsRange
            : null
    setPartError(problem)
    // NaN keeps an invalid age from ever being saved
    setAge(problem ? Number.NaN : years * MONTHS_PER_YEAR + months)
  }

  // arrows: one unit up or down, never below 0
  const stepped = (value: string, direction: 1 | -1) =>
    String(Math.max(0, (Number(value) || 0) + direction))

  const formError = (form.formState.errors[name] as { message?: string } | undefined)?.message
  const error = partError ?? formError

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`${baseId}-years`}>{yearsLabel}</Label>
          <NumberInput
            id={`${baseId}-years`}
            value={parts.years}
            onChange={(e) => {
              update({ ...parts, years: e.target.value })
            }}
            onStep={(direction) => {
              update({ ...parts, years: stepped(parts.years, direction) })
            }}
            placeholder="0"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`${baseId}-months`}>{monthsLabel}</Label>
          <NumberInput
            id={`${baseId}-months`}
            value={parts.months}
            onChange={(e) => {
              update({ ...parts, months: e.target.value })
            }}
            onStep={(direction) => {
              update({ ...parts, months: stepped(parts.months, direction) })
            }}
            placeholder="0"
            max={MONTHS_PER_YEAR - 1}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
