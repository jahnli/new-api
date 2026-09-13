import { Copy, Download, PackageOpen, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  downloadImage,
  downloadImagesAsZip,
  imageFileName,
} from '@/features/image-studio/lib/image-utils'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { ModelBadge } from '@/features/usage-logs/components/model-badge'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'

import type { ImageAuditItem } from '../types'
import { imageAuditModeLabelKey } from './image-audit-columns'

interface ImageAuditDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ImageAuditItem | null
  onPreview: (item: ImageAuditItem, index: number) => void
}

function DetailField(props: { label: string; children: ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <span className='text-muted-foreground text-sm'>{props.label}</span>
      <span className='min-w-0 text-base break-all'>{props.children}</span>
    </div>
  )
}

/** Full generation record: user, every stored field, prompt and image grid. */
export function ImageAuditDetailDialog(props: ImageAuditDetailDialogProps) {
  const { t } = useTranslation()

  if (!props.item) return null
  const item = props.item

  const images = item.images ?? []

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(item.prompt)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  const handleDownloadAll = async () => {
    const skipped = await downloadImagesAsZip(
      images.map((image) => ({ id: image.id, src: image.url })),
      `images-${item.id}`,
      item.output_format
    )
    if (skipped > 0) {
      toast.warning(
        t('{{count}} images could not be packed', { count: skipped })
      )
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <span className='flex items-center gap-2'>
          {t('Generation Details')}
          {item.favorite && (
            <Star
              className='size-4 fill-amber-400 text-amber-400'
              aria-label={t('Favorite')}
            />
          )}
        </span>
      }
      contentClassName='h-[75vh] sm:max-w-[78rem]'
      contentHeight='100%'
      bodyContainerClassName='flex-1 max-h-none overflow-hidden'
      bodyClassName='h-full min-h-0'
    >
      <div className='flex h-full min-h-0 flex-col space-y-4'>
        <div className='flex shrink-0 items-center gap-3 border-b pb-3'>
          <LogUserIdentity
            size='lg'
            userId={item.user_id}
            username={item.username}
            displayName={item.display_name}
            avatarUrl={item.avatar_url || undefined}
          />
          <span className='text-muted-foreground ml-auto shrink-0 text-sm tabular-nums'>
            {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        </div>

        <div className='min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'>
          <div className='grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 sm:grid-cols-3'>
            <DetailField label={t('Model')}>
              <ModelBadge modelName={item.model} className='font-normal' />
            </DetailField>
            <DetailField label={t('Mode')}>
              <Badge variant='secondary' className='font-normal'>
                {t(imageAuditModeLabelKey(item.mode))}
              </Badge>
            </DetailField>
            {item.group && (
              <DetailField label={t('Group')}>{item.group}</DetailField>
            )}
            {item.size && (
              <DetailField label={t('Size')}>{item.size}</DetailField>
            )}
            {item.quality && (
              <DetailField label={t('Quality')}>{item.quality}</DetailField>
            )}
            {item.moderation && (
              <DetailField label={t('Moderation')}>
                {item.moderation}
              </DetailField>
            )}
            {item.output_format && (
              <DetailField label={t('Output Format')}>
                {item.output_format}
              </DetailField>
            )}
            <DetailField label={t('Image count')}>
              <span className='tabular-nums'>
                {images.length} / {item.n}
              </span>
            </DetailField>
            <DetailField label={t('Duration')}>
              <span className='tabular-nums'>
                {(item.duration_ms / 1000).toFixed(1)}s
              </span>
            </DetailField>
            <DetailField label={t('Cost')}>
              <span className='tabular-nums'>
                {formatQuotaWithCurrency(item.quota ?? 0, {
                  digitsLarge: 2,
                  digitsSmall: 2,
                  abbreviate: false,
                })}
              </span>
            </DetailField>
            <DetailField label={t('Tokens')}>
              <span className='tabular-nums'>
                {(item.prompt_tokens ?? 0).toLocaleString()} /{' '}
                {(item.completion_tokens ?? 0).toLocaleString()}
              </span>
            </DetailField>
          </div>

          <div className='my-2 space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-base font-medium'>
                {t('Prompt')}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 gap-1.5 px-2 text-sm'
                onClick={() => void handleCopyPrompt()}
              >
                <Copy className='size-3' />
                {t('Copy prompt')}
              </Button>
            </div>
            <p className='bg-muted/40 max-h-40 overflow-y-auto rounded-lg border p-2.5 text-sm leading-relaxed break-all whitespace-pre-wrap'>
              {item.prompt || '-'}
            </p>
          </div>

          {images.length > 0 && (
            <div className='space-y-1.5'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground flex items-center gap-1.5 text-base font-medium'>
                  {t('Images')}
                  <Badge className='h-4 min-w-4 justify-center rounded-full px-0.5 text-sm leading-none tabular-nums'>
                    {images.length}
                  </Badge>
                </span>
                {images.length > 1 && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-6 gap-1 px-1.5 text-xs'
                    onClick={() => void handleDownloadAll()}
                  >
                    <PackageOpen className='size-3' />
                    {t('Download all')}
                  </Button>
                )}
              </div>
              <div className='mt-3 grid grid-cols-[repeat(auto-fill,minmax(8rem,10rem))] gap-2'>
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className='group bg-muted/30 relative overflow-hidden rounded-lg border'
                  >
                    <button
                      type='button'
                      className='block w-full'
                      onClick={() => props.onPreview(item, index)}
                      aria-label={t('Image preview')}
                    >
                      <img
                        src={image.url}
                        alt={image.revised_prompt?.slice(0, 80) || ''}
                        loading='lazy'
                        className='aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]'
                      />
                    </button>
                    {image.width && image.height ? (
                      <span className='bg-foreground/50 text-background absolute top-1 left-1 rounded px-1 py-0.5 text-[10px] tabular-nums backdrop-blur-sm'>
                        {image.width}×{image.height}
                      </span>
                    ) : null}
                    <div className='bg-background/25 absolute inset-x-0 bottom-0 hidden items-center justify-end gap-1 p-1.5 backdrop-blur-[1px] group-hover:flex'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='size-7'
                        onClick={() =>
                          void downloadImage(
                            image.url,
                            imageFileName(index, image.url, item.output_format)
                          )
                        }
                        aria-label={t('Download')}
                      >
                        <Download className='size-3.5' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
