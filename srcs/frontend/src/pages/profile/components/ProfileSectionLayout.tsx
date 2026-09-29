import { useId, type ReactNode } from 'react'

interface ProfileSectionLayoutProps {
  title: string
  description?: ReactNode
  aside?: ReactNode
  children?: ReactNode
}

// shared layout of the profile page blocks: title + description, then its form/content
export function ProfileSectionLayout({
  title,
  description,
  aside,
  children,
}: ProfileSectionLayoutProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="border-border-soft border-t pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={headingId} className="text-text-hi text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-text-mid mt-1 text-sm">{description}</p>}
        </div>
        {aside}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}
