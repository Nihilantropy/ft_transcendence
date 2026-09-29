import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'

export interface DropdownOption<V extends string = string> {
  value: V
  label: string
  render?: ReactNode
}

interface DropdownProps<V extends string = string> {
  value: V | ''
  onChange: (value: V) => void
  options: DropdownOption<V>[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  // whether the popover lets the user pick a custom typed value
  allowCustom?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  id?: string
  onClear?: () => void
  clearLabel?: string
  searchable?: boolean
  align?: 'start' | 'end'
}

// searchable dropdown built on Radix Popover + cmdk Command
// parent owns value/onChange, internal state only tracks open + search query (draft)
export function Dropdown<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText = 'Nessun risultato',
  disabled,
  className,
  allowCustom = false,
  ariaInvalid,
  ariaDescribedBy,
  id,
  onClear,
  clearLabel = 'Clear',
  searchable = true,
  align = 'start',
}: DropdownProps<V>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const listId = useId()
  // without the search field, the list itself takes focus so cmdk's keyboard nav works
  const commandRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  // when allowCustom and the typed value isn't in options, show it as the "selected" label
  const displayLabel = selected?.label ?? (allowCustom && value ? String(value) : undefined)

  const handleSelect = (v: string) => {
    onChange(v as V)
    setOpen(false)
    setQuery('')
  }

  const canClear = Boolean(onClear && value && !disabled)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* the clear button sits over the trigger (a button can't nest in a button) */}
      <div className="relative">
        <Popover.Trigger asChild>
          <Button
            variant="naked"
            id={id}
            type="button"
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={ariaInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'border-border-soft text-text-hi flex h-11 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm font-normal',
              'focus-visible:border-accent focus-visible:ring-accent/30',
              !displayLabel && 'text-text-lo',
              className,
            )}
          >
            <span className={cn('truncate text-left', canClear && 'pr-8')}>
              {displayLabel ?? placeholder}
            </span>
            <ChevronDown size={16} className="text-text-mid ml-2 shrink-0" aria-hidden />
          </Button>
        </Popover.Trigger>
        {canClear && (
          <button
            type="button"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={onClear}
            className="text-text-lo hover:text-text-hi focus-visible:ring-accent absolute top-1/2 right-9 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            if (searchable) return
            e.preventDefault()
            commandRef.current?.focus()
          }}
          className="border-border-soft bg-elevated z-50 w-[var(--radix-popover-trigger-width)] min-w-40 rounded-md border shadow-[0_12px_32px_oklch(0%_0_0/0.35)]"
        >
          <Command ref={commandRef} tabIndex={-1} className="outline-none">
            {searchable && (
              <div className="border-border-soft border-b px-3 py-2">
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={searchPlaceholder}
                  className="text-text-hi placeholder:text-text-lo h-8 w-full bg-transparent text-sm outline-none"
                />
              </div>
            )}
            <Command.List id={listId} className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="text-text-mid px-3 py-6 text-center text-sm">
                {allowCustom && query.trim() ? (
                  <Button
                    variant="naked"
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => handleSelect(query.trim())}
                  >
                    {query.trim()}
                  </Button>
                ) : (
                  emptyText
                )}
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    'text-text-hi flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm',
                    'aria-selected:bg-accent/10',
                  )}
                >
                  <span>{option.render ?? option.label}</span>
                  {option.value === value && (
                    <Check size={14} className="text-accent" aria-hidden />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
