import { BotAvatar } from '@/components/chat/BotAvatar'
import { ChatInput } from '@/components/chat/ChatInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFileDrop } from '@/hooks/useFileDrop'
import { pickBotMessage } from '@/lib/botMessages'
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
    void navigate('/analyze', { state: { draft } })
  }

  // attaching an image is a shortcut to start the analyze flow
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    void navigate('/analyze', { state: { file, draft } })
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
            {/* online dot with a soft, slow ping halo */}
            <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
              <span className="bg-success/60 absolute inline-flex h-full w-full rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full" />
            </span>
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
