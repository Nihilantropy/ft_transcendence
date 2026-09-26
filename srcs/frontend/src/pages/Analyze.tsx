import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { api, fieldError, type Pet } from '../api'
import Button from '../components/Button'
import Card from '../components/Card'
import Dropzone from '../components/Dropzone'
import ErrorNote from '../components/ErrorNote'
import Field from '../components/Field'
import Illustration from '../components/Illustration'
import { breedLabel, useI18n } from '../i18n'
import { toJpegDataUrl } from '../image'

export type Analysis = {
  species: 'dog' | 'cat'
  breed_analysis: { primary_breed: string; confidence: number; is_likely_crossbreed: boolean }
  description: string
  traits: { size: 'small' | 'medium' | 'large' | null; energy_level: 'low' | 'medium' | 'high' | null; temperament: string }
  health_observations: string[]
}

export default function Analyze() {
  const { t, lang } = useI18n()
  const [preview, setPreview] = useState<string>()
  const [result, setResult] = useState<Analysis>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  async function analyze(file: File) {
    setError(undefined)
    setResult(undefined)
    setBusy(true)
    try {
      const image = await toJpegDataUrl(file)
      setPreview(image)
      const body = { image, language: lang }
      setResult(await api<Analysis>('/vision/analyze', { method: 'POST', body, timeoutMs: 300_000 }))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (busy) return <Waiting preview={preview} />
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('analyze.title')}</h1>
      {error ? <ErrorNote error={error} /> : null}
      {result && preview
        ? <Result result={result} preview={preview} onAgain={() => { setResult(undefined); setPreview(undefined) }} />
        : <Dropzone onFile={analyze} />}
    </section>
  )
}

function Waiting({ preview }: { preview?: string }) {
  const { t } = useI18n()
  const [line, setLine] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n % 4) + 1), 4000)
    return () => clearInterval(id)
  }, [])
  return (
    <section aria-busy="true" className="flex flex-col items-center gap-4 py-8 text-center">
      {preview && <img src={preview} alt="" className="max-h-64 rounded-3xl" />}
      <Illustration name="waiting" className="h-32 w-32 text-accent" />
      <p role="status">{t(`analyze.wait.${line}`)}</p>
    </section>
  )
}

function Result({ result, preview, onAgain }: { result: Analysis; preview: string; onAgain: () => void }) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const b = result.breed_analysis
  const pct = Math.round(b.confidence * 100)
  const chips = [
    result.traits.size && t(`trait.size.${result.traits.size}`),
    result.traits.energy_level && t(`trait.energy.${result.traits.energy_level}`),
    result.traits.temperament,
  ].filter(Boolean) as string[]

  return (
    <Card className="flex flex-col gap-4">
      <img src={preview} alt="" className="max-h-72 w-full rounded-2xl object-contain" />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold">{breedLabel(b.primary_breed)}</h2>
        {b.is_likely_crossbreed && (
          <span className="rounded-full bg-accent/15 px-3 py-1 font-bold">{t('analyze.crossbreed')}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between"><span>{t('analyze.confidence')}</span><span>{pct}%</span></div>
        <div role="progressbar" aria-label={t('analyze.confidence')} aria-valuenow={pct} aria-valuemin={0}
          aria-valuemax={100} className="h-3 rounded-full bg-line">
          <div className="h-3 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p>{result.description}</p>
      {chips.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">{t('analyze.traits')}</h3>
          <ul className="flex flex-wrap gap-2">
            {chips.map((c) => <li key={c} className="rounded-full border border-line px-3 py-1">{c}</li>)}
          </ul>
        </div>
      )}
      {result.health_observations.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border-l-4 border-ok bg-ok/15 p-4">
          <h3 className="font-bold">{t('analyze.health')}</h3>
          <ul className="list-disc pl-5">
            {result.health_observations.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => dialog.current?.showModal()}>{t('analyze.save')}</Button>
        <Button variant="ghost" onClick={onAgain}>{t('analyze.again')}</Button>
      </div>
      <SaveDialog dialog={dialog} result={result} />
    </Card>
  )
}

function SaveDialog({ dialog, result }: { dialog: RefObject<HTMLDialogElement | null>; result: Analysis }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim()
    setBusy(true)
    setError(undefined)
    try {
      const b = result.breed_analysis
      // breed = the classifier id (max_length 100), never a composed crossbreed string.
      const pet = await api<Pet>('/pets', { method: 'POST', body: { name, species: result.species, breed: b.primary_breed } })
      // breed_confidence is ignored on create by design. ponytail: a failed PATCH only loses the
      // confidence, so carry on rather than invite a retry that would create a duplicate pet.
      await api(`/pets/${pet.id}`, { method: 'PATCH', body: { breed_confidence: b.confidence } }).catch(() => {})
      navigate(`/pets/${pet.id}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-card p-6 text-fg backdrop:bg-black/40">
      <form onSubmit={save} className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t('save.title')}</h2>
        <Field label={t('save.name')} name="name" required maxLength={100} autoFocus error={fieldError(error, 'name')} />
        {error ? <ErrorNote error={error} /> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>{t('save.cancel')}</Button>
          <Button disabled={busy}>{t('save.submit')}</Button>
        </div>
      </form>
    </dialog>
  )
}
