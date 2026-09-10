import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  MAX_NOTIFICATION_IMAGE_BYTES,
  MAX_NOTIFICATION_IMAGES,
  NOTIFICATION_IMAGE_TYPES,
} from '../lib/notification-form'

type NotificationImagePickerProps = {
  files: File[]
  onChange: (files: File[]) => void
  onError: (message: string) => void
}

function ImagePreview(props: { file: File; onRemove: () => void }) {
  const { t } = useTranslation()
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(props.file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [props.file])

  return (
    <div className='bg-muted/30 relative overflow-hidden rounded-lg border'>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={props.file.name}
          className='aspect-video w-full object-cover'
        />
      ) : null}
      <div className='truncate px-2 py-1.5 pr-9 text-xs'>{props.file.name}</div>
      <Button
        type='button'
        variant='secondary'
        size='icon-sm'
        className='absolute top-2 right-2'
        aria-label={t('Remove image')}
        onClick={props.onRemove}
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  )
}

export function NotificationImagePicker(props: NotificationImagePickerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const selectFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    const nextFiles = [...props.files]
    for (const file of selectedFiles) {
      if (!NOTIFICATION_IMAGE_TYPES.includes(file.type)) {
        props.onError(t('Only JPEG, PNG, GIF, and WebP images are supported.'))
        return
      }
      if (file.size <= 0 || file.size > MAX_NOTIFICATION_IMAGE_BYTES) {
        props.onError(t('Each image must be no larger than 5 MiB.'))
        return
      }
      if (nextFiles.length >= MAX_NOTIFICATION_IMAGES) {
        props.onError(t('You can attach up to 5 images.'))
        return
      }
      nextFiles.push(file)
    }
    props.onError('')
    props.onChange(nextFiles)
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <Button
          type='button'
          variant='outline'
          disabled={props.files.length >= MAX_NOTIFICATION_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden='true' />
          {t('Add images')}
        </Button>
        <p className='text-muted-foreground text-xs'>
          {t('Up to 5 images, 5 MiB each. Images are attached to email.')}
        </p>
        <label className='sr-only' htmlFor='company-notification-images'>
          {t('Notification images')}
        </label>
        <input
          ref={inputRef}
          id='company-notification-images'
          type='file'
          accept='image/jpeg,image/png,image/gif,image/webp'
          multiple
          className='sr-only'
          onChange={(event) => {
            selectFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      {props.files.length > 0 ? (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {props.files.map((file) => (
            <ImagePreview
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              onRemove={() =>
                props.onChange(
                  props.files.filter((candidate) => candidate !== file)
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
