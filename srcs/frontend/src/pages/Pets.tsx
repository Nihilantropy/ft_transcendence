import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, type Pet } from '../api'
import { buttonClass } from '../components/Button'
import ErrorNote from '../components/ErrorNote'
import Illustration from '../components/Illustration'
import { breedLabel, useI18n } from '../i18n'

export default function Pets() {
  const { t } = useI18n()
  const [pets, setPets] = useState<Pet[]>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    api<Pet[]>('/pets').then(setPets, setError)
  }, [])

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('pets.title')}</h1>
      {error ? <ErrorNote error={error} /> : null}
      {pets?.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Illustration name="empty" className="h-32 w-32 text-accent" />
          <p>{t('pets.empty')}</p>
          <Link to="/analyze" className={buttonClass('primary')}>{t('pets.empty_cta')}</Link>
        </div>
      )}
      {pets && pets.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pets.map((p) => (
            <li key={p.id}>
              <Link to={`/pets/${p.id}`} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm transition hover:shadow-md">
                <Illustration name={p.species === 'cat' ? 'cat' : 'dog'} className="h-16 w-16 shrink-0 text-accent" />
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p>{p.breed ? breedLabel(p.breed) : t('pets.unknown_breed')}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
