import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'

import type { ReferenceImage } from '../../../types'
import { fileToDataUrl } from '../../image-utils'
import {
  GPT_IMAGE_MAX_INPUT_BYTES,
  validateGptImageEditLayer,
} from './edit-input'

interface GptImageEditLayerProps {
  kind: 'mask' | 'markup'
  image?: ReferenceImage
  reference?: ReferenceImage
  disabled: boolean
  onChange: (image?: ReferenceImage) => void
}

export function GptImageEditLayer(props: GptImageEditLayerProps) {
  const { t } = useTranslation()
  const label = props.kind === 'mask' ? t('Edit mask') : t('Edit markup')

  const upload = async (file: File) => {
    try {
      if (!props.reference) return
      if (file.type !== 'image/png' || file.size >= GPT_IMAGE_MAX_INPUT_BYTES) {
        throw new Error(
          t(
            'The edit layer must be a PNG with transparency and match the first reference image dimensions.'
          )
        )
      }
      const image = {
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl: await fileToDataUrl(file),
      }
      await validateGptImageEditLayer(image, props.reference, props.kind)
      props.onChange(image)
    } catch (error) {
      handleServerError(error)
    }
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={`gpt-image-${props.kind}`}>{label}</Label>
      <Input
        id={`gpt-image-${props.kind}`}
        type='file'
        accept='image/png'
        disabled={props.disabled || !props.reference}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void upload(file)
        }}
      />
      {props.image && (
        <div className='flex items-center gap-2'>
          <img
            src={props.image.dataUrl}
            alt={label}
            className='size-16 rounded border object-contain'
          />
          <span className='min-w-0 flex-1 truncate text-xs'>
            {props.image.name}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={props.disabled}
            onClick={() => props.onChange(undefined)}
          >
            {t('Remove')}
          </Button>
        </div>
      )}
      <p className='text-muted-foreground text-xs'>
        {props.kind === 'mask'
          ? t(
              'Transparent mask areas guide edits on the first reference image. Use matching PNG dimensions; the mask is guidance, not an exact boundary.'
            )
          : t(
              'Upload a transparent PNG annotation layer matching the first reference image. Markup and masks cannot be combined.'
            )}
      </p>
    </div>
  )
}
