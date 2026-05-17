import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router'

// top-level errorElement for React Router
export function ErrorPage() {
  const { t } = useTranslation('common')
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : undefined

  return (
    <div className="bg-base flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl text-center">
        <AlertTriangle className="text-accent mx-auto" size={56} strokeWidth={1.25} aria-hidden />
        {status !== undefined && (
          <p
            className="text-accent mt-6 font-extrabold tabular-nums"
            style={{ fontSize: 'clamp(3rem,8vw,5rem)', lineHeight: 1 }}
          >
            {status}
          </p>
        )}
        <h1 className="text-text-hi mt-2 text-2xl font-bold tracking-tight">
          {t('errors.page.title')}
        </h1>
        <p className="text-text-mid mt-3 text-sm leading-relaxed">{t('errors.page.message')}</p>
        <Button size="lg" asChild className="mt-8">
          <Link to="/">{t('errors.goHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
