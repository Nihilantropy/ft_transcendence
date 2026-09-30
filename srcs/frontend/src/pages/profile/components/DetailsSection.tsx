import type { UpdateProfilePayload, User } from '@/api/types'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useFormErrors } from '@/hooks/useFormErrors'
import { TOTP_OR_RECOVERY } from '@/lib/twoFactor'
import { ProfileSectionLayout } from '@/pages/profile/components/ProfileSectionLayout'
import { useUpdateProfileMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

type DetailsValues = {
  first_name: string
  last_name: string
  email: string
  current_password: string
  code: string
}

// first name, last name, email. Changing the email is a credential change: the current password (and a 2FA code when 2FA is on) appear only then
export function DetailsSection({ user }: { user: User }) {
  const { t } = useTranslation(['profile', 'auth'])
  const mutation = useUpdateProfileMutation()
  const twoFactorOn = Boolean(user.two_factor_enabled)
  // an account created through 42 has no password to confirm an email change with
  const canChangeEmail = user.has_password !== false

  const initial: DetailsValues = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    email: user.email,
    current_password: '',
    code: '',
  }

  const schema = z
    .object({
      first_name: z.string().trim().max(150, t('errors.tooLong')),
      last_name: z.string().trim().max(150, t('errors.tooLong')),
      email: z.email(t('errors.invalidEmail')),
      current_password: z.string(),
      code: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      if (v.email.toLowerCase() === user.email.toLowerCase()) return
      if (!v.current_password) {
        ctx.addIssue({
          code: 'custom',
          path: ['current_password'],
          message: t('errors.passwordRequired'),
        })
      }
      if (twoFactorOn && !TOTP_OR_RECOVERY.test(v.code)) {
        ctx.addIssue({ code: 'custom', path: ['code'], message: t('errors.codeFormat') })
      }
    })

  const form = useForm<DetailsValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })
  const onFormError = useFormErrors(form)

  const email = useWatch({ control: form.control, name: 'email' })
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()

  const onSubmit = (values: DetailsValues) => {
    const payload: UpdateProfilePayload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
    }
    if (emailChanged) {
      payload.email = values.email.trim()
      payload.current_password = values.current_password
      if (twoFactorOn) payload.code = values.code.trim()
    }
    mutation.mutate(payload, {
      onSuccess: (updated) => {
        toast.success(t('details.saved'))
        form.reset({
          first_name: updated.first_name ?? '',
          last_name: updated.last_name ?? '',
          email: updated.email,
          current_password: '',
          code: '',
        })
      },
      onError: onFormError,
    })
  }

  return (
    <ProfileSectionLayout title={t('details.title')} description={t('details.description')}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="flex flex-col gap-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormTextInput
            form={form}
            name="first_name"
            id="details-first-name"
            label={t('details.firstName')}
            autoComplete="given-name"
          />
          <FormTextInput
            form={form}
            name="last_name"
            id="details-last-name"
            label={t('details.lastName')}
            autoComplete="family-name"
          />

          <FormTextInput
            form={form}
            name="email"
            id="details-email"
            label={t('details.email')}
            type="email"
            autoComplete="email"
            disabled={!canChangeEmail}
            hint={canChangeEmail ? undefined : t('details.emailNeedsPassword')}
          />

          {emailChanged && (
            <FormPasswordInput
              form={form}
              name="current_password"
              id="details-current-password"
              label={t('details.password')}
              hint={t('details.emailConfirmHint')}
              autoComplete="current-password"
              className={twoFactorOn ? 'sm:col-start-1' : undefined}
              showLabel={t('auth:login.showPassword')}
              hideLabel={t('auth:login.hidePassword')}
            />
          )}
          {emailChanged && twoFactorOn && (
            <FormTextInput
              form={form}
              name="code"
              id="details-code"
              label={t('fields.code')}
              placeholder="123 456"
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button type="submit" isLoading={mutation.isPending} disabled={!form.formState.isDirty}>
            {t('details.submit')}
          </Button>
        </div>
      </form>
    </ProfileSectionLayout>
  )
}
