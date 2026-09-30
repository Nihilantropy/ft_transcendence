// random bot-greeting picker shared by the dashboard AnalyzeWidget and the analyze chat page

// every pool in locales holds exactly this many messages
// always keep this in sync with the locale files since we can't introspect i18n keys at runtime
const MESSAGES_PER_BUCKET = 6

type Bucket = 'neutral' | 'withName' | 'withPet' | 'withNameAndPet'

export interface MessagePick {
  messageKey: string
  petName: string | null
}

export function pickBotMessage(hasName: boolean, pets: { name: string }[]): MessagePick {
  const randomPet = pets.length > 0 ? pets[Math.floor(Math.random() * pets.length)] : undefined
  const petName = randomPet?.name ?? null
  const hasPet = petName !== null

  const buckets: Bucket[] = ['neutral']
  if (hasName) buckets.push('withName')
  if (hasPet) buckets.push('withPet')
  if (hasName && hasPet) buckets.push('withNameAndPet')

  // flat array of all valid keys, then pick one uniformly
  const candidates = buckets.flatMap((bucket) =>
    Array.from({ length: MESSAGES_PER_BUCKET }, (_, i) => `bot:messages.${bucket}.${String(i)}`),
  )
  const messageKey =
    candidates[Math.floor(Math.random() * candidates.length)] ?? 'bot:messages.neutral.0'

  return { messageKey, petName }
}
