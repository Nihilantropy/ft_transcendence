import type { Pet, RecommendationItem } from '@/api/types'
import type { Language } from '@/i18n/i18n'
import type { TFunction } from 'i18next'

// the service explains a match with fixed english sentences
const MATCH_REASON_KEYS: Record<string, string> = {
  'Targets joint health': 'jointHealth',
  'Good for sensitive stomach': 'sensitiveStomach',
}

// the service's fallback when nothing specific matched
const GENERIC_MATCH_REASON = 'Nutritionally compatible'

// the reasons worth a badge
export function specificMatchReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => reason !== GENERIC_MATCH_REASON)
}

// a match reason in the UI language, or as sent when the backend adds a new one
export function matchReasonLabel(reason: string, t: TFunction): string {
  const key = MATCH_REASON_KEYS[reason]
  return key ? t(`recommendations:reasons.${key}`) : reason
}

// catalog prices are in euro: each UI language shows its own currency
const CURRENCIES: Record<Language, { code: string; perEuro: number }> = {
  it: { code: 'EUR', perEuro: 1 },
  en: { code: 'GBP', perEuro: 0.85 },
  ja: { code: 'JPY', perEuro: 160 },
}

export function formatPrice(priceInEuro: number, language: Language): string {
  const { code, perEuro } = CURRENCIES[language]
  return new Intl.NumberFormat(language, { style: 'currency', currency: code }).format(
    priceInEuro * perEuro,
  )
}

export interface PetRecommendation {
  pet: Pet
  item: RecommendationItem
}

// a mix across pets for the dashboard
// each pet's best food first, then each one's second, and so on (up to count, when given), never the same product twice
export function pickAcrossPets(
  pets: Pet[],
  lists: RecommendationItem[][],
  count = Infinity,
): PetRecommendation[] {
  const picks: PetRecommendation[] = []
  const seen = new Set<number>()
  const longest = Math.max(0, ...lists.map((list) => list.length))
  for (let rank = 0; rank < longest && picks.length < count; rank++) {
    lists.forEach((list, i) => {
      const item = list[rank]
      const pet = pets[i]
      if (!item || !pet || seen.has(item.product_id) || picks.length >= count) return
      seen.add(item.product_id)
      picks.push({ pet, item })
    })
  }
  return picks
}
