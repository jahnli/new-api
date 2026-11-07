import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { CUSTOM_SIZE } from '../../../constants'
import type { StudioMode } from '../../../types'
import {
  getGptImageCapabilities,
  GPT_IMAGE_PARAMETERS,
  GPT_IMAGE_SIZE_LABELS,
} from './config'
import type { GptImageConfig, GptImageConfigUpdater } from './types'

interface GptImageParamsProps {
  config: GptImageConfig
  updateConfig: GptImageConfigUpdater
  disabled: boolean
  model?: string
  mode?: StudioMode
}

function GptImageSizeLabel(props: { size: string }) {
  const { t } = useTranslation()
  const label = GPT_IMAGE_SIZE_LABELS[props.size]
  if (!label) {
    return props.size === CUSTOM_SIZE ? t('Custom size') : t(props.size)
  }
  const [tier, dimensions, ratio] = label.split(' · ')
  return (
    <span className='inline-grid grid-cols-[3.5ch_max-content_max-content_max-content_4ch] items-center gap-x-1 text-left tabular-nums'>
      <span className='text-right'>{tier}</span>
      <span aria-hidden='true'>·</span>
      <span>{dimensions}</span>
      <span aria-hidden='true'>·</span>
      <span>{ratio}</span>
    </span>
  )
}

