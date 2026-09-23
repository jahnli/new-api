import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  getPremiumModels,
  getPremiumPolicy,
  savePremiumPolicy,
  type PremiumModelOption,
  type PremiumPolicy,
} from '../premium-api'

const policySchema = z.object({
  enabled: z.boolean(),
  default_percent: z.number().min(0).max(100).multipleOf(0.01),
  model_names: z.array(z.string()),
})

export function PremiumPolicyDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const policy = useQuery({
    queryKey: ['subscription-premium', 'policy'],
    queryFn: getPremiumPolicy,
    enabled: open,
  })
  const models = useQuery({
    queryKey: ['subscription-premium', 'models'],
    queryFn: getPremiumModels,
    enabled: open,
  })
  return (
    <>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        {t('Premium model quota settings')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('Premium model quota settings')}
      >
        {policy.isPending || models.isPending ? <LoadingState /> : null}
        {policy.isError || models.isError ? (
          <ErrorState
            onRetry={() => {
              void policy.refetch()
              void models.refetch()
            }}
          />
        ) : null}
        {policy.data && models.data ? (
          <PremiumPolicyForm
            key={policy.data.version}
            policy={policy.data}
            models={models.data}
            modelsFailed={models.isError}
            refreshing={models.isFetching}
            onRefresh={() => {
              void models.refetch()
            }}
            onSaved={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  )
}

function PremiumPolicyForm(props: {
  policy: PremiumPolicy
  models: PremiumModelOption[]
  modelsFailed: boolean
  refreshing: boolean
  onRefresh: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof policySchema>>({
    resolver: zodResolver(policySchema),
    defaultValues: props.policy,
  })
  const selected = form.watch('model_names')
  const options = props.models.map((model) => ({
    value: model.name,
    label:
      model.aliases.length > 1
        ? `${model.name} (${model.aliases.join(', ')})`
        : model.name,
  }))
  const available = new Set(options.map((option) => option.value))
  for (const name of selected) {
    if (!available.has(name)) {
      options.push({ value: name, label: `${name} (${t('Unavailable')})` })
    }
  }
  const save = useMutation({
    mutationFn: savePremiumPolicy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['subscription-premium'],
      })
      toast.success(t('Saved successfully'))
      props.onSaved()
    },
  })
  return (
    <form
      className='space-y-4'
      onSubmit={form.handleSubmit((value) =>
        save.mutate({ ...props.policy, ...value })
      )}
    >
      <div className='flex items-center gap-2'>
        <Controller
          control={form.control}
          name='enabled'
          render={({ field }) => (
            <Switch
              id='premium-enabled'
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={save.isPending}
            />
          )}
        />
        <Label htmlFor='premium-enabled'>
          {t('Enable premium quota limit')}
        </Label>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='premium-default'>
          {t('Default premium percentage')}
        </Label>
        <Input
          id='premium-default'
          type='number'
          min={0}
          max={100}
          step={0.01}
          disabled={save.isPending}
          {...form.register('default_percent', { valueAsNumber: true })}
        />
        {form.formState.errors.default_percent ? (
          <p role='alert' className='text-destructive text-sm'>
            {t(
              'Enter a percentage from 0 to 100 with up to two decimal places.'
            )}
          </p>
        ) : null}
      </div>
      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-2'>
          <Label htmlFor='premium-models'>{t('Premium models')}</Label>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={props.refreshing || save.isPending}
            onClick={props.onRefresh}
          >
            {t('Refresh')}
          </Button>
        </div>
        <Controller
          control={form.control}
          name='model_names'
          render={({ field }) => (
            <MultiSelect
              id='premium-models'
              options={options}
              selected={field.value}
              onChange={field.onChange}
              allowCreate={false}
              maxVisibleChips={8}
              inputAriaLabel={t('Premium models')}
              disabled={save.isPending}
            />
          )}
        />
        <p className='text-muted-foreground text-sm'>
          {t('Selected models: {{count}}', { count: selected.length })}
        </p>
      </div>
      <p className='text-muted-foreground text-sm'>
        {t('Changes apply to new requests. Existing quota usage is retained.')}
      </p>
      <Button type='submit' disabled={save.isPending || props.modelsFailed}>
        {t('Save')}
      </Button>
    </form>
  )
}
