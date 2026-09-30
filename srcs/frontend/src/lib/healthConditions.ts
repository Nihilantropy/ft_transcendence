import type { TFunction } from 'i18next'

// the conditions the recommendation service scores on
export const HEALTH_CONDITION_CODES = [
  'joint_health',
  'sensitive_stomach',
  'weight_management',
  'skin_allergies',
  'dental_health',
  'kidney_health',
] as const

export type HealthConditionCode = (typeof HEALTH_CONDITION_CODES)[number]

const isHealthConditionCode = (value: string): value is HealthConditionCode =>
  (HEALTH_CONDITION_CODES as readonly string[]).includes(value)

// a stored condition as shown to the user
export function healthConditionLabel(value: string, t: TFunction): string {
  return isHealthConditionCode(value) ? t(`pets:healthConditionCodes.${value}`) : value
}
