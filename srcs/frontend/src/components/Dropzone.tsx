import { useState } from 'react'
import { useI18n } from '../i18n'
import Illustration from './Illustration'

// No `capture` attribute: it makes mobile browsers open the camera only; without it the picker
// offers both camera and gallery.
export default function Dropzone({ onFile }: { onFile: (f: File) => void }) {
  const { t } = useI18n()
  const [over, setOver] = useState(false)
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-10 text-center transition focus-within:outline-2 focus-within:outline-accent ${over ? 'border-accent bg-accent/10' : 'border-line'}`}>
      <Illustration name="dog" className="h-24 w-24 text-accent" />
      <span className="font-bold">{t('analyze.drop')}</span>
      <span>{t('analyze.drop_hint')}</span>
      <input type="file" accept="image/*" className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // picking the same file again must fire onChange
          if (f) onFile(f)
        }} />
    </label>
  )
}
