import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FailReasonDialogProps {
  failReason: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FailReasonDialog({
  failReason,
  open,
  onOpenChange,
}: FailReasonDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Fail Reason Details')}
      description={t('View the complete error message and details')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <ScrollArea className='max-h-[500px] pr-4'>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label className='text-sm font-semibold'>
              {t('Error Message')}
            </Label>
            <div className='bg-muted/50 relative rounded-md border border-red-200 p-3'>
              <CopyButton
                value={failReason}
                variant='ghost'
                size='sm'
                className='absolute top-2 right-2 h-8 w-8 p-0'
                iconClassName='size-4'
                tooltip={t('Copy to clipboard')}
              />
              <p className='overflow-wrap-anywhere pr-10 text-sm leading-relaxed break-all whitespace-pre-wrap text-red-600'>
                {failReason || '-'}
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </Dialog>
  )
}
