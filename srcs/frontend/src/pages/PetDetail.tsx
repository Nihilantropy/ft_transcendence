import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, fieldError, type Pet } from '../api'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNote from '../components/ErrorNote'
import Field from '../components/Field'
import Illustration from '../components/Illustration'
import { breedLabel, useI18n } from '../i18n'

// Exactly the conditions the recommender scores (recommendation-service feature_engineering.py).
const HEALTH = ['sensitive_stomach', 'weight_management', 'joint_health', 'skin_allergies', 'dental_health', 'kidney_health']

type Rec = { product_id: number; name: string; brand: string; price: string | number | null; match_reasons: string[] }

export default function PetDetail() {
  const { id } = useParams()
  const pid = encodeURIComponent(id ?? '')
  const { t } = useI18n()
  const [pet, setPet] = useState<Pet>()
  const [error, setError] = useState<unknown>()
  const [recs, setRecs] = useState<Rec[]>()
  const [recError, setRecError] = useState<unknown>()
  const [formError, setFormError] = useState<unknown>()
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
    const f = new FormData(e.currentTarget)
    const num = (k: string) => {
      const v = String(f.get(k) ?? '').trim()
      return v === '' ? null : Number(v) // empty = unknown, which the backend accepts
    }
    setSaved(false)
    setFormError(undefined)
    try {
      const body = { age: num('age'), weight: num('weight'), health_conditions: f.getAll('health') }
      setPet(await api<Pet>(`/pets/${pid}`, { method: 'PATCH', body }))
      setSaved(true)
      loadRecs()
    } catch (err) {
      setFormError(err)
    }
  }

  if (error) return <ErrorNote error={error} />
  if (!pet) return null
  return (
    <section className="flex flex-col gap-6">
      <Link to="/pets" className="text-accent underline-offset-4 hover:underline">← {t('pet.back')}</Link>
      <div className="flex items-center gap-4">
        <Illustration name={pet.species === 'cat' ? 'cat' : 'dog'} className="h-20 w-20 shrink-0 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">{pet.name}</h1>
          <p>{pet.breed ? breedLabel(pet.breed) : t('pets.unknown_breed')}</p>
        </div>
      </div>

      <Card>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('pet.age')} name="age" type="number" min={0} step={1} inputMode="numeric"
              defaultValue={pet.age ?? ''} error={fieldError(formError, 'age')} />
            <Field label={t('pet.weight')} name="weight" type="number" min={0.1} step="any" inputMode="decimal"
              defaultValue={pet.weight ?? ''} error={fieldError(formError, 'weight')} />
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
          {formError ? <ErrorNote error={formError} /> : null}
          <div className="flex items-center gap-3">
            <Button>{t('pet.save')}</Button>
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
                {r.match_reasons.length > 0 && <p>{r.match_reasons.join(' · ')}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
