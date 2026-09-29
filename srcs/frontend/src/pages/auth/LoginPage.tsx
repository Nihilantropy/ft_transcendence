import type { LoginPayload } from '@/api/types'
import doggoImage from '@/assets/images/doggo.jpg'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage, getSafeNext } from '@/lib/utils'
import { AuthLayout } from '@/pages/auth/components/AuthLayout'
import { OAuth42Button } from '@/pages/auth/components/OAuth42Button'
import { TwoFactorStep } from '@/pages/auth/components/TwoFactorStep'
import { useLoginMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

// ?oauth=… outcomes of "Log in with 42" that land back on this page
const OAUTH_MESSAGES = ['error', 'unavailable', 'exists'] as const

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // set when the password is right but 2FA is on: the code step replaces the form
  const [mfaToken, setMfaToken] = useState<string | null>(() =>
    searchParams.get('oauth') === 'mfa' ? location.hash.slice(1) || null : null,
  )

  const schema = z.object({
    email: z.email(t('errors.invalidEmail')),
    password: z.string().min(1, t('errors.passwordRequired')),
  })

  const form = useForm<LoginPayload>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const loginMutation = useLoginMutation()

  const goNext = () => {
    void navigate(getSafeNext(searchParams, '/'), { replace: true })
  }

  const oauthHandledRef = useRef(false)
  useEffect(() => {
    if (oauthHandledRef.current) return
    const outcome = searchParams.get('oauth')
    if (!outcome) return
    oauthHandledRef.current = true
    if ((OAUTH_MESSAGES as readonly string[]).includes(outcome)) {
      toast.error(t(`oauth.${outcome}`))
    } else if (outcome === 'mfa' && !location.hash.slice(1)) {
      toast.error(t('oauth.error'))
    }
    void navigate('/login', { replace: true })
  }, [searchParams, location.hash, navigate, t])

  const onSubmit = (values: LoginPayload) => {
    loginMutation.mutate(values, {
      onSuccess: (result) => {
        if ('mfa_token' in result) {
          setMfaToken(result.mfa_token)
          return
        }
        goNext()
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, 'auth', t))
      },
    })
  }

  const restart = () => {
    setMfaToken(null)
    form.resetField('password')
  }

  return (
    <AuthLayout
      image={doggoImage}
      imageAlt=""
      quote={t('login.quote')}
      quoteCaption={t('login.quoteCaption')}
    >
      {mfaToken ? (
        <TwoFactorStep mfaToken={mfaToken} onSuccess={goNext} onRestart={restart} />
      ) : (
        <>
          {/* Title and Subtitle */}
          <h1 className="text-text-hi text-3xl font-bold tracking-tight">{t('login.title')}</h1>
          <p className="text-text-mid mt-2 text-sm whitespace-pre-line">{t('login.subtitle')}</p>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e)
            }}
            className="mt-8 flex flex-col gap-5"
          >
            {/* Email */}
            <FormTextInput
              form={form}
              name="email"
              label={t('login.email')}
              type="email"
              autoComplete="email"
            />

            {/* Password + forgot password CTA */}
            <div className="flex flex-col gap-3">
              <FormPasswordInput
                form={form}
                name="password"
                label={t('login.password')}
                autoComplete="current-password"
                showLabel={t('login.showPassword')}
                hideLabel={t('login.hidePassword')}
              />
              <Link
                to="/forgot-password"
                className="text-text-mid hover:text-accent self-start text-xs underline-offset-4 hover:underline"
              >
                {t('login.forgotPassword')}
              </Link>
            </div>

            {/* Submit */}
            <Button type="submit" size="lg" width="full" isLoading={loginMutation.isPending}>
              {t('login.submit')}
            </Button>
          </form>

          <OAuth42Button />

          {/* not registered CTA */}
          <p className="text-text-mid mt-6 text-center text-sm">
            {t('login.noAccount')}{' '}
            <Link
              to="/register"
              className="text-accent hover:text-accent-hi underline-offset-4 hover:underline"
            >
              {t('login.registerLink')}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
