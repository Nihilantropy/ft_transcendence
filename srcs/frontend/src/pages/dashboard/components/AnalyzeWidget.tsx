import { BotAvatar } from '@/components/chat/BotAvatar'
import { ChatInput } from '@/components/chat/ChatInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFileDrop } from '@/hooks/useFileDrop'
import { cn } from '@/lib/utils'
import { DashboardSection } from '@/pages/dashboard/components/widget-ui/DashboardSection'
import { useListPets } from '@/queries/pets'
import { useIsAuthReady, useUser } from '@/stores/auth'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

// fake chatbot widget for the analyze flow
// the greeting is picked at random from a pool based on what we know about the user (first name, pets)
// typing is disabled in the chat sense: submit always navigates to /analyze
export function AnalyzeWidget() {
  const { t } = useTranslation(['dashboard', 'bot'])
  const navigate = useNavigate()
  const user = useUser()
  const isAuthReady = useIsAuthReady()
  const { data: pets, isPending: isPetsPending } = useListPets()
  // gate the greeting until both auth and pets have resolved
  const isReady = isAuthReady && !isPetsPending
  const [draft, setDraft] = useState('')

  const firstName = user?.first_name?.trim()
  const hasName = Boolean(firstName)

  // pick a random greeting once we know the relevant context (name/pet)
  const { messageKey, petName } = useMemo(
    () => pickBotMessage(hasName, pets ?? []),
    [hasName, pets],
  )
  const message = t(messageKey, {
    name: firstName,
    petName: petName ?? '',
    defaultValue: '',
  })

  const handleSubmit = () => {
    // @TODO : implement the actual analyze flow with the draft
    void navigate('/analyze')
  }

  // attaching an image is a shortcut to start the analyze flow
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    // @TODO : thread 'file' (+ optional 'draft') to /analyze
    void navigate('/analyze')
  }

  const { isDragging, dropHandlers } = useFileDrop(handleFile)

  return (
    <DashboardSection
      {...dropHandlers}
      className={cn('transition-colors', isDragging && 'border-accent bg-accent/5')}
    >
      {/* bot */}
      <header className="flex items-center gap-3">
        <BotAvatar />
        <div className="flex flex-col">
          <p className="text-text-hi text-sm font-bold tracking-tight">
            {t('blocks.analyze.bot.name')}
          </p>
          <p className="text-text-lo flex items-center gap-1.5 text-xs">
            <span className="bg-success inline-block h-1.5 w-1.5 rounded-full" aria-hidden />
            {t('blocks.analyze.bot.status')}
          </p>
        </div>
      </header>

      {/* bot message */}
      <div className="mt-3 ml-12 max-w-prose flex-1">
        {isReady ? (
          <p className="text-text-hi text-sm leading-relaxed whitespace-pre-line">{message}</p>
        ) : (
          <MessageSkeleton />
        )}
      </div>

      {/* chat input */}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        onFile={handleFile}
        placeholder={
          isDragging ? t('blocks.analyze.bot.dragActive') : t('blocks.analyze.bot.inputPlaceholder')
        }
        className="mt-5"
      />
    </DashboardSection>
  )
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex h-[1.422rem] items-center">
        <Skeleton className="bg-text-lo/10 h-3 w-56 rounded-full" />
      </div>
      <div className="flex h-[1.422rem] items-center">
        <Skeleton className="bg-text-lo/10 h-3 w-72 rounded-full" />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                        random message picker                               */
/* -------------------------------------------------------------------------- */

// every pool in locales holds exactly this many messages
// always keep this in sync with the locale files since we can't introspect i18n keys at runtime
const MESSAGES_PER_BUCKET = 6

type Bucket = 'neutral' | 'withName' | 'withPet' | 'withNameAndPet'

interface MessagePick {
  messageKey: string
  petName: string | null
}

function pickBotMessage(hasName: boolean, pets: { name: string }[]): MessagePick {
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
