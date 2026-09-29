import { OAUTH_42_START_URL } from '@/api/routes'
import { Button } from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'

export function OAuth42Button() {
  const { t } = useTranslation('auth')

  return (
    <div className="mt-6 flex flex-col items-center gap-5">
      <div className="flex w-full items-center gap-4" aria-hidden>
        <span className="bg-border-soft h-px flex-1" />
        <span className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
          {t('oauth.or')}
        </span>
        <span className="bg-border-soft h-px flex-1" />
      </div>
      <Button variant="outline" asChild>
        <a href={OAUTH_42_START_URL}>
          <Logo42 />
          {t('oauth.cta')}
        </a>
      </Button>
    </div>
  )
}

// the 42 school mark
function Logo42() {
  return (
    <svg viewBox="345 420 513 360" className="h-3.5 w-auto" fill="currentColor" aria-hidden>
      <path d="M533 420h95L440 608h188v172h-95v-94H345v-78z" />
      <path d="M668 420h95l-95 95zM763 420h95v95l-95 95v93h-95v-95l95-93zM858 610v93h-95z" />
    </svg>
  )
}
