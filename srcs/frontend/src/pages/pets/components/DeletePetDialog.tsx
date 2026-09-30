import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useTranslation } from 'react-i18next'

interface DeletePetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeletePetDialog({
  open,
  onOpenChange,
  petName,
  onConfirm,
  isDeleting,
}: DeletePetDialogProps) {
  const { t } = useTranslation('pets')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('detail.deleteConfirm.title', { name: petName })}</DialogTitle>
          <DialogDescription>{t('detail.deleteConfirm.message')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            {t('detail.deleteConfirm.cancel')}
          </Button>
          <Button onClick={onConfirm} isLoading={isDeleting}>
            {t('detail.deleteConfirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
