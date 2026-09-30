import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { RECOVERY_PATTERN, TOTP_PATTERN } from '@/lib/twoFactor'
import { getApiErrorMessage } from '@/lib/utils'
import { useLoginTwoFactorMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

interface TwoFactorStepProps {
  mfaToken: string
  onSuccess: () => void
  // challenge expired or voided: the password step must start over
  onRestart: () => void
}

// second login step: a 6-digit code from the authenticator app, or a recovery code
export function TwoFactorStep({ mfaToken, onSuccess, onRestart }: TwoFactorStepProps) {
  const { t } = useTranslation(['auth', 'common'])
  const [useRecovery, setUseRecovery] = useState(false)
  const mutation = useLoginTwoFactorMutation()

  const schema = z.object({
    code: z
      .string()
      .trim()
      .min(1, t('twoFactor.errors.codeRequired'))
      .regex(
        useRecovery ? RECOVERY_PATTERN : TOTP_PATTERN,
        useRecovery ? t('twoFactor.errors.recoveryFormat') : t('twoFactor.errors.codeFormat'),
      ),
  })

  const form = useForm<{ code: string }>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  })

  // the code field is the only thing to do on this step: put the cursor there
  useEffect(() => {
    form.setFocus('code')
  }, [form, useRecovery])

  const onSubmit = ({ code }: { code: string }) => {
    mutation.mutate(
      { mfa_token: mfaToken, code: code.trim() },
      {
        onSuccess,
        onError: (error) => {
          const { code: errorCode } = error as { code?: string }
          // the challenge lives 5 minutes and dies if 2FA is switched off meanwhile
          if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN') {
            toast.error(t('twoFactor.errors.expired'))
            onRestart()
            return
          }
          if (errorCode === 'INVALID_2FA_CODE') {
            form.setError('code', { message: t('errors.INVALID_2FA_CODE') }, { shouldFocus: true })
            return
          }
          toast.error(getApiErrorMessage(error, 'auth', t))
        },
      },
    )
  }

  const toggleRecovery = () => {
    setUseRecovery((v) => !v)
    form.reset({ code: '' })
  }

  return (
    <>
      <h1 className="text-text-hi text-3xl font-bold tracking-tight">{t('twoFactor.title')}</h1>
      <p className="text-text-mid mt-2 text-sm">
        {useRecovery ? t('twoFactor.recoverySubtitle') : t('twoFactor.subtitle')}
      </p>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="mt-8 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-3">
          <FormTextInput
            key={useRecovery ? 'recovery' : 'totp'}
            form={form}
            name="code"
            label={useRecovery ? t('twoFactor.recoveryCode') : t('twoFactor.code')}
            placeholder={useRecovery ? 'ABCD-EFGH-JKMN' : '123 456'}
            autoComplete="one-time-code"
            inputMode={useRecovery ? 'text' : 'numeric'}
            className="[&_input]:font-mono [&_input]:tracking-[0.2em]"
          />
          <Button
            type="button"
            variant="link"
            onClick={toggleRecovery}
            className="h-auto min-w-0 self-start px-0 text-xs font-medium"
          >
            {useRecovery ? t('twoFactor.useApp') : t('twoFactor.useRecovery')}
          </Button>
        </div>

        <Button type="submit" size="lg" width="full" isLoading={mutation.isPending}>
          {t('twoFactor.submit')}
        </Button>
      </form>

      <Button variant="ghost" size="sm" onClick={onRestart} className="mt-6 -ml-2">
        <ArrowLeft size={16} aria-hidden />
        {t('twoFactor.back')}
      </Button>
    </>
  )
}
