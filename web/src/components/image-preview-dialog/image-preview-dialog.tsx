import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  RefreshCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export type ImagePreviewItem = {
  id: string
  src: string
  alt: string
  description?: string
  onCopy: () => void | Promise<void>
  onDownload: () => void | Promise<void>
  onEdit?: () => void
}

type ImagePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: ImagePreviewItem[]
  initialIndex: number
}

const minimumZoom = 0.5
const maximumZoom = 3

export function ImagePreviewDialog(props: ImagePreviewDialogProps) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(props.initialIndex)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (!props.open) return

    setCurrentIndex(props.initialIndex)
    setZoom(1)
    setRotation(0)
  }, [props.initialIndex, props.open])

  if (props.images.length === 0) return null

  const safeCurrentIndex = Math.min(
    Math.max(currentIndex, 0),
    props.images.length - 1
  )
  const currentImage = props.images[safeCurrentIndex]

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const changeImage = (nextIndex: number) => {
    if (props.images.length < 2) return

    const wrappedIndex =
      ((nextIndex % props.images.length) + props.images.length) %
      props.images.length
    setCurrentIndex(wrappedIndex)
    resetView()
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    setZoom((currentZoom) => {
      const zoomDelta = event.deltaY < 0 ? 0.1 : -0.1
      return Math.min(
        Math.max(currentZoom + zoomDelta, minimumZoom),
        maximumZoom
      )
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.images.length < 2) return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      changeImage(safeCurrentIndex - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      changeImage(safeCurrentIndex + 1)
    }
  }

  const handleEdit = () => {
    currentImage.onEdit?.()
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className='[&_[data-slot=dialog-close]]:bg-foreground/45 [&_[data-slot=dialog-close]]:text-background [&_[data-slot=dialog-close]]:hover:bg-foreground/60 bg-transparent p-0 shadow-none ring-0 sm:max-w-none [&_[data-slot=dialog-close]]:backdrop-blur-md'
        overlayClassName='bg-black/30 supports-backdrop-filter:backdrop-blur-[1.5px]'
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className='sr-only'>{t('Image preview')}</DialogTitle>
        <div
          className='relative flex h-screen w-screen min-w-0 flex-col items-center px-[4vw] py-[4vh]'
          onClick={() => props.onOpenChange(false)}
        >
          <div
            className='flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden'
            onWheel={handleWheel}
          >
            <img
              src={currentImage.src}
              alt={currentImage.alt}
              className='max-h-full max-w-full rounded-lg object-contain transition-transform duration-150'
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
          <div
            className='pointer-events-none flex w-full shrink-0 flex-col items-center gap-5 pt-5'
            onClick={(event) => event.stopPropagation()}
          >
            {currentImage.description && (
              <p className='bg-background/90 text-foreground pointer-events-auto mx-auto max-h-20 w-[min(92vw,960px)] overflow-auto rounded-lg border px-3 py-2 text-center text-xs leading-relaxed shadow-sm backdrop-blur-md'>
                {currentImage.description}
              </p>
            )}
            <div className='bg-background/95 pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border p-1.5 shadow-sm backdrop-blur-sm'>
              {props.images.length > 1 && (
                <>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => changeImage(safeCurrentIndex - 1)}
                    aria-label={t('Previous image')}
                  >
                    <ChevronLeft className='size-3.5' aria-hidden='true' />
                  </Button>
                  <span className='text-muted-foreground min-w-12 text-center text-xs tabular-nums'>
                    {safeCurrentIndex + 1} / {props.images.length}
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => changeImage(safeCurrentIndex + 1)}
                    aria-label={t('Next image')}
                  >
                    <ChevronRight className='size-3.5' aria-hidden='true' />
                  </Button>
                </>
              )}
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() =>
                  setZoom((currentZoom) =>
                    Math.max(currentZoom - 0.25, minimumZoom)
                  )
                }
                disabled={zoom <= minimumZoom}
                aria-label={t('Zoom out')}
              >
                <ZoomOut className='size-3.5' aria-hidden='true' />
              </Button>
              <span className='text-muted-foreground min-w-12 text-center text-xs tabular-nums'>
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() =>
                  setZoom((currentZoom) =>
                    Math.min(currentZoom + 0.25, maximumZoom)
                  )
                }
                disabled={zoom >= maximumZoom}
                aria-label={t('Zoom in')}
              >
                <ZoomIn className='size-3.5' aria-hidden='true' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() =>
                  setRotation((currentRotation) => (currentRotation + 90) % 360)
                }
                aria-label={t('Rotate')}
              >
                <RotateCcw className='size-3.5' aria-hidden='true' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={resetView}
                aria-label={t('Reset view')}
              >
                <RefreshCw className='size-3.5' aria-hidden='true' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() => void currentImage.onCopy()}
                aria-label={t('Copy image')}
              >
                <Copy className='size-3.5' aria-hidden='true' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() => void currentImage.onDownload()}
                aria-label={t('Download')}
              >
                <Download className='size-3.5' aria-hidden='true' />
              </Button>
              {currentImage.onEdit && (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  onClick={handleEdit}
                  aria-label={t('Edit this image')}
                >
                  <Pencil className='size-3.5' aria-hidden='true' />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
