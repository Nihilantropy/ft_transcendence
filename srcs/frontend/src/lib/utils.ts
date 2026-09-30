import type { User } from '@/api/types'
import i18n from '@/i18n/i18n'
import { clsx, type ClassValue } from 'clsx'
import type { TFunction } from 'i18next'
import { twMerge } from 'tailwind-merge'

// backend always wraps responses in this shape
export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error?: { code?: string; message?: string } | null
  timestamp?: string
}

// unwrap data from the API response
export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === null || response.data === undefined) {
    throw new Error(response.error?.message ?? 'Unexpected API response')
  }
  return response.data
}

// narrow unknown type to string | undefined, used to read fields off untyped JSON
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export type ApiErrorDetails = Record<string, string[]>

// pull code + human-readable message (+ per-field details) out of an HTTP error body
export function extractError(parsed: unknown): {
  code?: string
  message?: string
  details?: ApiErrorDetails
} {
  const raw = parsed as Record<string, unknown> | null
  const obj = (raw?.detail as Record<string, unknown> | undefined) ?? raw
  const nested = obj?.error as Record<string, unknown> | undefined
  const src = nested ?? obj ?? {}
  const details = src.details
  return {
    code: asString(src.code),
    message: asString(src.message),
    details: details && typeof details === 'object' ? (details as ApiErrorDetails) : undefined,
  }
}

// map a thrown API error to a localized message
export function getApiErrorMessage(error: unknown, namespace: string, t: TFunction): string {
  const { code } = error as { code?: string }
  if (code && i18n.exists(`${namespace}:errors.${code}`)) {
    return t(`errors.${code}`)
  }
  return t('errors.generic')
}

// read a sanitized ?next= redirect target from search params, falling back to fallback when missing or unsafe (anything but a same-origin path is rejected to guard against open-redirect attacks)
export function getSafeNext(searchParams: URLSearchParams, fallback: string): string {
  const raw = searchParams.get('next')
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

// pet.age is stored in months
// so under a year we show months, from 12 up we show whole years
export function formatPetAge(months: number, t: TFunction): string {
  if (months < 12) return t('age.months', { count: months })
  return t('age.years', { count: Math.floor(months / 12) })
}

// time-of-day bucket from local hour, used to pick a localized greeting
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  return 'evening'
}

// "Mario Rossi" -> "MR"
// "Mario" -> "M"
// no name -> first letter of the email
export function getInitials(user: Pick<User, 'first_name' | 'last_name' | 'email'>): string {
  const initials = [user.first_name, user.last_name]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
  return (initials || user.email.charAt(0)).toUpperCase()
}

// combine class names safely for Tailwind components filtering out falsy values and resolving conflicts
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// normalize user-typed proper nouns to title case for better display (e.g. breed names, pet names)
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
