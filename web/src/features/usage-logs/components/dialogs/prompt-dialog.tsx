import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PromptDialogProps {
  prompt: string
  promptEn?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptDialog({
  prompt,
  promptEn,
  open,
  onOpenChange,
}: PromptDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Prompt Details')}
      description={t('View the complete prompt and its English translation')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <ScrollArea className='max-h-[500px] pr-4'>
        <div className='space-y-4 py-4'>
          {/* Original Prompt */}
          <div className='space-y-2'>
            <Label className='text-sm font-semibold'>{t('Prompt')}</Label>
            <div className='bg-muted/50 relative rounded-md border p-3'>
              <CopyButton
                value={prompt}
                variant='ghost'
                size='sm'
                className='absolute top-2 right-2 h-8 w-8 p-0'
                iconClassName='size-4'
                tooltip={t('Copy to clipboard')}
              />
              <p className='pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                {prompt || '-'}
              </p>
            </div>
          </div>

          {/* English Prompt */}
          {promptEn && (
            <div className='space-y-2'>
              <Label className='text-sm font-semibold'>
                {t('Prompt (EN)')}
              </Label>
              <div className='bg-muted/50 relative rounded-md border p-3'>
                <CopyButton
                  value={promptEn}
                  variant='ghost'
                  size='sm'
                  className='absolute top-2 right-2 h-8 w-8 p-0'
                  iconClassName='size-4'
                  tooltip={t('Copy to clipboard')}
                />
                <p className='pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                  {promptEn}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Dialog>
  )
}
