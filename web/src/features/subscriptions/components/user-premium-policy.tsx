import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { formatPremiumQuota } from '../lib/premium-quota'
import {
  getUserPremiumPolicy,
  saveUserPremiumPolicy,
  type UserPremiumPolicy as Policy,
} from '../premium-api'
import type { UserSubscriptionRecord } from '../types'
import { PremiumQuotaSummary } from './premium-quota-summary'

const overrideSchema = z.object({
  inherit: z.boolean(),
  percent: z.number().min(0).max(100).multipleOf(0.01),
})

export function UserPremiumPolicy(props: {
  userId: number
  subscriptions: UserSubscriptionRecord[]
  onSaved: () => void
}) {
  const query = useQuery({
    queryKey: ['subscription-premium', 'user', props.userId],
    queryFn: () => getUserPremiumPolicy(props.userId),
  })
  if (query.isPending) return <LoadingState inline />
  if (query.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  return (
    <UserPremiumForm
      key={`${props.userId}:${query.data.percent_override}:${query.data.default_percent}`}
      {...props}
      policy={query.data}
    />
  )
}

function UserPremiumForm(props: {
  userId: number
  subscriptions: UserSubscriptionRecord[]
  policy: Policy
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof overrideSchema>>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      inherit: props.policy.percent_override === null,
      percent: props.policy.effective_percent,
    },
  })
  const inherit = form.watch('inherit')
  const percent = inherit ? props.policy.default_percent : form.watch('percent')
  const save = useMutation({
    mutationFn: (value: number | null) =>
      saveUserPremiumPolicy(props.userId, value, props.policy.percent_override),
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
      className='space-y-3 rounded-lg border p-3'
      onSubmit={form.handleSubmit((value) =>
        save.mutate(value.inherit ? null : value.percent)
      )}
    >
      <div className='font-medium'>{t('Premium model quota')}</div>
      <div className='flex flex-wrap items-center gap-3'>
        <Controller
          control={form.control}
          name='inherit'
          render={({ field }) => (
            <Switch
              id='premium-inherit'
              checked={field.value}
              onCheckedChange={(checked) => {
                if (checked) {
                  form.setValue('percent', props.policy.default_percent)
                }
                field.onChange(checked)
              }}
              disabled={save.isPending}
            />
          )}
        />
        <Label htmlFor='premium-inherit'>
          {t('Use system default')} ({props.policy.default_percent}%)
        </Label>
        <Label htmlFor='premium-percent'>{t('Premium percentage')}</Label>
        <Input
          id='premium-percent'
          type='number'
          className='w-24'
          min={0}
          max={100}
          step={0.01}
          disabled={inherit || save.isPending}
          {...form.register('percent', { valueAsNumber: true })}
        />
        <Button type='submit' size='sm' disabled={save.isPending}>
          {t('Save')}
        </Button>
      </div>
      {form.formState.errors.percent ? (
        <p role='alert' className='text-destructive text-sm'>
          {t('Enter a percentage from 0 to 100 with up to two decimal places.')}
        </p>
      ) : null}
      <p className='text-muted-foreground text-xs'>
        {t('Changes apply to new requests. Existing quota usage is retained.')}
      </p>
      {props.subscriptions
        .filter((record) => record.subscription.status === 'active')
        .map((record) => {
          const total = record.subscription.amount_total
          let preview = '—'
          if (
            Number.isSafeInteger(total) &&
            total >= 0 &&
            Number.isFinite(percent) &&
            percent >= 0 &&
            percent <= 100
          ) {
            preview = formatPremiumQuota(
              String(
                (BigInt(total) * BigInt(Math.round(percent * 100))) / 10000n
              )
            )
          }
          return (
            <div key={record.subscription.id} className='space-y-2'>
              <p className='text-xs'>
                {t('New premium quota limit: {{amount}}', { amount: preview })}
              </p>
              <PremiumQuotaSummary quota={record.premium_quota} />
            </div>
          )
        })}
    </form>
  )
}
