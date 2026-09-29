import type { TwoFactorConfirmPayload, TwoFactorSetup } from '@/api/types'
import { FormPasswordInput } from '@/components/form/FormPasswordInput'
import { FormTextInput } from '@/components/form/FormTextInput'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Image } from '@/components/ui/Image'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { useFormErrors } from '@/hooks/useFormErrors'
import { groupSecret, qrDataUri, TOTP_PATTERN } from '@/lib/twoFactor'
import { useEnableTwoFactorMutation, useSetupTwoFactorMutation } from '@/queries/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

interface EnableTwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// turn 2FA on
export function EnableTwoFactorDialog({ open, onOpenChange }: EnableTwoFactorDialogProps) {
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)

  // the recovery codes step can't be dismissed until the user confirms saving them
  const handleOpenChange = (next: boolean) => {
    if (!next && recoveryCodes && !saved) return
    if (!next) {
      setRecoveryCodes(null)
      setSaved(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {recoveryCodes ? (
          <RecoveryCodesStep
            codes={recoveryCodes}
            saved={saved}
            onSavedChange={setSaved}
            onDone={() => {
              handleOpenChange(false)
            }}
          />
        ) : (
          open && <SetupStep onEnabled={setRecoveryCodes} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*                         step 1: scan + confirm code                        */
/* -------------------------------------------------------------------------- */

function SetupStep({ onEnabled }: { onEnabled: (codes: string[]) => void }) {
  const { t } = useTranslation(['profile', 'auth'])
  const setupMutation = useSetupTwoFactorMutation()
  const enableMutation = useEnableTwoFactorMutation()
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [qr, setQr] = useState<string | null>(null)

  // stage a fresh secret each time the dialog opens (a new call replaces the pending one)
  const { mutate: startSetup } = setupMutation
  useEffect(() => {
    startSetup(undefined, {
      onSuccess: (data) => {
        setSetup(data)
        void qrDataUri(data.otpauth_uri).then(setQr)
      },
      onError: () => {
        toast.error(t('twoFactor.setupError'))
      },
    })
  }, [startSetup, t])

  const schema = z.object({
    current_password: z.string().min(1, t('auth:errors.passwordRequired')),
    code: z.string().trim().regex(TOTP_PATTERN, t('auth:twoFactor.errors.codeFormat')),
  })

  const form = useForm<TwoFactorConfirmPayload>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', code: '' },
  })
  const onFormError = useFormErrors(form)

  const onSubmit = (values: TwoFactorConfirmPayload) => {
    enableMutation.mutate(
      { current_password: values.current_password, code: values.code.trim() },
      {
        onSuccess: onEnabled,
        onError: onFormError,
      },
    )
  }

  const copySecret = () => {
    if (!setup) return
    void navigator.clipboard.writeText(setup.secret).then(() => {
      toast.success(t('twoFactor.copied'))
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('twoFactor.enableTitle')}</DialogTitle>
        <DialogDescription>{t('twoFactor.scanDescription')}</DialogDescription>
      </DialogHeader>

      {/* QR + manual key */}
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        {qr ? (
          <Image
            src={qr}
            alt={t('twoFactor.qrAlt')}
            eager
            className="h-40 w-40 shrink-0 rounded-md bg-white p-1"
          />
        ) : (
          <Skeleton className="bg-base h-40 w-40 shrink-0 rounded-md" />
        )}
        <div className="flex min-w-0 flex-col gap-2 self-stretch sm:self-auto">
          <p className="text-text-lo text-xs font-medium tracking-[0.15em] uppercase">
            {t('twoFactor.manualKey')}
          </p>
          {setup ? (
            <code className="text-text-hi font-mono text-sm break-words">
              {groupSecret(setup.secret)}
            </code>
          ) : (
            <Skeleton className="bg-base h-5 w-full" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copySecret}
            disabled={!setup}
            className="-ml-3 self-start"
          >
            <Copy size={14} aria-hidden />
            {t('twoFactor.copyKey')}
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e)
        }}
        className="flex flex-col gap-5"
      >
        <FormTextInput
          form={form}
          name="code"
          id="enable-2fa-code"
          label={t('twoFactor.firstCode')}
          placeholder="123 456"
          autoComplete="one-time-code"
          inputMode="numeric"
        />
        <FormPasswordInput
          form={form}
          name="current_password"
          id="enable-2fa-password"
          label={t('fields.currentPassword')}
          autoComplete="current-password"
          showLabel={t('auth:login.showPassword')}
          hideLabel={t('auth:login.hidePassword')}
        />
        <DialogFooter>
          <Button type="submit" isLoading={enableMutation.isPending} disabled={!setup}>
            {t('twoFactor.enableSubmit')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                          step 2: recovery codes                            */
/* -------------------------------------------------------------------------- */

interface RecoveryCodesStepProps {
  codes: string[]
  saved: boolean
  onSavedChange: (saved: boolean) => void
  onDone: () => void
}

function RecoveryCodesStep({ codes, saved, onSavedChange, onDone }: RecoveryCodesStepProps) {
  const { t } = useTranslation('profile')
  const text = codes.join('\n')

  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(t('twoFactor.copied'))
    })
  }

  // plain .txt through a Blob: nothing leaves the browser
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'smartbreeds-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('twoFactor.codesTitle')}</DialogTitle>
        <DialogDescription>{t('twoFactor.codesDescription')}</DialogDescription>
      </DialogHeader>

      <ul className="bg-base border-border-soft grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border p-4">
        {codes.map((code) => (
          <li key={code} className="text-text-hi font-mono text-sm tracking-wider">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy size={14} aria-hidden />
          {t('twoFactor.copyCodes')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download size={14} aria-hidden />
          {t('twoFactor.downloadCodes')}
        </Button>
      </div>

      <Checkbox checked={saved} onCheckedChange={onSavedChange}>
        {t('twoFactor.codesSaved')}
      </Checkbox>

      <DialogFooter>
        <Button type="button" onClick={onDone} disabled={!saved}>
          {t('twoFactor.done')}
        </Button>
      </DialogFooter>
    </>
  )
}
