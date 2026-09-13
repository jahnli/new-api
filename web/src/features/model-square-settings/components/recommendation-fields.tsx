import { Drag01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Reorder, useDragControls } from 'motion/react'
import { useMemo, type KeyboardEvent, type PointerEvent } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'

import type { ModelSquareFormValues } from '../lib/schema'
import { MODEL_SQUARE_SCENARIO_PRESETS } from '../types'

type RecommendationFieldsProps = {
  /** Field array id; motion matches reorder values against this. */
  fieldId: string
  index: number
  models: string[]
  disabled: boolean
  onMove: (direction: 'up' | 'down') => void
  onRemove: () => void
}

export function RecommendationFields(props: RecommendationFieldsProps) {
  const { t } = useTranslation()
  const form = useFormContext<ModelSquareFormValues>()
  const dragControls = useDragControls()
  const prefix = `recommendations.${props.index}` as const
  const model = useWatch({
    control: form.control,
    name: `${prefix}.model_name`,
  })
  const unavailable = Boolean(model && !props.models.includes(model))
  const options = useMemo(() => {
    if (unavailable) return [model, ...props.models]
    return props.models
  }, [model, props.models, unavailable])
  const errors = form.formState.errors.recommendations?.[props.index]
  const scenarioOptions = useMemo(
    () =>
      MODEL_SQUARE_SCENARIO_PRESETS.map((value) => ({
        value,
        label: t(value),
      })),
    [t]
  )

  const handleDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    dragControls.start(event)
  }

  // Dragging is the pointer affordance; these keys keep the same reorder
  // reachable from the keyboard, like the other reorder editors in the app.
  const handleDragKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    props.onMove(event.key === 'ArrowUp' ? 'up' : 'down')
  }

  return (
    <Reorder.Item
      value={props.fieldId}
      dragListener={false}
      dragControls={dragControls}
      className='min-w-0'
    >
      <FieldSet
        className='flex min-w-0 flex-row flex-wrap items-center gap-5 rounded-lg border p-4'
        disabled={props.disabled}
      >
        <FieldLegend className='mb-0 flex shrink-0 items-center gap-1.5'>
          <Badge
            aria-hidden='true'
            className='bg-primary/10 text-primary size-5 rounded-full px-0 text-[11px] font-semibold tabular-nums'
          >
            {props.index + 1}
          </Badge>
          <span className='sr-only'>
            {t('Recommendation {{number}}', { number: props.index + 1 })}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='text-muted-foreground -ml-0.5 cursor-grab touch-none active:cursor-grabbing'
            disabled={props.disabled}
            aria-label={t('Drag {{group}} to reorder', {
              group: t('Recommendation {{number}}', {
                number: props.index + 1,
              }),
            })}
            onPointerDown={handleDragStart}
            onKeyDown={handleDragKeyDown}
          >
            <HugeiconsIcon
              icon={Drag01Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
          </Button>
        </FieldLegend>
        <FieldGroup className='flex min-w-0 flex-1 flex-row flex-wrap items-end gap-6'>
          <Field
            className='min-w-0 basis-80'
            data-invalid={Boolean(errors?.model_name)}
          >
            <FieldLabel htmlFor={`${prefix}.model_name`}>
              {t('Model')}
            </FieldLabel>
            <Controller
              control={form.control}
              name={`${prefix}.model_name`}
              render={({ field }) => (
                <Combobox
                  items={options}
                  value={field.value || null}
                  disabled={props.disabled}
                  onValueChange={(value) => field.onChange(value ?? '')}
                >
                  <ComboboxInput
                    id={`${prefix}.model_name`}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    placeholder={t('Search models...')}
                    aria-invalid={Boolean(errors?.model_name)}
                    aria-describedby={
                      errors?.model_name ? `${prefix}.model-error` : undefined
                    }
                    className='w-full min-w-0'
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>{t('No models found')}</ComboboxEmpty>
                    <ComboboxList>
                      {(option: string) => (
                        <ComboboxItem
                          key={option}
                          value={option}
                          className='break-all'
                        >
                          {option}
                          {!props.models.includes(option) &&
                            ` (${t('Unavailable')})`}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              )}
            />
            {unavailable && (
              <FieldDescription>
                {t(
                  'This saved model is currently unavailable. It will be retained until you replace or remove it.'
                )}
              </FieldDescription>
            )}
            <FieldError
              id={`${prefix}.model-error`}
              errors={[errors?.model_name]}
            />
          </Field>
          <Field
            className='max-w-2xl min-w-0 flex-1 basis-64'
            data-invalid={Boolean(errors?.scenarios)}
          >
            <FieldLabel htmlFor={`${prefix}.scenarios`}>
              {t('Usage scenarios')}
            </FieldLabel>
            <Controller
              control={form.control}
              name={`${prefix}.scenarios`}
              render={({ field }) => (
                <MultiSelect
                  id={`${prefix}.scenarios`}
                  options={scenarioOptions}
                  selected={field.value ?? []}
                  onChange={field.onChange}
                  allowCreate
                  reorderable
                  showChipOrder
                  disabled={props.disabled}
                  placeholder={t('Add a scenario or type your own')}
                  inputAriaLabel={t('Usage scenarios')}
                />
              )}
            />
            <FieldError
              id={`${prefix}.scenarios-error`}
              errors={[errors?.scenarios]}
            />
          </Field>
          <Field orientation='horizontal' className='ml-8 h-8 w-auto shrink-0'>
            <Controller
              control={form.control}
              name={`${prefix}.enabled`}
              render={({ field }) => (
                <Switch
                  id={`${prefix}.enabled`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={props.disabled}
                />
              )}
            />
            <FieldLabel htmlFor={`${prefix}.enabled`}>
              {t('Enabled')}
            </FieldLabel>
          </Field>
          <Button
            type='button'
            variant='outline'
            className='ml-4 shrink-0'
            onClick={props.onRemove}
            disabled={props.disabled}
            aria-label={t('Remove recommendation {{number}}', {
              number: props.index + 1,
            })}
          >
            {t('Remove')}
          </Button>
        </FieldGroup>
      </FieldSet>
    </Reorder.Item>
  )
}
