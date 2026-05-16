import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names safely for Tailwind components.
 *
 * - `clsx` builds the className string from mixed inputs (strings, objects,
 *   arrays, conditionals), filtering out falsy values.
 * - `tailwind-merge` then resolves conflicting Tailwind utilities so that
 *   the last one wins (e.g. `cn('px-4', condition && 'px-2')` returns
 *   `'px-2'`, not `'px-4 px-2'`).
 *
 * Use whenever a component composes class names dynamically.
 *
 * @example
 *   cn('rounded-md bg-base', isActive && 'bg-accent', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
