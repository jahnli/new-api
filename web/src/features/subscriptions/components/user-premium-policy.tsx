import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Info, Sparkles } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

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
  planTitleMap: ReadonlyMap<number, string>
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
  planTitleMap: ReadonlyMap<number, string>
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
  const activeSubscriptions = props.subscriptions.filter(
    (record) => record.subscription.status === 'active'
  )
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
      className='bg-background overflow-hidden rounded-xl border'
      onSubmit={form.handleSubmit((value) =>
        save.mutate(value.inherit ? null : value.percent)
      )}
    >
      <div className='flex items-center gap-2.5 border-b px-5 py-3'>
        <Sparkles className='text-primary size-4' aria-hidden='true' />
        <h3 className='text-sm font-semibold'>
          {t('Premium model quota settings')}
        </h3>
      </div>
      <div
        className={cn(
          'grid',
          activeSubscriptions.length > 0 && 'md:grid-cols-2'
        )}
      >
        <div className='space-y-3 px-5 py-3'>
          <div className='flex items-center justify-between gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Label htmlFor='premium-inherit'>{t('Use system default')}</Label>
              <Badge variant='secondary' className='tabular-nums'>
                {props.policy.default_percent}%
              </Badge>
            </div>
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
          </div>
          <div className='space-y-2'>
            <Label htmlFor='premium-percent'>{t('Premium percentage')}</Label>
            <div className='flex items-center gap-3'>
              <div className='relative min-w-0 flex-1'>
                <Input
                  id='premium-percent'
                  type='number'
                  className='pe-10 tabular-nums'
                  min={0}
                  max={100}
                  step={0.01}
                  disabled={inherit || save.isPending}
                  aria-invalid={!!form.formState.errors.percent}
                  aria-describedby={
                    form.formState.errors.percent
                      ? 'premium-percent-error'
                      : undefined
                  }
                  {...form.register('percent', { valueAsNumber: true })}
                />
                <span
                  className='text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm'
                  aria-hidden='true'
                >
                  %
                </span>
              </div>
              <Button type='submit' disabled={save.isPending}>
                {t('Save')}
              </Button>
            </div>
            {form.formState.errors.percent ? (
              <p
                id='premium-percent-error'
                role='alert'
                className='text-destructive text-sm'
              >
                {t(
                  'Enter a percentage from 0 to 100 with up to two decimal places.'
                )}
              </p>
            ) : null}
          </div>
          <p className='text-muted-foreground flex items-start gap-2 text-sm leading-relaxed'>
            <Info className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
            {t(
              'Changes apply to new requests. Existing quota usage is retained.'
            )}
          </p>
        </div>
        {activeSubscriptions.length > 0 ? (
          <div className='bg-muted/25 space-y-3 border-t px-5 py-3 md:border-s md:border-t-0'>
            {activeSubscriptions.map((record) => {
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
                <div
                  key={record.subscription.id}
                  className='bg-background space-y-2 rounded-lg border p-2'
                >
                  <div className='flex items-center justify-between gap-2 border-b pb-2'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <IconBadge
                        size='md'
                        tone='primary'
                        className='bg-primary/5'
                      >
                        <Crown className='text-amber-500' />
                      </IconBadge>
                      <span className='min-w-0 text-sm font-medium break-words'>
                        {props.planTitleMap.get(record.subscription.plan_id) ||
                          `#${record.subscription.plan_id}`}
                      </span>
                    </div>
                    <span className='text-muted-foreground shrink-0 font-mono text-xs'>
                      {t('ID')}: {record.subscription.id}
                    </span>
                  </div>
                  <PremiumQuotaSummary
                    quota={record.premium_quota}
                    limitPreview={preview}
                    hideHeader
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </form>
  )
}
