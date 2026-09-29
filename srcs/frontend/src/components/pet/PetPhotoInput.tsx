import type { Species } from '@/api/types'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Image } from '@/components/ui/Image'
import { toast } from '@/components/ui/Toast'
import { toPetPhoto } from '@/lib/image'
import { cn } from '@/lib/utils'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const ACCEPTED = 'image/jpeg,image/png,image/webp'

interface PetPhotoInputProps {
  value: string
  onChange: (photo: string) => void
  species?: Species
}

export function PetPhotoInput({ value, onChange, species = 'other' }: PetPhotoInputProps) {
  const { t } = useTranslation('pets')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const pick = () => inputRef.current?.click()

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setIsProcessing(true)
    try {
      onChange(await toPetPhoto(file))
    } catch {
      toast.error(t('photo.invalid'))
    } finally {
      setIsProcessing(false)
      // allow picking the same file again after a removal
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="relative h-40 w-40">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={pick}
        className="bg-elevated text-text-lo group flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg"
      >
        {value ? (
          <Image
            src={value}
            alt=""
            className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
          />
        ) : (
          renderSpeciesIcon(species, { size: 44, strokeWidth: 1.5, 'aria-hidden': true })
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
        }}
      />

      <div className="absolute right-2 bottom-2 flex gap-1.5">
        {value && (
          <PhotoAction
            label={t('photo.remove')}
            onClick={() => {
              onChange('')
            }}
          >
            <Trash2 size={14} aria-hidden />
          </PhotoAction>
        )}
        <PhotoAction
          label={value ? t('photo.change') : t('photo.upload')}
          onClick={pick}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Camera size={14} aria-hidden />
          )}
        </PhotoAction>
      </div>
    </div>
  )
}

interface PhotoActionProps {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

// small round icon button floating on the photo
function PhotoAction({ label, onClick, disabled, children }: PhotoActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-base/90 text-text-hi border-border-soft flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors',
        'hover:text-accent focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {children}
    </button>
  )
}
