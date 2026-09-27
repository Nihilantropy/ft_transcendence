import { useEffect } from 'react'

/** Every route gets its own, translated document title (WCAG 2.4.2). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · SmartBreeds`
  }, [title])
}
