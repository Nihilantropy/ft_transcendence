import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, type Pet } from '../api'
import Button, { buttonClass } from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import ErrorSummary from '../components/ErrorSummary'
import Field from '../components/Field'
import Illustration from '../components/Illustration'
import { breedLabel, useI18n } from '../i18n'
import { PHOTO_SIDE, toJpegDataUrl } from '../image'
import { usePageTitle } from '../usePageTitle'
import { useForm } from '../useForm'
import { positiveNumber, wholeNumber } from '../validation'

const PET_FORM = { age: [wholeNumber], weight: [positiveNumber] }

// Exactly the conditions the recommender scores (recommendation-service feature_engineering.py).
const HEALTH = ['sensitive_stomach', 'weight_management', 'joint_health', 'skin_allergies', 'dental_health', 'kidney_health']

type Rec = { product_id: number; name: string; brand: string; price: string | number | null; match_reasons: string[] }

// The recommender emits three fixed English phrases (recommendation-service routes/recommendations.py).
const REASONS: Record<string, string> = {
  'Targets joint health': 'reason.joint_health',
  'Good for sensitive stomach': 'reason.sensitive_stomach',
  'Nutritionally compatible': 'reason.compatible',
}

export default function PetDetail() {
  const { id } = useParams()
  const pid = encodeURIComponent(id ?? '')
  const { t } = useI18n()
  const [pet, setPet] = useState<Pet>()
  usePageTitle(pet?.name ?? t('pets.title'))
  const [error, setError] = useState<unknown>()
  const [recs, setRecs] = useState<Rec[]>()
  const [recError, setRecError] = useState<unknown>()
  const form = useForm(PET_FORM)
  const [saved, setSaved] = useState(false)

  const loadRecs = useCallback(() => {
    api<{ recommendations: Rec[] }>(`/recommendations/food?pet_id=${pid}&limit=6`)
      .then((d) => setRecs(d.recommendations), setRecError)
  }, [pid])

  useEffect(() => {
    api<Pet>(`/pets/${pid}`).then((p) => { setPet(p); loadRecs() }, setError)
  }, [pid, loadRecs])

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    const v = form.check(e.currentTarget)
    if (!v) return
    form.setBusy(true)
    try {
      const body = {
        age: v.age === '' ? null : Number(v.age),
        weight: v.weight === '' ? null : Number(v.weight),
        health_conditions: new FormData(e.currentTarget).getAll('health'),
      }
      setPet(await api<Pet>(`/pets/${pid}`, { method: 'PATCH', body }))
      setSaved(true)
      loadRecs()
    } catch (err) {
      form.setApiError(e.currentTarget, err)
    } finally {
      form.setBusy(false)
    }
  }

  if (error) return <ErrorNote error={error} />
  if (!pet) return null
  return (
    <section className="flex flex-col gap-6">
      <Link to="/pets" className="text-accent underline-offset-4 hover:underline">← {t('pet.back')}</Link>
      <div className="flex items-center gap-4">
        {pet.photo
          ? <img src={pet.photo} alt={pet.name} className="h-20 w-20 shrink-0 rounded-full object-cover" />
          : <Illustration name={pet.species === 'cat' ? 'cat' : 'dog'} className="h-20 w-20 shrink-0 text-accent" />}
        <div>
          <h1 className="text-2xl font-bold">{pet.name}</h1>
          <p>{pet.breed ? breedLabel(pet.breed) : t('pets.unknown_breed')}</p>
        </div>
      </div>
      <PhotoControls pet={pet} path={`/pets/${pid}`} onChange={setPet} />
      <Link to={`/analyze?pet=${pid}`} className={`${buttonClass('ghost')} self-start`}>{t('pet.analyze_again')}</Link>

      <Card>
        <form onSubmit={save} onBlurCapture={form.onBlur} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('pet.age')} name="age" type="number" min={0} step={1} inputMode="numeric"
              defaultValue={pet.age ?? ''} error={form.message('age')} />
            <Field label={t('pet.weight')} name="weight" type="number" min={0.1} step="any" inputMode="decimal"
              defaultValue={pet.weight ?? ''} error={form.message('weight')} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">{t('pet.health')}</legend>
            {HEALTH.map((h) => (
              <label key={h} className="flex items-center gap-3">
                <input type="checkbox" name="health" value={h} defaultChecked={pet.health_conditions.includes(h)}
                  className="h-5 w-5 accent-[var(--accent)]" />
                {t(`health.${h}`)}
              </label>
            ))}
          </fieldset>
          <ErrorSummary items={form.summary({ age: t('pet.age'), weight: t('pet.weight') })} />
          {form.apiError ? <ErrorNote error={form.apiError} /> : null}
          <div className="flex items-center gap-3">
            <Button busy={form.busy}>{t('pet.save')}</Button>
            {saved && (
              <>
                <span role="status" className="font-bold">{t('pet.saved')}</span>
                <Illustration name="success" className="h-10 w-10 text-accent" />
              </>
            )}
          </div>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 id="food" className="text-2xl font-bold">{t('pet.food')}</h2>
        {recError ? <ErrorNote error={recError} /> : null}
        {recs?.length === 0 && <p>{t('pet.food_empty')}</p>}
        {recs && recs.length > 0 && (
          <ul aria-labelledby="food" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recs.map((r) => (
              <li key={r.product_id} className="flex flex-col gap-1 rounded-2xl bg-card p-4 shadow-sm">
                <p className="font-bold">{r.name}</p>
                <p>{r.brand}{r.price != null && ` · € ${Number(r.price).toFixed(2)}`}</p>
                {r.match_reasons.length > 0 && <p>{r.match_reasons.map((m) => (REASONS[m] ? t(REASONS[m]) : m)).join(' · ')}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function PhotoControls({ pet, path, onChange }: { pet: Pet; path: string; onChange: (p: Pet) => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<unknown>()

  async function update(photo: string | Promise<string>, done: string) {
    setBusy(true)
    setStatus('')
    setError(undefined)
    try {
      onChange(await api<Pet>(path, { method: 'PATCH', body: { photo: await photo } }))
      setStatus(done)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${buttonClass('ghost')} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {t(pet.photo ? 'pet.photo_change' : 'pet.photo_add')}
          <input type="file" accept="image/*" className="sr-only" disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = '' // picking the same file again must fire onChange
              if (f) update(toJpegDataUrl(f, PHOTO_SIDE), t('pet.photo_saved'))
            }} />
        </label>
        {pet.photo && (
          <Button variant="ghost" busy={busy} onClick={() => update('', t('pet.photo_removed'))}>{t('pet.photo_remove')}</Button>
        )}
        <span role="status">{status}</span>
      </div>
      {error ? <ErrorNote error={error} /> : null}
    </div>
  )
}
