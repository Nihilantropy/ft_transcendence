import type { Pet } from '@/api/types'
import { renderSpeciesIcon } from '@/components/pet/speciesIcon'
import { Image } from '@/components/ui/Image'
import { cn } from '@/lib/utils'

interface PetChipsProps {
  pets: Pet[]
  selectedId: string
  onSelect: (id: string) => void
  label: string
}

export function PetChips({ pets, selectedId, onSelect, label }: PetChipsProps) {
  return (
    <ul aria-label={label} className="scrollbar-hidden -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {pets.map((pet) => {
        const isSelected = pet.id === selectedId
        const src = pet.photo || pet.image_url
        return (
          <li key={pet.id} className="flex-shrink-0">
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(pet.id)
              }}
              className={cn(
                'flex h-10 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1 text-sm font-medium transition-colors',
                'focus-visible:ring-accent focus-visible:ring-offset-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                isSelected
                  ? 'border-accent bg-accent/10 text-text-hi'
                  : 'border-border-soft text-text-mid hover:border-accent/60 hover:text-text-hi',
              )}
            >
              {src ? (
                <Image src={src} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="bg-elevated text-text-lo flex h-8 w-8 items-center justify-center rounded-full">
                  {renderSpeciesIcon(pet.species, {
                    size: 16,
                    strokeWidth: 1.5,
                    'aria-hidden': true,
                  })}
                </span>
              )}
              {pet.name}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