export function GptImageParams(props: GptImageParamsProps) {
  const { t } = useTranslation()
  const id = useId()
  const model = props.model ?? 'gpt-image-2'
  const mode = props.mode ?? 'generate'
  const capabilities = getGptImageCapabilities(model)
  if (!capabilities) return null
  const config = GPT_IMAGE_PARAMETERS.normalizeParameters(
    props.config,
    model,
    mode
  )
  const isGif = config.outputFormat === 'gif'
  const isSvg = config.outputFormat === 'svg'
  const maxImages = isSvg ? 1 : capabilities.runtimeLimits.maxImages
  const supportsCustomSize = capabilities.supportsCustomSize || isGif
  const supportsTransparency =
    config.outputFormat === 'png' || config.outputFormat === 'webp'
  const supportsCompression =
    config.outputFormat === 'jpeg' || config.outputFormat === 'webp'
  const clampImageCount = (imageCount: number) =>
    Math.min(maxImages, Math.max(1, Math.trunc(imageCount) || 1))
  const optionLabels: Record<string, string> = {
    auto: t('auto'),
    low: t('low'),
    medium: t('medium'),
    high: t('high'),
    xhigh: t('xhigh'),
    max: t('max'),
    opaque: t('opaque'),
    transparent: t('transparent'),
  }

  const renderSelect = (
    field: string,
    label: string,
    value: string,
    options: readonly string[],
    onChange: (nextValue: string) => void,
    translateOptions = false
  ) => (
    <div className='flex flex-col gap-1.5'>
      <Label
        htmlFor={`${id}-${field}`}
        className='text-muted-foreground text-xs font-medium'
      >
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue ?? '')}
        disabled={props.disabled}
      >
        <SelectTrigger id={`${id}-${field}`} className='w-full'>
          <SelectValue>
            {translateOptions ? optionLabels[value] : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {translateOptions ? optionLabels[option] : option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1.5'>
        <Label
          htmlFor={`${id}-count`}
          className='text-muted-foreground text-xs font-medium'
        >
          {t('Image count')}
        </Label>
        <div className='flex w-full items-center justify-between gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() =>
              props.updateConfig('n', clampImageCount(config.n - 1))
            }
            disabled={props.disabled || config.n <= 1}
            aria-label={t('Decrease count')}
          >
            <Minus className='size-3.5' />
          </Button>
          <Input
            id={`${id}-count`}
            type='number'
            min={1}
            max={maxImages}
            step={1}
            value={config.n}
            onChange={(event) =>
              props.updateConfig(
                'n',
                clampImageCount(Number(event.target.value) || 1)
              )
            }
            disabled={props.disabled}
            className='h-8 min-w-0 flex-1 text-center font-medium tabular-nums'
            aria-label={t('Image count')}
          />
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() =>
              props.updateConfig('n', clampImageCount(config.n + 1))
            }
            disabled={props.disabled || config.n >= maxImages}
            aria-label={t('Increase count')}
          >
            <Plus className='size-3.5' />
          </Button>
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label
          htmlFor={`${id}-size`}
          className='text-muted-foreground text-xs font-medium'
        >
          {t('Image size')}
        </Label>
        <Select
          value={config.size}
          onValueChange={(value) => props.updateConfig('size', value ?? 'auto')}
          disabled={props.disabled}
        >
          <SelectTrigger id={`${id}-size`} className='w-full'>
            <SelectValue>
              <GptImageSizeLabel size={config.size} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectItem value='auto' className='pr-7 pl-5'>
                {t('auto')}
              </SelectItem>
              {capabilities.sizePresets.map((size) => (
                <SelectItem key={size} value={size} className='pr-7 pl-5'>
                  <GptImageSizeLabel size={size} />
                </SelectItem>
              ))}
              {supportsCustomSize && (
                <SelectItem value={CUSTOM_SIZE} className='pr-7 pl-5'>
                  {t('Custom size')}
                </SelectItem>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
        {config.size === CUSTOM_SIZE && supportsCustomSize && (
          <>
            <div className='flex items-center gap-2'>
              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <Label
                  htmlFor={`${id}-width`}
                  className='text-muted-foreground text-xs'
                >
                  {t('Width')}
                </Label>
                <Input
                  id={`${id}-width`}
                  type='number'
                  min={16}
                  max={isGif ? undefined : 3840}
                  step={16}
                  value={config.customWidth}
                  onChange={(event) =>
                    props.updateConfig(
                      'customWidth',
                      Number(event.target.value) || 0
                    )
                  }
                  disabled={props.disabled}
                  aria-label={t('Width')}
                />
              </div>
              <span className='text-muted-foreground text-xs'>×</span>
              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <Label
                  htmlFor={`${id}-height`}
                  className='text-muted-foreground text-xs'
                >
                  {t('Height')}
                </Label>
                <Input
                  id={`${id}-height`}
                  type='number'
                  min={16}
                  max={isGif ? undefined : 3840}
                  step={16}
                  value={config.customHeight}
                  onChange={(event) =>
                    props.updateConfig(
                      'customHeight',
                      Number(event.target.value) || 0
                    )
                  }
                  disabled={props.disabled}
                  aria-label={t('Height')}
                />
              </div>
            </div>
            <p className='text-muted-foreground/70 text-[11px] leading-snug'>
              {isGif
                ? t(
                    'GIF width and height must be positive multiples of 16. The provider validates its GIF pixel limits.'
                  )
                : t(
                    'Custom sizes require multiples of 16, edges up to 3840 pixels, a 1:3 to 3:1 aspect ratio, and 655,360 to 8,294,400 total pixels.'
                  )}
            </p>
          </>
        )}
      </div>

      {renderSelect(
        'quality',
        t('Quality'),
        config.quality,
        capabilities.qualityOptions,
        (value) => props.updateConfig('quality', value),
        true
      )}
      {capabilities.supportsComplexity &&
        renderSelect(
          'complexity',
          t('Complexity'),
          config.complexity ?? 'high',
          ['low', 'medium', 'high'],
          (value) => props.updateConfig('complexity', value),
          true
        )}

      {capabilities.supportsInputFidelity &&
        mode === 'edit' &&
        renderSelect(
          'fidelity',
          t('Input fidelity'),
          config.inputFidelity ?? 'low',
          ['low', 'high'],
          (value) => props.updateConfig('inputFidelity', value),
          true
        )}

      {renderSelect(
        'moderation',
        t('Moderation sensitivity'),
        config.moderation,
        capabilities.moderationOptions,
        (value) => props.updateConfig('moderation', value),
        true
      )}
      {renderSelect(
        'background',
        t('Background'),
        config.background,
        capabilities.backgroundOptions.filter(
          (option) => option !== 'transparent' || supportsTransparency
        ),
        (value) => props.updateConfig('background', value),
        true
      )}
      {renderSelect(
        'format',
        t('Output format'),
        config.outputFormat,
        capabilities.outputFormatOptions.filter(
          (option) => option !== 'svg' || mode === 'generate'
        ),
        (value) => props.updateConfig('outputFormat', value)
      )}
      {isSvg && (
        <p className='text-muted-foreground text-xs'>
          {t('SVG does not support streaming or compression.')}
        </p>
      )}
      {isGif && (
        <>
          <div className='flex flex-col gap-1.5'>
            <Label
              htmlFor={`${id}-frames`}
              className='text-muted-foreground text-xs font-medium'
            >
              {t('Frame count')}
            </Label>
            <Input
              id={`${id}-frames`}
              type='number'
              min={2}
              max={16}
              step={1}
              value={config.frameCount ?? 9}
              disabled={props.disabled}
              onChange={(event) =>
                props.updateConfig('frameCount', Number(event.target.value))
              }
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label
              htmlFor={`${id}-duration`}
              className='text-muted-foreground text-xs font-medium'
            >
              {t('Frame duration (ms)')}
            </Label>
            <Input
              id={`${id}-duration`}
              type='number'
              min={20}
              max={2000}
              step={10}
              value={config.frameDurationMs ?? 200}
              disabled={props.disabled}
              onChange={(event) =>
                props.updateConfig(
                  'frameDurationMs',
                  Number(event.target.value)
                )
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t('GIF does not support masks, streaming, or compression')}
            </p>
          </div>
        </>
      )}

      {supportsCompression && (
        <div className='flex flex-col gap-1.5'>
          <Label
            htmlFor={`${id}-compression`}
            className='text-muted-foreground text-xs font-medium'
          >
            {t('Output compression')}
          </Label>
          <Input
            id={`${id}-compression`}
            type='number'
            min={0}
            max={100}
            step={1}
            value={props.config.outputCompression ?? 100}
            placeholder='0-100'
            onChange={(event) =>
              props.updateConfig(
                'outputCompression',
                event.target.value === '' ? null : Number(event.target.value)
              )
            }
            disabled={props.disabled}
          />
        </div>
      )}
      {!isGif && !isSvg && (
        <>
          <div className='flex items-center justify-between gap-2'>
            <Label
              htmlFor={`${id}-stream`}
              className='text-muted-foreground text-xs font-medium'
            >
              {t('Streaming')}
            </Label>
            <Switch
              id={`${id}-stream`}
              checked={config.stream ?? false}
              onCheckedChange={(checked) =>
                props.updateConfig('stream', checked)
              }
              disabled={props.disabled}
            />
          </div>
          {config.stream && (
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor={`${id}-partial`}
                className='text-muted-foreground text-xs font-medium'
              >
                {t('Partial images')}
              </Label>
              <Input
                id={`${id}-partial`}
                type='number'
                min={0}
                max={3}
                step={1}
                value={config.partialImages ?? 0}
                disabled={props.disabled}
                onChange={(event) =>
                  props.updateConfig(
                    'partialImages',
                    Number(event.target.value)
                  )
                }
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Each partial image adds 100 image output tokens. You may receive fewer previews than requested.'
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
