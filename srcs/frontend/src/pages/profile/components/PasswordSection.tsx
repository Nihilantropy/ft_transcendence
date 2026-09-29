import type { ChangePasswordPayload, User } from '@/api/types'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useFormErrors } from '@/hooks/useFormErrors'
import { TOTP_OR_RECOVERY } from '@/lib/twoFactor'
import { ProfileSectionLayout } from '@/pages/profile/components/ProfileSectionLayout'
import { useChangePasswordMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

export function PasswordSection({ user }: { user: User }) {
  const { t } = useTranslation(['profile', 'auth'])
  const mutation = useChangePasswordMutation()
  const hasPassword = user.has_password !== false
  const twoFactorOn = Boolean(user.two_factor_enabled)

  const schema = z
    .object({
      current_password: z.string().optional(),
      new_password: z
        .string()
        .min(8, t('auth:errors.passwordTooShort'))
        .max(128, t('errors.passwordTooLong')),
      new_password_confirm: z.string().min(1, t('auth:errors.passwordRequired')),
      code: z.string().trim().optional(),
    })
    .superRefine((v, ctx) => {
      if (hasPassword && !v.current_password) {
        ctx.addIssue({
          code: 'custom',
          path: ['current_password'],
          message: t('auth:errors.passwordRequired'),
        })
      }
      if (v.new_password !== v.new_password_confirm) {
        ctx.addIssue({
          code: 'custom',
          path: ['new_password_confirm'],
          message: t('errors.passwordMismatch'),
        })
      }
      if (twoFactorOn && !TOTP_OR_RECOVERY.test(v.code ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['code'], message: t('errors.codeFormat') })
      }
    })

  const form = useForm<ChangePasswordPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: hasPassword ? '' : undefined,
      new_password: '',
      new_password_confirm: '',
      code: twoFactorOn ? '' : undefined,
    },
  })
  const onFormError = useFormErrors(form)

  const onSubmit = (payload: ChangePasswordPayload) => {
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(hasPassword ? t('password.changed') : t('password.set'))
        form.reset()
      },
      onError: onFormError,
    })
  }

  const passwordToggles = {
    showLabel: t('auth:login.showPassword'),
    hideLabel: t('auth:login.hidePassword'),
  }

  return (
    <ProfileSectionLayout
      title={hasPassword ? t('password.title') : t('password.setTitle')}
      description={hasPassword ? t('password.description') : t('password.setDescription')}
    >
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="flex flex-col gap-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {hasPassword && (
            <FormPasswordInput
              form={form}
              name="current_password"
              id="password-current"
              label={t('fields.currentPassword')}
              autoComplete="current-password"
              {...passwordToggles}
            />
          )}
          <FormPasswordInput
            form={form}
            name="new_password"
            id="password-new"
            label={t('password.new')}
            autoComplete="new-password"
            className="sm:col-start-1"
            {...passwordToggles}
          />
          <FormPasswordInput
            form={form}
            name="new_password_confirm"
            id="password-confirm"
            label={t('password.confirm')}
            autoComplete="new-password"
            {...passwordToggles}
          />
          {twoFactorOn && (
            <FormTextInput
              form={form}
              name="code"
              id="password-code"
              label={t('fields.code')}
              hint={t('fields.codeHint')}
              placeholder="123 456"
              autoComplete="one-time-code"
              inputMode="numeric"
              className="sm:col-start-1"
            />
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button type="submit" isLoading={mutation.isPending}>
            {hasPassword ? t('password.submit') : t('password.setSubmit')}
          </Button>
        </div>
      </form>
    </ProfileSectionLayout>
  )
}
