import { Button } from '@/components/ui/Button'
import { ArrowUp, Plus } from 'lucide-react'
import {
  useLayoutEffect,
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
  placeholder?: string
  disabled?: boolean
  className?: string
}

// chat input pill: + (attach) | auto-growing textarea | send
export function ChatInput({
  value,
  onChange,
  onSubmit,
  onFile,
  placeholder,
  disabled,
  className,
}: ChatInputProps) {
  const { t } = useTranslation('bot')
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

  const canSubmit = value.trim().length > 0 && !disabled

  const handleSubmit = (e?: SubmitEvent<HTMLFormElement>) => {
    e?.preventDefault()
    if (!canSubmit) return
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
      <div className="border-border-soft bg-base focus-within:border-accent focus-within:ring-accent/30 flex min-h-12 items-end gap-1 rounded-3xl border px-2 py-2 transition-colors focus-within:ring-2">
        <Button
          type="button"
          variant="naked"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('attach')}
          className="text-text-mid hover:text-text-hi hover:bg-elevated h-8 w-8 shrink-0 rounded-full transition-colors"
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
          className="scrollbar-hidden text-text-hi placeholder:text-text-lo max-h-40 flex-1 resize-none self-center bg-transparent px-2 py-1 text-sm outline-none"
        />
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
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </form>
  )
}
