import type { ReactNode } from 'react'

export default function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl bg-card p-6 shadow-sm ${className}`}>{children}</div>
}
