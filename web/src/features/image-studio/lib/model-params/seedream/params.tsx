import { CircleHelp, Minus, Plus } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { CUSTOM_SIZE } from '../../../constants'
import { SEEDREAM_PARAMETERS } from './config'
import type { SeedreamConfig, SeedreamConfigUpdater } from './types'

interface SeedreamParamsProps {
  config: SeedreamConfig
  updateConfig: SeedreamConfigUpdater
  disabled: boolean
}

export function SeedreamParams(props: SeedreamParamsProps) {
  const { t } = useTranslation()
  const clampImageCount = (imageCount: number) =>
    Math.min(
      SEEDREAM_PARAMETERS.runtimeLimits.maxImages,
      Math.max(1, imageCount)
    )

  const renderSelect = (
    value: string,
    options: readonly string[],
    onChange: (nextValue: string) => void,
    translateOptions = false
  ) => (
    <Select
      value={value}
      onValueChange={(nextValue) => onChange(nextValue ?? '')}
      disabled={props.disabled}
    >
      <SelectTrigger className='w-full'>
        <SelectValue>{translateOptions ? t(value) : value}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {translateOptions ? t(option) : option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1.5'>
        <Label className='text-muted-foreground text-xs font-medium'>
          {t('Image count')}
        </Label>
        <div className='flex w-full items-center justify-between gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() =>
              props.updateConfig('n', clampImageCount(props.config.n - 1))
            }
            disabled={props.disabled || props.config.n <= 1}
            aria-label={t('Decrease count')}
          >
            <Minus className='size-3.5' />
          </Button>
          <Input
            type='number'
            min={1}
            max={SEEDREAM_PARAMETERS.runtimeLimits.maxImages}
            step={1}
            value={props.config.n}
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
              props.updateConfig('n', clampImageCount(props.config.n + 1))
            }
            disabled={
              props.disabled ||
              props.config.n >= SEEDREAM_PARAMETERS.runtimeLimits.maxImages
            }
            aria-label={t('Increase count')}
          >
            <Plus className='size-3.5' />
          </Button>
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label className='text-muted-foreground text-xs font-medium'>
          {t('Image size')}
        </Label>
        <Select
          value={props.config.size}
          onValueChange={(value) => props.updateConfig('size', value ?? '2K')}
          disabled={props.disabled}
        >
          <SelectTrigger className='w-full'>
            <SelectValue>
              {props.config.size === CUSTOM_SIZE
                ? t('Custom size')
                : props.config.size}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {SEEDREAM_PARAMETERS.sizePresets.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_SIZE}>{t('Custom size')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {props.config.size === CUSTOM_SIZE && (
          <>
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={1}
                max={4096}
                step={1}
                value={props.config.customWidth}
                onChange={(event) =>
                  props.updateConfig(
                    'customWidth',
                    Number(event.target.value) || 0
                  )
                }
                disabled={props.disabled}
                aria-label={t('Width')}
              />
              <span className='text-muted-foreground text-xs'>×</span>
              <Input
                type='number'
                min={1}
                max={4096}
                step={1}
                value={props.config.customHeight}
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
            <p className='text-muted-foreground/70 text-[11px] leading-snug'>
              {t(
                'Seedream custom sizes support 1280×720 to 4096×4096 pixels and aspect ratios from 1:16 to 16:1.'
              )}
            </p>
          </>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label className='text-muted-foreground inline-flex items-center gap-1 text-xs font-medium'>
          {t('Prompt optimization')}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type='button'
                  aria-label={t('Prompt optimization mode help')}
                  className='hover:text-foreground focus-visible:ring-ring/50 inline-flex rounded-sm outline-none focus-visible:ring-2'
                />
              }
            >
              <CircleHelp className='size-3.5' />
            </TooltipTrigger>
            <TooltipContent
              side='right'
              align='start'
              className='max-w-72 whitespace-normal'
            >
              {t(
                'Standard mode generates higher-quality content but takes longer.'
              )}
            </TooltipContent>
          </Tooltip>
        </Label>
        {renderSelect(
          props.config.optimizePromptMode,
          SEEDREAM_PARAMETERS.promptOptimizationOptions,
          (value) => props.updateConfig('optimizePromptMode', value),
          true
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label className='text-muted-foreground text-xs font-medium'>
          {t('Output format')}
        </Label>
        {renderSelect(
          props.config.outputFormat,
          SEEDREAM_PARAMETERS.outputFormatOptions,
          (value) => props.updateConfig('outputFormat', value)
        )}
      </div>

      <div className='flex items-center justify-between gap-3'>
        <Label
          htmlFor='image-studio-seedream-watermark'
          className='text-muted-foreground text-xs font-medium'
        >
          {t('Watermark')}
        </Label>
        <Switch
          id='image-studio-seedream-watermark'
          checked={props.config.watermark}
          onCheckedChange={(checked) =>
            props.updateConfig('watermark', checked)
          }
          disabled={props.disabled}
          aria-label={t('Watermark')}
        />
      </div>
    </div>
  )
}
