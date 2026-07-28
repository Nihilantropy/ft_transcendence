import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ScrollableRowProps {
  children: ReactNode
  className?: string
}

// horizontally scrollable row with hidden scrollbar and edge fades + chevrons that reveal themselves only when there's actually overflow in that direction
export function ScrollableRow({ children, className }: ScrollableRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => {
      // small slack so the indicator doesn't flicker right at the boundaries
      setCanScrollLeft(el.scrollLeft >= 4)
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft >= 4)
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="scrollbar-hidden overflow-x-auto">
        {children}
      </div>
      {/* fade gradients only: visual cue that content continues */}
      <div
        aria-hidden
        style={{
          background: 'linear-gradient(to right, var(--c-elevated), transparent)',
        }}
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-10 transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        style={{
          background: 'linear-gradient(to left, var(--c-elevated), transparent)',
        }}
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* chevrons sit outside the fade, pinned to the edge */}
      <ChevronLeft
        size={18}
        aria-hidden
        className={cn(
          'text-accent pointer-events-none absolute top-1/2 left-1 -translate-y-1/2 transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <ChevronRight
        size={18}
        aria-hidden
        className={cn(
          'text-accent pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
