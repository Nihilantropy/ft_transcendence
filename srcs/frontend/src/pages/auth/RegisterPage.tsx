import type { RegisterPayload } from '@/api/types'
import cattoImage from '@/assets/images/catto.jpg'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage } from '@/lib/utils'
import { AuthLayout } from '@/pages/auth/components/AuthLayout'
import { useRegisterMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()

  const schema = z
    .object({
      first_name: z.string().max(50).optional(),
      email: z.email(t('errors.invalidEmail')),
      password: z.string().min(8, t('errors.passwordTooShort')),
      password_confirm: z.string().min(1, t('errors.passwordRequired')),
    })
    .refine((data) => data.password === data.password_confirm, {
      message: t('errors.passwordMismatch'),
      path: ['password_confirm'],
    })

  const form = useForm<RegisterPayload>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', email: '', password: '', password_confirm: '' },
  })

  const registerMutation = useRegisterMutation()

  const onSubmit = (values: RegisterPayload) => {
    registerMutation.mutate(values, {
      onSuccess: () => {
        void navigate('/', { replace: true })
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, 'auth', t))
      },
    })
  }

  return (
    <AuthLayout
      image={cattoImage}
      imageAlt=""
      quote={t('register.quote')}
      quoteCaption={t('register.quoteCaption')}
    >
      {/* Title and Subtitle */}
      <h1 className="text-text-hi text-3xl font-bold tracking-tight">{t('register.title')}</h1>
      <p className="text-text-mid mt-2 text-sm whitespace-pre-line">{t('register.subtitle')}</p>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="mt-8 flex flex-col gap-5"
      >
        {/* First name (optional) */}
        <FormTextInput
          form={form}
          name="first_name"
          label={t('register.firstName')}
          placeholder={t('register.firstNamePlaceholder')}
          autoComplete="given-name"
        />

        {/* Email */}
        <FormTextInput
          form={form}
          name="email"
          label={t('register.email')}
          type="email"
          autoComplete="email"
        />

        {/* Password */}
        <FormPasswordInput
          form={form}
          name="password"
          label={t('register.password')}
          autoComplete="new-password"
          showLabel={t('login.showPassword')}
          hideLabel={t('login.hidePassword')}
        />

        {/* Confirm Password */}
        <FormPasswordInput
          form={form}
          name="password_confirm"
          label={t('register.passwordConfirm')}
          autoComplete="new-password"
          showLabel={t('login.showPassword')}
          hideLabel={t('login.hidePassword')}
        />

        {/* Submit */}
        <Button type="submit" size="lg" width="full" isLoading={registerMutation.isPending}>
          {t('register.submit')}
        </Button>
      </form>

      {/* already registered CTA */}
      <p className="text-text-mid mt-6 text-center text-sm">
        {t('register.hasAccount')}{' '}
        <Link
          to="/login"
          className="text-accent hover:text-accent-hi underline-offset-4 hover:underline"
        >
          {t('register.loginLink')}
        </Link>
      </p>
    </AuthLayout>
  )
}
