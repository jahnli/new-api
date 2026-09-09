import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { FormNavigationGuard } from '@/features/system-settings/components/form-navigation-guard'
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
  const reset = form.reset
  const isDirty = form.formState.isDirty
  useEffect(() => {
    if (!isDirty && !mutation.isPending) reset(props.data)
  }, [props.data, isDirty, mutation.isPending, reset])

  return (
    <FormProvider {...form}>
      <FormNavigationGuard when={form.formState.isDirty} />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className='w-full space-y-6'
        aria-label={t('Model Square Settings')}
        aria-busy={mutation.isPending}
      >
        <Field orientation='horizontal'>
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
        <div className='grid w-full grid-cols-1 gap-4 md:grid-cols-2'>
          {entries.fields.map((entry, index) => (
            <RecommendationFields
              key={entry.id}
              index={index}
              models={models}
              disabled={mutation.isPending}
              onRemove={() => entries.remove(index)}
            />
          ))}
        </div>
        {entries.fields.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            {t('No recommendations configured')}
          </p>
        )}
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
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            type='button'
            variant='outline'
            disabled={
              mutation.isPending ||
              models.length === 0 ||
              entries.fields.length >= 100
            }
            onClick={() =>
              entries.append({
                model_name: '',
                scenario: 'general',
                enabled: true,
              })
            }
          >
            {t('Add recommendation')}
          </Button>
          <Button
            type='submit'
            disabled={mutation.isPending || !form.formState.isDirty}
          >
            {mutation.isPending ? t('Saving...') : t('Save changes')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            disabled={mutation.isPending || !form.formState.isDirty}
            onClick={() => {
              form.reset()
              mutation.reset()
            }}
          >
            {t('Reset changes')}
          </Button>
          {form.formState.isDirty && (
            <span role='status' className='text-muted-foreground text-sm'>
              {t('Unsaved changes')}
            </span>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
