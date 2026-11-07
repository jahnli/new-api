import { ImagePlus, Loader2, Wand2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { fileToDataUrl } from '../lib/image-utils'
import { getImageModelRuntimeLimits } from '../lib/model-params'
import { isGptImageModel } from '../lib/model-params/gpt-image/config'
import {
  GPT_IMAGE_INPUT_ACCEPT,
  GPT_IMAGE_MAX_INPUT_BYTES,
} from '../lib/model-params/gpt-image/edit-input'
import type { ReferenceImage, StudioMode } from '../types'
import { PromptPresets } from './prompt-presets'

type GeneratePanelProps = {
  model: string
  mode: StudioMode
  onModeChange: (mode: StudioMode) => void
  prompt: string
  onPromptChange: (prompt: string) => void
  referenceImages: ReferenceImage[]
  onReferenceImagesChange: (images: ReferenceImage[]) => void
  isGenerating: boolean
  estimateMs: number
  onGenerate: () => void
  onStop: () => void
  onReset: () => void
  canGenerate: boolean
  canReset: boolean
}

export function GeneratePanel(props: GeneratePanelProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (!props.isGenerating) {
      setElapsedMs(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 100)
    return () => window.clearInterval(timer)
  }, [props.isGenerating])

  const runtimeLimits = getImageModelRuntimeLimits(props.model)
  const isGptImage = isGptImageModel(props.model)
  const maxReferenceImages = runtimeLimits?.maxReferenceImages ?? 0

  const addFiles = useCallback(
    async (files: File[]) => {
      if (props.isGenerating) return
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      if (
        isGptImage &&
        imageFiles.some(
          (file) =>
            !GPT_IMAGE_INPUT_ACCEPT.split(',').includes(file.type) ||
            file.size >= GPT_IMAGE_MAX_INPUT_BYTES
        )
      ) {
        toast.error(
          t(
            'Reference images must be PNG, JPEG, or WebP files smaller than 50 MB.'
          )
        )
        return
      }
      const remaining = maxReferenceImages - props.referenceImages.length
      if (remaining <= 0) {
        toast.error(
          t('At most {{count}} reference images', {
            count: maxReferenceImages,
          })
        )
        return
      }
      const acceptedFiles = imageFiles.slice(0, remaining)
      const loadedImages = await Promise.all(
        acceptedFiles.map(async (file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: await fileToDataUrl(file),
          name: file.name,
        }))
      )
      props.onReferenceImagesChange([...props.referenceImages, ...loadedImages])
    },
    [isGptImage, maxReferenceImages, props, t]
  )

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    if (props.mode !== 'edit') return
    void addFiles([...event.dataTransfer.files]).catch(handleServerError)
  }

  const handlePaste = (event: ClipboardEvent) => {
    if (props.mode !== 'edit') return
    const files = [...event.clipboardData.files]
    if (files.length > 0) {
      event.preventDefault()
      void addFiles(files).catch(handleServerError)
    }
  }

  const progressValue = props.isGenerating
    ? Math.min((elapsedMs / Math.max(props.estimateMs, 1000)) * 100, 95)
    : 0

  return (
    <div
      className='flex flex-col gap-3'
      onDragOver={(event) => {
        if (props.mode === 'edit') {
          event.preventDefault()
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Tabs
          value={props.mode}
          onValueChange={(value) => props.onModeChange(value as StudioMode)}
        >
          <TabsList>
            <TabsTrigger value='generate' disabled={props.isGenerating}>
              {t('Text to image')}
            </TabsTrigger>
            <TabsTrigger value='edit' disabled={props.isGenerating}>
              {t('Image to image')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <PromptPresets
          onSelect={props.onPromptChange}
          disabled={props.isGenerating}
        />
      </div>

      {props.mode === 'edit' && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 transition-colors',
            isDragOver && 'border-primary bg-primary/5'
          )}
        >
          {props.referenceImages.map((image) => (
            <div key={image.id} className='group relative'>
              <img
                src={image.dataUrl}
                alt={image.name}
                className='size-16 rounded-md object-cover'
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                disabled={props.isGenerating}
                onClick={() =>
                  props.onReferenceImagesChange(
                    props.referenceImages.filter((item) => item.id !== image.id)
                  )
                }
                className='bg-background/80 absolute -top-1.5 -right-1.5 size-5 rounded-full p-0.5'
                aria-label={t('Remove reference image')}
              >
                <X className='size-3' />
              </Button>
            </div>
          ))}
          {props.referenceImages.length < maxReferenceImages && (
            <Button
              type='button'
              variant='outline'
              onClick={() => fileInputRef.current?.click()}
              disabled={props.isGenerating}
              className='text-muted-foreground hover:border-primary hover:text-primary flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[10px] transition-colors'
            >
              <ImagePlus className='size-4' />
              {t('Upload')}
            </Button>
          )}
          <p className='text-muted-foreground ml-1 text-[11px]'>
            {t('Click, drag or paste images here')}
          </p>
          <input
            ref={fileInputRef}
            type='file'
            accept={isGptImage ? GPT_IMAGE_INPUT_ACCEPT : 'image/*'}
            multiple
            hidden
            onChange={(event) => {
              void addFiles([...(event.target.files ?? [])]).catch(
                handleServerError
              )
              event.target.value = ''
            }}
          />
        </div>
      )}

      {isGptImage && props.mode === 'edit' && (
        <p className='text-muted-foreground text-xs'>
          {t(
            'Up to 16 reference images. PNG, JPEG, or WebP; each file must be smaller than 50 MB.'
          )}
        </p>
      )}

      <div className='relative'>
        <Textarea
          maxLength={isGptImage ? 32000 : undefined}
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key === 'Enter' &&
              props.canGenerate
            ) {
              event.preventDefault()
              props.onGenerate()
            }
          }}
          placeholder={t('Describe the image you want to generate...')}
          className='min-h-28 resize-y pr-14'
          disabled={props.isGenerating}
        />
        <span className='text-muted-foreground absolute right-2 bottom-2 text-[10px] tabular-nums'>
          {props.prompt.length}
        </span>
      </div>

      {props.isGenerating && (
        <div className='flex flex-col gap-1.5'>
          <Progress value={progressValue} />
          <p className='text-muted-foreground text-xs tabular-nums'>
            {t('Waited {{elapsed}}s', {
              elapsed: Math.floor(elapsedMs / 1000),
            })}
          </p>
        </div>
      )}

      <div className='flex items-center justify-end gap-2'>
        {props.isGenerating ? (
          <Button
            type='button'
            variant='outline'
            className='border-destructive/25 text-destructive hover:bg-destructive/10 gap-1.5'
            onClick={props.onStop}
          >
            <Loader2 className='size-3.5 animate-spin' />
            {t('Stop')}
          </Button>
        ) : (
          <Button
            type='button'
            className='gap-1.5'
            onClick={props.onGenerate}
            disabled={!props.canGenerate}
          >
            <Wand2 className='size-4' />
            {t('Generate')}
          </Button>
        )}
        {props.canReset && !props.isGenerating && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={props.onReset}
          >
            {t('Reset')}
          </Button>
        )}
      </div>
    </div>
  )
}
