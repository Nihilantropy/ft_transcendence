import { useEffect, useState } from 'react'

const KEY = 'motion'

function initialPaused(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'paused' || saved === 'running') return saved === 'paused' // explicit choice wins
  } catch {
    // ponytail: storage blocked → fall back to the OS preference
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** One switch for every animation (WCAG 2.2.2). Reflected on <html data-motion>. */
export function useMotion() {
  const [paused, setPausedState] = useState(initialPaused)
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? 'paused' : 'running'
  }, [paused])
  const setPaused = (p: boolean) => {
    try {
      localStorage.setItem(KEY, p ? 'paused' : 'running')
    } catch {
      // ponytail: not persisted, still applied for this visit
    }
    setPausedState(p)
  }
  return { paused, setPaused }
}
