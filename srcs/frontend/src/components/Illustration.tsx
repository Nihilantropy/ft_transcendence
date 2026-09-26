/*!
 * Line art from Tabler Icons — https://tabler.io/icons — MIT License, Copyright (c) 2020-2024 Paweł Kuna.
 * The flying cat's wings are drawn for SmartBreeds in the same stroke.
 */
import type { CSSProperties, ReactNode } from 'react'

export type IllustrationName = 'dog' | 'hello' | 'cat' | 'waiting' | 'empty' | 'error' | 'success' | 'flyingCat'

// pathLength=1 lets the "hello" draw-in animate any path with the same dash values.
function Dog() {
  return (
    <g className="ill-head">
      <path pathLength={1} d="M11 5h2" />
      <path pathLength={1} d="M19 12c-.667 5.333 -2.333 8 -5 8h-4c-2.667 0 -4.333 -2.667 -5 -8" />
      <path pathLength={1} d="M11 16c0 .667 .333 1 1 1s1 -.333 1 -1h-2" />
      <path pathLength={1} d="M12 18v2" />
      <g className="ill-eyes">
        <path d="M10 11v.01" />
        <path d="M14 11v.01" />
      </g>
      <path pathLength={1} className="ill-ear-l" d="M5 4l6 .97l-6.238 6.688a1.021 1.021 0 0 1 -1.41 .111a.953 .953 0 0 1 -.327 -.954l1.975 -6.815" />
      <path pathLength={1} className="ill-ear-r" d="M19 4l-6 .97l6.238 6.688c.358 .408 .989 .458 1.41 .111a.953 .953 0 0 0 .327 -.954l-1.975 -6.815" />
    </g>
  )
}

const CAT = (
  <>
    <path d="M20 3v10a8 8 0 1 1 -16 0v-10l3.432 3.432a7.963 7.963 0 0 1 4.568 -1.432c1.769 0 3.403 .574 4.728 1.546l3.272 -3.546" />
    <path d="M2 16h5l-4 4" />
    <path d="M22 16h-5l4 4" />
    <path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M9 11v.01" />
    <path d="M15 11v.01" />
  </>
)

const PAW = (
  <>
    <path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538" />
    <path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0" />
    <path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267" />
    <path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267" />
    <path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082" />
  </>
)

const BONE = <path d="M15 3a3 3 0 0 1 3 3a3 3 0 1 1 -2.12 5.122l-4.758 4.758a3 3 0 1 1 -5.117 2.297l0 -.177l-.176 0a3 3 0 1 1 2.298 -5.115l4.758 -4.758a3 3 0 0 1 2.12 -5.122l-.005 -.005" />
const HEART = <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
const QUESTION = (
  <>
    <path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4" />
    <path d="M12 19l0 .01" />
  </>
)
const SPARKLES = <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6" />
const DOG_BOWL = (
  <>
    <path d="M3 20h18c-.175 -1.671 -.046 -3.345 -2 -5h-14c-1.333 1 -2 2.667 -2 5" />
  </>
)

// A static transform on the outer <g>, the animation on the inner one: a CSS transform would
// otherwise replace the SVG transform attribute.
function Placed({ at, anim, style, children }: { at: string; anim: string; style?: CSSProperties; children: ReactNode }) {
  return <g transform={at}><g className={anim} style={style}>{children}</g></g>
}

const ART: Record<IllustrationName, { viewBox: string; body: ReactNode }> = {
  dog: { viewBox: '0 0 24 24', body: <Dog /> },
  hello: { viewBox: '0 0 24 24', body: <g className="ill-hello"><Dog /></g> },
  cat: { viewBox: '0 0 24 24', body: CAT },
  waiting: {
    viewBox: '-4 -2 32 32',
    body: (
      <>
        <g className="ill-sniff"><Dog /></g>
        {[0, 1, 2].map((i) => (
          <Placed key={i} at={`translate(${1 + i * 7.5} ${i % 2 ? 23 : 25}) scale(.28)`} anim="ill-step"
            style={{ animationDelay: `${i * 0.3}s` }}>{PAW}</Placed>
        ))}
      </>
    ),
  },
  empty: {
    viewBox: '-2 -8 28 30',
    body: (
      <>
        <g className="ill-wobble">{DOG_BOWL}</g>
        <Placed at="translate(7 5) scale(.42)" anim="ill-drop">{BONE}</Placed>
      </>
    ),
  },
  error: {
    viewBox: '-2 -7 30 31',
    body: (
      <>
        <g className="ill-tilt"><Dog /></g>
        <Placed at="translate(19 -6) scale(.45)" anim="ill-qm">{QUESTION}</Placed>
      </>
    ),
  },
  success: {
    viewBox: '-3 -7 31 31',
    body: (
      <>
        <g className="ill-hop"><Dog /></g>
        <Placed at="translate(18 -6) scale(.42)" anim="ill-pop">{HEART}</Placed>
        <Placed at="translate(-3 -5) scale(.36)" anim="ill-twinkle">{SPARKLES}</Placed>
      </>
    ),
  },
  flyingCat: {
    viewBox: '-7 -1 38 26',
    body: (
      <>
        <path className="ill-wing-l" d="M4 13c-3.5-.5-8-2.5-9.5-7 3 .2 6 1.8 8 4.5M-2.5 9.5c1.5.3 3 1 4.5 2" />
        <path className="ill-wing-r" d="M20 13c3.5-.5 8-2.5 9.5-7-3 .2-6 1.8-8 4.5M26.5 9.5c-1.5.3-3 1-4.5 2" />
        {CAT}
      </>
    ),
  },
}

export default function Illustration({ name, className = 'h-32 w-32' }: { name: IllustrationName; className?: string }) {
  const { viewBox, body } = ART[name]
  return (
    <svg viewBox={viewBox} className={className} fill="none" stroke="currentColor" strokeWidth={1.25}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {body}
    </svg>
  )
}
