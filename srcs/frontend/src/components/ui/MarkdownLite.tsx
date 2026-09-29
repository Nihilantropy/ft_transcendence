import { cn } from '@/lib/utils'
import { Fragment, type ReactNode } from 'react'

interface MarkdownLiteProps {
  text: string
  className?: string
}

// Minimal markdown renderer for LLM/RAG output
export function MarkdownLite({ text, className }: MarkdownLiteProps) {
  const blocks = parseBlocks(text)

  return (
    // line-height inherits: matches the rest of the report card
    <div className={cn('space-y-2 text-sm', className)}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <p key={i} className="text-text-hi mt-3 mb-1 font-semibold first:mt-0">
              {renderInline(block.text)}
            </p>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className={cn('flex items-baseline gap-2.5', item.nested && 'ml-5')}>
                  <span
                    className="bg-text-lo/60 h-1 w-1 flex-shrink-0 translate-y-[-1px] rounded-full"
                    aria-hidden
                  />
                  <span className="text-text-hi min-w-0">{renderInline(item.text)}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-text-hi">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: { text: string; nested: boolean }[] }

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let list: { text: string; nested: boolean }[] | null = null

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^(\s*)-\s+(.*)$/.exec(line)

    if (bullet) {
      list ??= []
      list.push({ text: bullet[2] ?? '', nested: (bullet[1] ?? '').length >= 2 })
      continue
    }
    if (list) {
      blocks.push({ type: 'list', items: list })
      list = null
    }

    const trimmed = line.trim()
    if (trimmed === '') continue
    const heading = /^#{1,4}\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] ?? '' })
    } else {
      blocks.push({ type: 'paragraph', text: trimmed })
    }
  }
  if (list) blocks.push({ type: 'list', items: list })

  return blocks
}

// **bold** -> <strong>, everything else as-is
function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i % 2 === 1 ? <strong className="font-semibold">{part}</strong> : part}
    </Fragment>
  ))
}
