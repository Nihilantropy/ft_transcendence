import { describe, expect, test } from 'vitest'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const css = readFileSync(join(__dirname, 'index.css'), 'utf-8')

// WCAG 2.1 relative luminance / contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([a-z]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

const [lightBlock, rest] = css.split('@media (prefers-color-scheme: dark)')
const THEMES = { light: tokens(lightBlock), dark: tokens(rest.split('@theme')[0]) }

// [foreground, background, minimum]
const PAIRS: [string, string, number][] = [
  ['fg', 'bg', 4.5], ['fg', 'card', 4.5],
  ['card', 'accent', 4.5], ['card', 'danger', 4.5], // button labels
  ['accent', 'bg', 4.5], ['accent', 'card', 4.5], // links
  ['danger', 'card', 4.5], ['danger', 'bg', 4.5], // error text
  ['field', 'card', 3], ['field', 'bg', 3], // form-control borders (1.4.11)
]

describe.each(Object.entries(THEMES))('%s theme', (_, t) => {
  test.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(t[fg], `missing --${fg}`).toBeDefined()
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min)
  })
})
