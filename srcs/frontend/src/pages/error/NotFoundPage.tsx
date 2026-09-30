import notFoundAnimation from '@/assets/lottie/not-found.json'
import { Button } from '@/components/ui/Button'
import { LottiePlayer } from '@/components/ui/LottiePlayer'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <div className="mx-auto w-full max-w-md px-6 text-center">
      <div>
        <p
          className="text-accent font-extrabold tabular-nums"
          style={{ fontSize: 'clamp(5rem,15vw,9rem)', lineHeight: 1 }}
        >
          404
        </p>
        <h1 className="text-text-hi mt-2 text-2xl font-bold tracking-tight">
          {t('errors.notFound.title')}
        </h1>
        <p className="text-text-mid mt-3 text-sm leading-relaxed">{t('errors.notFound.message')}</p>

        {/* Lottie animation */}
        <LottiePlayer src={notFoundAnimation} className="mx-auto mt-8 h-56 w-56 sm:h-64 sm:w-64" />

        {/* Back to home CTA */}
        <Button variant="subtle" asChild className="mt-4">
          <Link to="/">
            <ArrowLeft size={16} aria-hidden />
            {t('errors.goHome')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
