import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'

export function AppShell() {
  const mainRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  // the header gets a border when the main content is scrolled, to visually
  // separate it from the content
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const onScroll = () => setIsScrolled(main.scrollTop > 4)
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <Header bordered={isScrolled} />
      {/* scrollbar-gutter keeps centered content from shifting when the scrollbar appears/disappears */}
      <main ref={mainRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex min-h-full flex-col">
          <div className="flex-1 pt-6 pb-12 lg:pt-10 lg:pb-16">
            <Outlet />
          </div>
          <Footer />
        </div>
      </main>
    </div>
  )
}
