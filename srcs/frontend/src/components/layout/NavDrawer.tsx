import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/Button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface NavItem {
  href: string
  labelKey: string
}

interface NavDrawerProps {
  items: ReadonlyArray<NavItem>
}

// mobile burger + slide-in menu
// hidden on lg+ when desktop nav is shown inline
// auto-closes when crossing into lg while open, via media query listener
export function NavDrawer({ items }: NavDrawerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
    }
  }, [open])

  // defensive: prevent opening if already on desktop (burger should be hidden but in case of programmatic trigger or rapid resize)
  const handleOpenChange = (next: boolean) => {
    if (next && window.matchMedia('(min-width: 1024px)').matches) return
    setOpen(next)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t('accessibility.openNav')}
        >
          <Menu size={20} aria-hidden />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="bg-base fixed inset-0 z-50 flex flex-col px-6 py-3 outline-none">
          <div className="flex items-center justify-between">
            <Brand />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t('accessibility.closeNav')}>
                <X size={20} aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="sr-only">
            {t('accessibility.openNav')}
          </DialogPrimitive.Title>
          <nav className="mt-16 flex flex-1 flex-col gap-1">
            {items.map(({ href, labelKey }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="text-text-hi hover:text-accent py-3 text-xl font-semibold transition-colors"
              >
                {t(labelKey)}
              </a>
            ))}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
