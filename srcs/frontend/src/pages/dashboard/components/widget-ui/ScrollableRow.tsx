import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface ScrollableRowProps {
  children: ReactNode
  className?: string
}

// horizontally scrollable row with hidden scrollbar and edge fades + chevrons that reveal themselves only when there's actually overflow in that direction
export function ScrollableRow({ children, className }: ScrollableRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isAnimated, setIsAnimated] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => {
      // small slack so the indicator doesn't flicker right at the boundaries
      setCanScrollLeft(el.scrollLeft >= 4)
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft >= 4)
    }

    check()
    const frame = requestAnimationFrame(() => {
      setIsAnimated(true)
    })
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)

    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  const transition = isAnimated && 'transition-opacity duration-200'

  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="scrollbar-hidden relative overflow-x-auto">
        {children}
      </div>
      {/* fade gradients: solid under the chevron, so it always reads, then fading into the content */}
      <div
        aria-hidden
        style={{
          background: 'linear-gradient(to right, var(--c-elevated) 24px, transparent)',
        }}
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-14',
          transition,
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        style={{
          background: 'linear-gradient(to left, var(--c-elevated) 24px, transparent)',
        }}
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-14',
          transition,
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* chevrons sit outside the fade, pinned to the edge */}
      <ChevronLeft
        size={18}
        aria-hidden
        className={cn(
          'text-accent pointer-events-none absolute top-1/2 left-1 -translate-y-1/2',
          transition,
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <ChevronRight
        size={18}
        aria-hidden
        className={cn(
          'text-accent pointer-events-none absolute top-1/2 right-1 -translate-y-1/2',
          transition,
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
