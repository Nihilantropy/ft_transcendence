import type { ReactNode } from 'react'

// Six thin-line illustrations. They inherit color from `currentColor` (set text-accent etc).
export type IllustrationName = 'dog' | 'cat' | 'waiting' | 'empty' | 'error' | 'success'

const dog = (
  <>
    <path d="M38 48c0-14 10-24 22-24s22 10 22 24v14c0 16-10 28-22 28S38 78 38 62z" />
    <path d="M38 44c-10 2-16 12-14 26 1 6 6 8 10 4" />
    <path d="M82 44c10 2 16 12 14 26-1 6-6 8-10 4" />
    <circle cx="51" cy="56" r="1.5" fill="currentColor" />
    <circle cx="69" cy="56" r="1.5" fill="currentColor" />
    <path d="M56 67h8l-4 4z" fill="currentColor" />
    <path d="M60 71v4m-6 2c3 3 9 3 12 0" />
  </>
)

const cat = (
  <>
    <path d="M36 52 34 26l18 12h16l18-12-2 26" />
    <path d="M36 52c-2 20 10 36 24 36s26-16 24-36" />
    <circle cx="50" cy="58" r="1.5" fill="currentColor" />
    <circle cx="70" cy="58" r="1.5" fill="currentColor" />
    <path d="M57 68h6l-3 3z" fill="currentColor" />
    <path d="M28 66h18M28 73l18-3M92 66H74M92 73l-18-3" />
  </>
)

const PATHS: Record<IllustrationName, ReactNode> = {
  dog,
  cat,
  // Nose down, sniffing, with three pulsing dots.
  waiting: (
    <>
      <g transform="rotate(18 60 60)">{dog}</g>
      <circle cx="30" cy="100" r="2.5" fill="currentColor" className="animate-pulse" />
      <circle cx="42" cy="104" r="2.5" fill="currentColor" className="animate-pulse [animation-delay:300ms]" />
      <circle cx="54" cy="106" r="2.5" fill="currentColor" className="animate-pulse [animation-delay:600ms]" />
    </>
  ),
  // Kennel.
  empty: (
    <>
      <path d="M18 62 60 26l42 36" />
      <path d="M28 54v42h64V54" />
      <path d="M48 96V76a12 12 0 0 1 24 0v20" />
    </>
  ),
  // Puzzled: head tilted, question mark.
  error: (
    <>
      <g transform="rotate(-14 60 60)">{dog}</g>
      <path d="M94 20c0-7 12-7 12 0 0 6-6 6-6 12" />
      <circle cx="100" cy="40" r="1.5" fill="currentColor" />
    </>
  ),
  // Happy: head with a bouncing heart.
  success: (
    <>
      {dog}
      <path d="M100 30c-3-6-12-3-9 3l9 9 9-9c3-6-6-9-9-3z" className="animate-bounce" />
    </>
  ),
}

export default function Illustration({ name, className = 'h-32 w-32' }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
