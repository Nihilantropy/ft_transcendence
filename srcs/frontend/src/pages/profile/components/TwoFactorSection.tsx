import type { TwoFactorConfirmPayload, User } from '@/api/types'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { toast } from '@/components/ui/Toast'
import { useFormErrors } from '@/hooks/useFormErrors'
import { TOTP_OR_RECOVERY } from '@/lib/twoFactor'
import { cn } from '@/lib/utils'
import { EnableTwoFactorDialog } from '@/pages/profile/components/EnableTwoFactorDialog'
import { ProfileSectionLayout } from '@/pages/profile/components/ProfileSectionLayout'
import { useDisableTwoFactorMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

// status as an on/off segmented control: picking the other side opens the matching dialog
export function TwoFactorSection({ user }: { user: User }) {
  const { t } = useTranslation('profile')
  const isOn = Boolean(user.two_factor_enabled)
  const hasPassword = user.has_password !== false
  const [enableOpen, setEnableOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  return (
    <>
      <ProfileSectionLayout
        title={t('twoFactor.title')}
        description={t('twoFactor.description')}
        aside={
          <div
            role="group"
            aria-label={t('twoFactor.title')}
            className="border-border-soft bg-elevated inline-flex shrink-0 self-start rounded-md border p-1"
          >
            <Segment
              label={t('twoFactor.on')}
              icon={<ShieldCheck size={14} aria-hidden />}
              isSelected={isOn}
              disabled={!isOn && !hasPassword}
              onSelect={() => {
                setEnableOpen(true)
              }}
            />
            <Segment
              label={t('twoFactor.off')}
              icon={<ShieldOff size={14} aria-hidden />}
              isSelected={!isOn}
              onSelect={() => {
                setDisableOpen(true)
              }}
            />
          </div>
        }
      >
        {!isOn && !hasPassword && (
          <p className="text-text-lo text-xs">{t('twoFactor.needsPassword')}</p>
        )}
      </ProfileSectionLayout>

      <EnableTwoFactorDialog open={enableOpen} onOpenChange={setEnableOpen} />
      <DisableTwoFactorDialog open={disableOpen} onOpenChange={setDisableOpen} />
    </>
  )
}

interface SegmentProps {
  label: string
  icon: ReactNode
  isSelected: boolean
  disabled?: boolean
  onSelect: () => void
}

// one half of the on/off control
function Segment({ label, icon, isSelected, disabled, onSelect }: SegmentProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={isSelected ? undefined : onSelect}
      className={cn(
        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors',
        'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isSelected ? 'bg-accent/16 text-accent cursor-default' : 'text-text-mid hover:text-text-hi',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

interface DisableTwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// turning 2FA off: current password + a code from the app or a recovery code
function DisableTwoFactorDialog({ open, onOpenChange }: DisableTwoFactorDialogProps) {
  const { t } = useTranslation(['profile', 'auth'])
  const mutation = useDisableTwoFactorMutation()

  const schema = z.object({
    current_password: z.string().min(1, t('auth:errors.passwordRequired')),
    code: z.string().trim().regex(TOTP_OR_RECOVERY, t('errors.codeFormat')),
  })

  const form = useForm<TwoFactorConfirmPayload>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', code: '' },
  })
  const onFormError = useFormErrors(form)

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset()
    onOpenChange(next)
  }

  const onSubmit = (values: TwoFactorConfirmPayload) => {
    mutation.mutate(
      { current_password: values.current_password, code: values.code.trim() },
      {
        onSuccess: () => {
          toast.success(t('twoFactor.disabled'))
          handleOpenChange(false)
        },
        onError: onFormError,
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('twoFactor.disableTitle')}</DialogTitle>
          <DialogDescription>{t('twoFactor.disableDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void form.handleSubmit(onSubmit)(e)
          }}
          className="flex flex-col gap-5"
        >
          <FormTextInput
            form={form}
            name="code"
            id="disable-2fa-code"
            label={t('fields.code')}
            hint={t('fields.codeHint')}
            placeholder="123 456"
            autoComplete="one-time-code"
          />
          <FormPasswordInput
            form={form}
            name="current_password"
            id="disable-2fa-password"
            label={t('fields.currentPassword')}
            autoComplete="current-password"
            showLabel={t('auth:login.showPassword')}
            hideLabel={t('auth:login.hidePassword')}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                handleOpenChange(false)
              }}
              disabled={mutation.isPending}
            >
              {t('twoFactor.cancel')}
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {t('twoFactor.disableSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
