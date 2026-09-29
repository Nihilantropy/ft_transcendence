import { analyzeImage, verify } from '@/api/routes'
import type { VisionAnalysisData } from '@/api/types'
import { BotAvatar } from '@/components/chat/BotAvatar'
import { ChatInput } from '@/components/chat/ChatInput'
import { Button } from '@/components/ui/Button'
import { Image } from '@/components/ui/Image'
import { toast } from '@/components/ui/Toast'
import { useFileDrop } from '@/hooks/useFileDrop'
import { pickBotMessage } from '@/lib/botMessages'
import { toPetPhoto, validatePetImage } from '@/lib/image'
import { cn } from '@/lib/utils'
import { useListPets } from '@/queries/pets'
import { useUser } from '@/stores/auth'
import { HTTPError } from 'ky'
import { Bot, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import './analyze.css'
import { AnalysisResultCard } from './components/AnalysisResultCard'

type ChatMessage =
  | { id: string; role: 'user'; text: string; imageUrl?: string }
  | { id: string; role: 'bot'; text: string; isError?: boolean }
  // photo: the analyzed image as a profile-photo data URL (offered on save)
  | { id: string; role: 'result'; data: VisionAnalysisData; photo?: string }

type ChatStatus = 'idle' | 'analyzing'

// what AnalyzeWidget, DetailHero and AnalysesTab pass along when navigating here
interface AnalyzeRouteState {
  file?: File
  draft?: string
  pet?: { id: string }
}

// fake progress phases shown while the single long POST runs (no streaming)
const PHASE_KEYS = ['uploading', 'classifying', 'searching', 'generating'] as const
const PHASE_STARTS_MS = [0, 2_000, 25_000, 80_000]

let nextId = 0
const msgId = () => `msg-${String(nextId++)}`

export function AnalyzePage() {
  const { t, i18n } = useTranslation(['analyze', 'bot'])
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as AnalyzeRouteState | null

  const user = useUser()
  const { data: pets } = useListPets()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [phase, setPhase] = useState(0)
  const [draft, setDraft] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // captured before the route state is cleared: pet hand-off from a pet's page
  const [linkedPetId] = useState(() => routeState?.pet?.id)
  const linkedPet = linkedPetId ? pets?.find((p) => p.id === linkedPetId) : undefined

  const abortRef = useRef<AbortController | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const lastMessageRef = useRef<HTMLDivElement>(null)

  // greeting: same personalized pool as the dashboard widget
  const firstName = user?.first_name?.trim()
  const [{ messageKey, petName }] = useState(() => pickBotMessage(Boolean(firstName), pets ?? []))
  // opened for a specific pet: say so, instead of the generic pool
  const greeting = linkedPet
    ? t('analyze:linkedGreeting', { name: linkedPet.name })
    : t(messageKey, { name: firstName, petName: petName ?? '', defaultValue: '' })

  const pushMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }

  const chatErrorMessage = (error: unknown): string => {
    if (error instanceof HTTPError && error.response.status === 429) {
      return t('analyze:errors.RATE_LIMIT_EXCEEDED')
    }
    const code = (error as { code?: string }).code
    if (code && i18n.exists(`analyze:errors.${code}`)) {
      return t(`analyze:errors.${code}`)
    }
    return t('analyze:errors.generic')
  }

  const runAnalysis = async (file: File, text: string) => {
    const validated = await validatePetImage(file)
    if (!validated.ok) {
      toast.error(t(`analyze:errors.${validated.error}`))
      return
    }

    const imageUrl = URL.createObjectURL(file)
    objectUrlsRef.current.push(imageUrl)
    pushMessage({ id: msgId(), role: 'user', text, imageUrl })
    setDraft('')
    setPendingFile(null)
    setPhase(0)
    setStatus('analyzing')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await verify()
      const language = i18n.language.startsWith('it') ? 'it' : 'en'
      const [data, photo] = await Promise.all([
        analyzeImage(validated.dataUri, language, controller.signal),
        toPetPhoto(file).catch(() => undefined),
      ])
      pushMessage({ id: msgId(), role: 'result', data, photo })
    } catch (error) {
      if (controller.signal.aborted) return // unmounted / cancelled
      pushMessage({ id: msgId(), role: 'bot', text: chatErrorMessage(error), isError: true })
    } finally {
      abortRef.current = null
      setStatus('idle')
    }
  }

  const handleSubmit = () => {
    if (status === 'analyzing') return
    if (pendingFile) {
      void runAnalysis(pendingFile, draft.trim())
      return
    }
    // text without a photo: the pipeline needs an image -> reply like a chatbot
    const text = draft.trim()
    if (!text) return
    pushMessage({ id: msgId(), role: 'user', text })
    pushMessage({ id: msgId(), role: 'bot', text: t('analyze:needPhoto') })
    setDraft('')
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setPendingFile(file)
  }

  const { isDragging, dropHandlers } = useFileDrop(handleFile)

  const consumedRef = useRef(false)
  useEffect(() => {
    if (consumedRef.current || !routeState) return
    consumedRef.current = true
    const { file, draft: incomingDraft } = routeState
    const text = incomingDraft?.trim() ?? ''
    void navigate('.', { replace: true, state: null })
    // the hand-off arrives already SENT: either the analysis starts right away (file) or the text lands as a sent message with the bot's reply (no file)
    setTimeout(() => {
      if (file) {
        void runAnalysis(file, text)
      } else if (text) {
        pushMessage({ id: msgId(), role: 'user', text })
        pushMessage({ id: msgId(), role: 'bot', text: t('analyze:needPhoto') })
      }
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState])

  // fake phase progression while analyzing
  useEffect(() => {
    if (status !== 'analyzing') return
    const timers = PHASE_STARTS_MS.slice(1).map((startMs, i) =>
      setTimeout(() => {
        setPhase(i + 1)
      }, startMs),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [status])

  // abort in-flight analysis + revoke previews on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      abortRef.current?.abort()
      urls.forEach((u) => {
        URL.revokeObjectURL(u)
      })
    }
  }, [])

  // focus always sits on the TOP of the last message
  useEffect(() => {
    const el = lastMessageRef.current
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    const settle = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
    return () => {
      clearTimeout(settle)
    }
  }, [messages, status])

  const isEmpty = messages.length === 0 && status === 'idle'

  const inputBlock = (
    <>
      {pendingFile && (
        <div className="border-border-soft bg-elevated mb-2 flex w-fit items-center gap-2 rounded-xl border px-3 py-2">
          <span className="text-text-hi max-w-60 truncate text-xs">{pendingFile.name}</span>
          <Button
            type="button"
            variant="naked"
            onClick={() => {
              setPendingFile(null)
            }}
            aria-label={t('analyze:attachment.remove')}
            className="text-text-mid hover:text-text-hi h-5 w-5"
          >
            <X size={14} aria-hidden />
          </Button>
        </div>
      )}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        onFile={handleFile}
        hasAttachment={pendingFile !== null}
        disabled={status === 'analyzing'}
        placeholder={isDragging ? t('analyze:input.dragActive') : t('analyze:input.placeholder')}
      />
    </>
  )

  // empty state: greeting + input centered in the page
  if (isEmpty) {
    return (
      <div
        {...dropHandlers}
        className={cn(
          'mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 transition-colors',
          isDragging && 'bg-accent/5',
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Bot size={40} strokeWidth={1.5} className="text-accent" aria-hidden />
          <p className="text-text-hi max-w-prose text-lg leading-relaxed whitespace-pre-line">
            {greeting}
          </p>
        </div>
        <div className="mt-8 w-full max-w-2xl">{inputBlock}</div>
      </div>
    )
  }

  return (
    <div
      {...dropHandlers}
      className={cn(
        // min-h keeps the input near the bottom even with a short conversation
        'mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col px-4 transition-colors',
        isDragging && 'bg-accent/5',
      )}
    >
      {/* pb keeps breathing room between the last message and the input bar */}
      <div className="flex flex-1 flex-col gap-6 pb-10">
        {messages.map((m, i) => (
          <div
            key={m.id}
            ref={i === messages.length - 1 ? lastMessageRef : undefined}
            className="scroll-mt-6"
          >
            {m.role === 'user' && (
              <div className="flex justify-end">
                <div className="bg-accent/12 max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%]">
                  {m.imageUrl && (
                    <Image
                      src={m.imageUrl}
                      alt={t('analyze:attachment.alt')}
                      className="max-h-48 rounded-xl object-cover"
                    />
                  )}
                  {m.text && (
                    <p className={cn('text-text-hi text-sm', m.imageUrl && 'mt-2')}>{m.text}</p>
                  )}
                </div>
              </div>
            )}
            {m.role === 'bot' && (
              <BotRow>
                <p
                  className={cn(
                    'text-sm leading-relaxed whitespace-pre-line',
                    m.isError ? 'text-warn' : 'text-text-hi',
                  )}
                >
                  {m.text}
                </p>
              </BotRow>
            )}
            {m.role === 'result' && (
              <BotRow wide>
                <AnalysisResultCard data={m.data} photo={m.photo} initialPetId={linkedPetId} />
              </BotRow>
            )}
          </div>
        ))}

        {status === 'analyzing' && (
          <div className="flex items-start gap-3" aria-live="polite">
            <div className="shrink-0">
              <div
                className="bg-accent/12 flex h-9 w-9 items-center justify-center rounded-full"
                aria-hidden
              >
                <TypingDots />
              </div>
            </div>
            <div className="min-w-0 max-w-prose pt-1.5">
              <p className="text-text-mid text-sm leading-relaxed">
                {t(`analyze:phases.${PHASE_KEYS[phase] ?? 'generating'}`)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* input pinned to the bottom of the scrollport while the list scrolls */}
      <div className="bg-base sticky bottom-0 pt-3 pb-2">{inputBlock}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 sub-pieces                                 */
/* -------------------------------------------------------------------------- */

// bot-side row: avatar + content
function BotRow({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('shrink-0', wide && 'pt-2.5 sm:pt-3.5')}>
        <BotAvatar />
      </div>
      <div className={cn('min-w-0', wide ? 'flex-1' : 'max-w-prose pt-2')}>{children}</div>
    </div>
  )
}

// three dots pulsing
function TypingDots() {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-accent h-1 w-1 rounded-full animate-[chat-dot_1.4s_cubic-bezier(0.455,0.03,0.515,0.955)_infinite]"
          style={{ animationDelay: `${String(i * 180)}ms` }}
        />
      ))}
    </span>
  )
}
