import type { Species } from '@/api/types'
import { Cat, Dog, PawPrint } from 'lucide-react'
import { createElement, type ComponentProps } from 'react'

// render icon based on pet.species, defaulting to a paw print for "other" species
const ICONS = {
  dog: Dog,
  cat: Cat,
  other: PawPrint,
} as const

type IconProps = ComponentProps<typeof Dog>

export function renderSpeciesIcon(species: Species, props?: IconProps) {
  return createElement(ICONS[species], props)
}
