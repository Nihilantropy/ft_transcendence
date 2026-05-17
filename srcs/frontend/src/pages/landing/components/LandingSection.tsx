import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

interface LandingSectionProps {
  label: string
  background?: 'base' | 'elevated'
  noSpacing?: boolean
  children: ReactNode
}

export function LandingSection({
  label,
  background = 'base',
  noSpacing = false,
  children,
}: LandingSectionProps) {
  return (
    <section
      className={cn(
        noSpacing ? 'pb-section' : 'py-section',
        background === 'elevated' && 'bg-elevated',
      )}
    >
      <div className="mx-auto max-w-5xl px-4">
        <p className="text-text-mid mb-12 text-sm font-medium tracking-[0.2em] uppercase">
          {label}
        </p>
        {children}
      </div>
    </section>
  )
}
