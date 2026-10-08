import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Reorder } from 'motion/react'
import { useEffect, useMemo } from 'react'
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { FormDirtyIndicator } from '@/features/system-settings/components/form-dirty-indicator'
import { FormNavigationGuard } from '@/features/system-settings/components/form-navigation-guard'
import { SettingsPageFormActions } from '@/features/system-settings/components/settings-page-context'
import { handleServerError } from '@/lib/handle-server-error'

import { modelSquareConfigQueryKey, saveModelSquareConfig } from '../api'
import {
  createModelSquareConfigSchema,
  type ModelSquareFormValues,
} from '../lib/schema'
import type { ModelSquareConfigData } from '../types'
import { RecommendationFields } from './recommendation-fields'

export function ModelSquareSettingsForm(props: ModelSquareConfigData) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const schema = useMemo(() => createModelSquareConfigSchema(t), [t])
  const form = useForm<ModelSquareFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.data,
  })
  const entries = useFieldArray({
    control: form.control,
    name: 'recommendations',
  })
  const models = useMemo(
    () => [...new Set(props.models)].sort(),
    [props.models]
  )
  const mutation = useMutation({
    mutationFn: saveModelSquareConfig,
    onSuccess: (config) => {
      form.reset(config)
      queryClient.setQueryData<ModelSquareConfigData>(
        modelSquareConfigQueryKey,
        { data: config, models: props.models }
      )
      void queryClient.invalidateQueries({ queryKey: ['pricing'] })
      toast.success(t('Model square settings saved'))
    },
    onError: (error) => handleServerError(error),
  })
  const submit = form.handleSubmit((values) => mutation.mutate(values))
  const reset = form.reset
  const isDirty = form.formState.isDirty
  useEffect(() => {
    if (!isDirty && !mutation.isPending) reset(props.data)
  }, [props.data, isDirty, mutation.isPending, reset])

  // motion reports reorders as a swap of two entries, which is exactly what
  // the field array does to keep the rendered inputs mounted.
  const handleReorder = (nextOrder: string[]) => {
    const order = entries.fields.map((field) => field.id)
    const from = order.findIndex((id, index) => id !== nextOrder[index])
    const to = nextOrder.indexOf(order[from])
    if (from < 0 || to < 0 || from === to) return
    entries.swap(from, to)
  }
  const moveEntry = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= entries.fields.length) return
    entries.swap(index, target)
  }

  return (
    <FormProvider {...form}>
      <FormNavigationGuard when={form.formState.isDirty} />
      <FormDirtyIndicator isDirty={isDirty} />
      <form
        noValidate
        onSubmit={submit}
        className='@container/recommendations w-full space-y-3 pb-2'
        aria-label={t('Model Square Settings')}
        aria-busy={mutation.isPending}
      >
        <div className='bg-background sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-3 border-b py-3'>
          <Field orientation='horizontal' className='h-8 w-auto shrink-0'>
            <Controller
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <Switch
                  id='model-square-enabled'
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={mutation.isPending}
                />
              )}
            />
            <FieldLabel htmlFor='model-square-enabled'>
              {t('Enable model recommendations')}
            </FieldLabel>
          </Field>
          <div className='ml-auto flex flex-wrap items-center justify-end gap-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={
                mutation.isPending ||
                models.length === 0 ||
                entries.fields.length >= 100
              }
              onClick={() =>
                entries.append({
                  model_name: '',
                  scenarios: [],
                  enabled: true,
                })
              }
            >
              {t('Add recommendation')}
            </Button>
            <SettingsPageFormActions
              inline
              isSaving={mutation.isPending}
              isSaveDisabled={!isDirty}
              isResetDisabled={!isDirty}
              saveLabel='Save changes'
              savingLabel='Saving...'
              resetLabel='Reset changes'
              onSave={() => void submit()}
              onReset={() => {
                form.reset()
                mutation.reset()
              }}
            />
          </div>
        </div>
        <div className='rounded-xl border'>
          <div
            aria-hidden='true'
            className='bg-muted/40 text-muted-foreground hidden grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.4fr)_6rem_6rem] gap-4 rounded-t-xl border-b px-4 py-2.5 text-xs font-medium @3xl/recommendations:grid'
          >
            <span>#</span>
            <span>{t('Model')}</span>
            <span>{t('Usage scenarios')}</span>
            <span className='text-center'>{t('Status')}</span>
            <span className='text-center'>{t('Actions')}</span>
          </div>
          <Reorder.Group
            axis='y'
            values={entries.fields.map((field) => field.id)}
            onReorder={handleReorder}
            className='flex w-full flex-col [&>li:first-child]:rounded-t-xl @3xl/recommendations:[&>li:first-child]:rounded-t-none [&>li:last-child]:rounded-b-xl'
          >
            {entries.fields.map((entry, index) => (
              <RecommendationFields
                key={entry.id}
                fieldId={entry.id}
                index={index}
                models={models}
                disabled={mutation.isPending}
                onMove={(direction) => moveEntry(index, direction)}
                onRemove={() => entries.remove(index)}
              />
            ))}
          </Reorder.Group>
          {entries.fields.length === 0 && (
            <EmptyState
              title={t('No recommendations configured')}
              className='min-h-48'
            />
          )}
        </div>
        {models.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            {t(
              'No available models. Existing recommendations can still be edited or removed.'
            )}
          </p>
        )}
        <FieldError errors={[form.formState.errors.recommendations?.root]} />
        {mutation.isError && (
          <p role='alert' className='text-destructive text-sm'>
            {t('Failed to save model square settings')}
          </p>
        )}
      </form>
    </FormProvider>
  )
}
