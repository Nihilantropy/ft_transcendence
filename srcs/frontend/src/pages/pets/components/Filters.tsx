import type { SpeciesFilter } from '@/api/types'
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown'
import { Input } from '@/components/ui/Input'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FiltersProps {
  search: string
  onSearchChange: (v: string) => void
  species: SpeciesFilter
  onSpeciesChange: (v: SpeciesFilter) => void
}

// search input + species dropdown that drive the pets list grid
export function Filters({ search, onSearchChange, species, onSpeciesChange }: FiltersProps) {
  const { t } = useTranslation('pets')

  const speciesOptions: DropdownOption<SpeciesFilter>[] = [
    { value: 'all', label: t('filterSpecies') },
    { value: 'dog', label: t('species.dog') },
    { value: 'cat', label: t('species.cat') },
    { value: 'other', label: t('species.other') },
  ]

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          size={16}
          aria-hidden
          className="text-text-lo pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="px-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('clearSearch')}
            className="text-text-lo hover:text-text-hi absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      <div className="sm:w-48">
        <Dropdown
          value={species}
          onChange={onSpeciesChange}
          options={speciesOptions}
          placeholder={t('filterSpecies')}
          searchPlaceholder={t('filterSpecies')}
        />
      </div>
    </div>
  )
}
