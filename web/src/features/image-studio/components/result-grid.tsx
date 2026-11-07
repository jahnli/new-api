import {
  Copy,
  Download,
  ImageIcon,
  ImageOff,
  PackageOpen,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ImagePreviewDialog } from '@/components/image-preview-dialog/image-preview-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getImageFailures } from '../lib/image-failures'
import {
  copyImageToClipboard,
  downloadImage,
  downloadImagesAsZip,
  imageFileName,
} from '../lib/image-utils'
import type {
  GeneratedImage,
  GenerationRecord,
  ImageGenerationError,
} from '../types'

type ResultGridProps = {
  record: GenerationRecord | null
  error: string | null
  onRetry: () => void
  onRetryImage: (errorIndex: number) => void
  retryingImageErrorIndexes: number[]
  onEditImage: (image: GeneratedImage) => void
  isGenerating: boolean
  pendingImageCount: number
  imageErrors: string[]
  imageFailures?: ImageGenerationError[]
  partialImage?: string | null
}

function UsageBar({ record }: { record: GenerationRecord }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const usage = record.usage
  const firstImage = record.images[0]
  const fileSize = formatImageFileSize(firstImage?.sizeBytes)
  const imageSize =
    firstImage?.width && firstImage.height
      ? `${firstImage.width}×${firstImage.height}`
      : t(record.size).replace('x', '×')
  return (
    <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
      <Badge variant='secondary'>{record.model}</Badge>
      <span>{t('{{count}} images', { count: record.images.length })}</span>
      {usage && (
        <span className='tabular-nums'>
          {t('Took {{seconds}}s', {
            seconds: (usage.durationMs / 1000).toFixed(1),
          })}
        </span>
      )}
      <span className='tabular-nums'>{imageSize}</span>
      {record.quality && (
        <span>
          {t('Quality')}: {t(record.quality)}
        </span>
      )}
      {record.background && <span>{t(record.background)}</span>}
      {fileSize && <span className='tabular-nums'>{fileSize}</span>}
      {record.imageUsage && (
        <>
          <span>
            {t('Input tokens')}:{' '}
            {formatNumber(record.imageUsage.input_tokens, locale)}
          </span>
          <span>
            {t('Output tokens')}:{' '}
            {formatNumber(record.imageUsage.output_tokens, locale)}
          </span>
          <span>
            {t('Total tokens')}:{' '}
            {formatNumber(record.imageUsage.total_tokens, locale)}
          </span>
        </>
      )}
      {record.svgUsage && (
        <span>
          SVG {t('Total tokens')}:{' '}
          {formatNumber(record.svgUsage.total_tokens, locale)}
        </span>
      )}
    </div>
  )
}

function formatImageFileSize(sizeBytes?: number): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

function LoadingImageSlot({
  slotIndex,
  preview,
}: {
  slotIndex: number
  preview?: string | null
}) {
  const { t } = useTranslation()
  if (preview) {
    return (
      <div
        className='relative overflow-hidden rounded-lg border'
        role='status'
        aria-label={t('Generating...')}
      >
        <img
          src={preview}
          alt={t('Partial image preview')}
          className='aspect-square w-full object-contain'
        />
        <span className='bg-background/80 absolute inset-x-0 bottom-0 p-2 text-center text-xs'>
          {t('Generating...')}
        </span>
      </div>
    )
  }
  return (
    <div
      className='bg-muted/30 text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border'
      role='status'
      aria-label={`${t('Loading')} ${slotIndex + 1}`}
    >
      <span className='animate-pulse'>{t('Generating...')}</span>
      <span className='flex h-5 items-end gap-1' aria-hidden='true'>
        <span className='bg-primary/40 h-2 w-1 animate-pulse rounded-full [animation-duration:450ms]' />
        <span className='bg-primary/60 h-4 w-1 animate-pulse rounded-full [animation-delay:50ms] [animation-duration:450ms]' />
        <span className='bg-primary/80 h-5 w-1 animate-pulse rounded-full [animation-delay:100ms] [animation-duration:450ms]' />
        <span className='bg-primary/60 h-3 w-1 animate-pulse rounded-full [animation-delay:150ms] [animation-duration:450ms]' />
        <span className='bg-primary/40 h-2 w-1 animate-pulse rounded-full [animation-delay:200ms] [animation-duration:450ms]' />
      </span>
    </div>
  )
}

type ImageErrorSlotProps = {
  message: string
  onRetry: () => void
  retryDisabled: boolean
}

function ImageErrorSlot(props: ImageErrorSlotProps) {
  const { t } = useTranslation()
  return (
    <div
      className='border-destructive/30 bg-destructive/5 text-destructive flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center'
      role='alert'
      aria-label={t('Image generation failed')}
    >
      <ImageOff className='size-8 shrink-0 opacity-70' aria-hidden='true' />
      <span className='text-sm font-medium'>
        {t('Image generation failed')}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <p className='line-clamp-4 max-w-full cursor-help text-xs break-all' />
          }
        >
          {props.message}
        </TooltipTrigger>
        <TooltipContent className='max-h-72 max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto text-left break-all whitespace-normal'>
          {props.message}
        </TooltipContent>
      </Tooltip>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='mt-2 gap-1.5'
        onClick={props.onRetry}
        disabled={props.retryDisabled}
      >
        <RefreshCw className='size-3.5' aria-hidden='true' />
        {t('Retry')}
      </Button>
    </div>
  )
}

