import { Button } from '@/components/ui/Button'
import { Image } from '@/components/ui/Image'
import { toast } from '@/components/ui/Toast'
import { ACCEPTED_TYPES } from '@/lib/image'
import { cn } from '@/lib/utils'
import { ArrowUp, Plus, X } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onFile: (file: File) => void
  attachment?: File | null
  onRemoveAttachment?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  maxLength?: number
}

// the character counter shows up only this close to maxLength
const COUNTER_THRESHOLD = 100

// chat input pill: + (attach) | auto-growing textarea | send
export function ChatInput({
  value,
  onChange,
  onSubmit,
  onFile,
  attachment = null,
  onRemoveAttachment,
  placeholder,
  disabled,
  className,
  maxLength,
}: ChatInputProps) {
  const { t } = useTranslation(['bot', 'analyze'])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // auto-grow the textarea: reset to 0, then snap to scrollHeight every time the value changes
  // keeps the message visible without manual rows guessing
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${String(el.scrollHeight)}px`
  }, [value])

  // thumbnail of the attached photo, released when it changes or is removed
  const attachmentUrl = useMemo(
    () => (attachment ? URL.createObjectURL(attachment) : null),
    [attachment],
  )
  useEffect(
    () => () => {
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl)
    },
    [attachmentUrl],
  )

  // a photo just attached: put the cursor in the text, inviting the optional note
  useEffect(() => {
    if (attachment) textareaRef.current?.focus()
  }, [attachment])

  const canSubmit = (attachment !== null || value.trim().length > 0) && !disabled
  const needsPhoto = value.trim().length > 0 && !attachment
  const showCounter = maxLength !== undefined && value.length >= maxLength - COUNTER_THRESHOLD

  const handleSubmit = (e?: SubmitEvent<HTMLFormElement>) => {
    e?.preventDefault()
    if (!canSubmit) return
    if (!attachment) {
      toast.error(t('photoRequired'))
      return
    }
    onSubmit()
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = '' // allow re-attaching the same file
  }

  const onTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // enter submits, shift+enter inserts a newline (matches ChatGPT/Claude)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {attachment && attachmentUrl && (
        <div className="border-border-soft bg-elevated mb-2 flex w-fit items-center gap-2 rounded-xl border py-1.5 pr-3 pl-1.5">
          <Image
            src={attachmentUrl}
            alt={t('analyze:attachment.alt')}
            eager
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
          <span className="text-text-hi max-w-60 truncate text-xs">{attachment.name}</span>
          <Button
            type="button"
            variant="naked"
            onClick={onRemoveAttachment}
            aria-label={t('analyze:attachment.remove')}
            className="text-text-mid hover:text-text-hi h-5 w-5"
          >
            <X size={14} aria-hidden />
          </Button>
        </div>
      )}
      <div className="border-border-soft bg-base focus-within:border-accent focus-within:ring-accent/30 flex min-h-12 items-end gap-1 rounded-3xl border px-2 py-2 transition-colors focus-within:ring-2">
        <Button
          type="button"
          variant="naked"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('attach')}
          className={cn(
            'h-8 w-8 shrink-0 rounded-full transition-colors',
            needsPhoto
              ? 'bg-accent/15 text-accent hover:bg-accent/25'
              : 'text-text-mid hover:text-text-hi hover:bg-elevated',
          )}
        >
          <Plus size={18} aria-hidden />
        </Button>
        {/* textarea (not input) so long messages wrap and the pill grows vertically */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          className="scrollbar-hidden text-text-hi placeholder:text-text-lo max-h-40 flex-1 resize-none self-center bg-transparent px-2 py-1 text-sm outline-none"
        />
        {showCounter && (
          <span className="text-text-lo shrink-0 self-center text-xs tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
        <Button
          type="submit"
          variant="naked"
          disabled={!canSubmit}
          aria-label={t('send')}
          className="bg-accent hover:bg-accent-hi h-8 w-8 shrink-0 rounded-full text-white transition-colors disabled:opacity-30 disabled:hover:bg-accent"
        >
          <ArrowUp size={16} aria-hidden />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </form>
  )
}
