import { Brand } from '@/components/layout/Brand'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Image } from '@/components/ui/Image'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  image: string
  imageAlt?: string
  quote?: string
  quoteCaption?: string
}

export function AuthLayout({
  children,
  image,
  imageAlt = '',
  quote,
  quoteCaption,
}: AuthLayoutProps) {
  return (
    <div className="relative grid h-screen w-full overflow-hidden lg:grid-cols-[2fr_3fr]">
      <Header />
      <VisualPanel image={image} imageAlt={imageAlt} quote={quote} quoteCaption={quoteCaption} />
      <div className="bg-base flex h-full items-center justify-center overflow-y-auto px-6 py-12 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}

// logo + toggles, pinned across the top of both panels
function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 lg:px-8 lg:py-4">
      <Brand to="/" className="lg:text-white" />
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}

// left section of the layout, meant for a large photo with optional quote overlay
// hidden on mobile
interface VisualPanelProps {
  image: string
  imageAlt: string
  quote?: string
  quoteCaption?: string
}

function VisualPanel({ image, imageAlt, quote, quoteCaption }: VisualPanelProps) {
  return (
    <div className="relative hidden lg:block">
      <Image
        src={image}
        alt={imageAlt}
        eager
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* copper warm color overlay */}
      <div className="bg-accent/10 pointer-events-none absolute inset-0" aria-hidden />
      {/* dark mode overlay */}
      <div
        className="bg-base pointer-events-none absolute inset-0 opacity-0 dark:opacity-10"
        aria-hidden
      />
      {/* dark mode vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, oklch(0% 0 0 / 0.5) 100%)',
        }}
        aria-hidden
      />
      {/* quote + caption, if provided */}
      {quote && (
        <div
          className="absolute right-10 bottom-10 left-10 text-white"
          style={{ textShadow: '0 2px 12px oklch(0% 0 0 / 0.45)' }}
        >
          <p className="font-sans text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            {quote}
          </p>
          {quoteCaption && (
            <p className="mt-3 text-sm font-medium tracking-wide text-white/70">{quoteCaption}</p>
          )}
        </div>
      )}
    </div>
  )
}