export function ResultGrid({
  record,
  error,
  onRetry,
  onRetryImage,
  retryingImageErrorIndexes,
  onEditImage,
  isGenerating,
  pendingImageCount,
  imageErrors,
  imageFailures,
  partialImage,
}: ResultGridProps) {
  const { t } = useTranslation()
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(
    null
  )
  const currentFailures =
    imageFailures ??
    getImageFailures({
      id: 'pending-generation',
      imageErrors,
    })

  if (error) {
    return (
      <div className='border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-4'>
        <p className='text-destructive text-sm break-all'>{error}</p>
        <div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={onRetry}
            disabled={isGenerating}
          >
            <RefreshCw className='size-3.5' />
            {t('Retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (!record) {
    if (isGenerating || imageErrors.length > 0) {
      return (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {currentFailures.map((failure) => (
            <ImageErrorSlot
              key={failure.id}
              message={failure.message || t('Image generation failed')}
              onRetry={onRetry}
              retryDisabled={isGenerating}
            />
          ))}
          {Array.from({ length: pendingImageCount }, (_, index) => (
            <LoadingImageSlot
              key={`pending-image-${index}`}
              slotIndex={index}
              preview={index === 0 ? partialImage : null}
            />
          ))}
        </div>
      )
    }

    return (
      <Empty className='h-full min-h-[360px] border-none py-0'>
        <div className='from-primary/10 via-primary/5 to-background relative flex size-16 items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br shadow-sm'>
          <div className='bg-primary/20 absolute -top-6 -right-6 size-12 rounded-full blur-xl' />
          <ImageIcon className='text-primary/70 relative size-8' />
          <Sparkles className='text-primary/60 absolute top-3 right-3 size-3.5' />
        </div>
        <div className='text-muted-foreground flex flex-col items-center gap-2 text-sm'>
          <p className='text-foreground text-base font-medium'>
            {t('Enter a prompt to start generating images')}
          </p>
        </div>
      </Empty>
    )
  }

  const handleDownloadAll = async () => {
    const skipped = await downloadImagesAsZip(
      record.images,
      `images-${record.createdAt}`,
      record.outputFormat
    )
    if (skipped > 0) {
      toast.warning(
        t('{{count}} images could not be packed', { count: skipped })
      )
    }
  }

  const handleCopy = async (image: GeneratedImage) => {
    try {
      await copyImageToClipboard(image.src)
      toast.success(t('Image copied to clipboard'))
    } catch {
      toast.error(t('Copy failed, please download instead'))
    }
  }

  const visibleFailures = isGenerating
    ? currentFailures
    : getImageFailures(record)

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <UsageBar record={record} />
        {record.images.length > 1 && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={() => void handleDownloadAll()}
          >
            <PackageOpen className='size-3.5' />
            {t('Download all')}
          </Button>
        )}
      </div>

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
        {record.images.map((image, index) => (
          <div
            key={image.id}
            className='group bg-muted/30 relative overflow-hidden rounded-lg border'
          >
            <button
              type='button'
              className='block w-full'
              onClick={() => setPreviewImageIndex(index)}
            >
              <img
                src={image.src}
                alt={record.prompt.slice(0, 80)}
                loading='lazy'
                className='aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]'
              />
            </button>
            <div className='bg-background/25 absolute inset-x-0 bottom-0 hidden items-center justify-end gap-1 p-1.5 backdrop-blur-[1px] group-hover:flex'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7'
                onClick={() =>
                  void downloadImage(
                    image.src,
                    imageFileName(index, image.src, record.outputFormat)
                  )
                }
                aria-label={t('Download')}
              >
                <Download className='size-3.5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7'
                onClick={() => void handleCopy(image)}
                aria-label={t('Copy image')}
              >
                <Copy className='size-3.5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7'
                onClick={() => onEditImage(image)}
                aria-label={t('Edit this image')}
              >
                <Pencil className='size-3.5' />
              </Button>
            </div>
          </div>
        ))}
        {isGenerating &&
          Array.from({ length: pendingImageCount }, (_, index) => (
            <LoadingImageSlot
              key={`pending-image-${index}`}
              slotIndex={index}
              preview={index === 0 ? partialImage : null}
            />
          ))}
        {visibleFailures.map((failure) =>
          retryingImageErrorIndexes.includes(failure.retryIndex) ? (
            <LoadingImageSlot key={failure.id} slotIndex={failure.retryIndex} />
          ) : (
            <ImageErrorSlot
              key={failure.id}
              message={failure.message || t('Image generation failed')}
              onRetry={() => onRetryImage(failure.retryIndex)}
              retryDisabled={isGenerating}
            />
          )
        )}
      </div>

      <ImagePreviewDialog
        open={previewImageIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImageIndex(null)
        }}
        images={record.images.map((image, index) => ({
          id: image.id,
          src: image.src,
          alt: record.prompt.slice(0, 80),
          description: image.revisedPrompt,
          onCopy: () => handleCopy(image),
          onDownload: () =>
            downloadImage(
              image.src,
              imageFileName(index, image.src, record.outputFormat)
            ),
          onEdit: () => onEditImage(image),
        }))}
        initialIndex={previewImageIndex ?? 0}
      />
    </div>
  )
}
