import { CalendarClock, CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatPremiumQuota } from '@/features/subscriptions/lib/premium-quota'
import type { PremiumQuota } from '@/features/subscriptions/premium-api'
import type { UserSubscription } from '@/features/subscriptions/types'
import { useExternalMode } from '@/hooks/use-external-mode'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

function getUsagePercent(used: bigint, limit: bigint): number {
  if (limit <= 0n) return used > 0n ? 100 : 0
  return Number((used * 10000n) / limit) / 100
}

function getProgressClassName(percent: number): string {
  if (percent >= 80) {
    return '[&_[data-slot=progress-indicator]]:bg-red-500'
  }
  if (percent >= 50) {
    return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  }
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

export function SubscriptionSummary(props: {
  subscription: UserSubscription
  premiumQuota?: PremiumQuota
  planTitle?: string
  nextResetTime: number
}) {
  const { t } = useTranslation()
  const externalMode = useExternalMode()
  const total = BigInt(props.subscription.amount_total)
  const used = BigInt(props.subscription.amount_used)
  const isUnlimited = total === 0n
  const remaining = total > used ? total - used : 0n
  const quota = externalMode ? undefined : props.premiumQuota
  const split = total > 0n && quota?.enabled === true
  const premiumUsed = quota ? BigInt(quota.premium_amount_used) : 0n
  const premiumLimit = quota ? BigInt(quota.premium_limit) : 0n
  const standardLimit = total > premiumLimit ? total - premiumLimit : 0n
  const standardUsed = used > premiumUsed ? used - premiumUsed : 0n

  return (
    <div className='flex min-w-0 flex-1 flex-col justify-between gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground flex min-w-0 items-center gap-1 text-sm font-medium'>
          <span>{t('Current Subscription')}</span>
          <QuotaDetailsPopover
            title={t('Total Quota')}
            triggerLabel={`${t('Total Quota')} · ${t('Details')}`}
            details={[
              { label: t('Used'), value: formatPremiumQuota(used.toString()) },
              {
                label: t('Total Quota'),
                value: isUnlimited
                  ? t('Unlimited')
                  : formatPremiumQuota(total.toString()),
              },
              {
                label: t('Remaining'),
                value: isUnlimited
                  ? t('Unlimited')
                  : formatPremiumQuota(remaining.toString()),
              },
            ]}
            description={
              split
                ? t(
                    'Shared by standard and advanced models. Advanced models have an additional quota limit.'
                  )
                : t('Quota usage includes pending request reservations.')
            }
            className='w-auto'
            triggerClassName='size-5 justify-center p-0 text-muted-foreground hover:text-foreground'
          >
            <CircleHelp className='size-3.5' aria-hidden='true' />
          </QuotaDetailsPopover>
        </div>
        {props.planTitle && (
          <Badge
            variant='outline'
            className='bg-background text-primary border-primary/20 max-w-32 text-xs'
          >
            <span className='truncate'>{props.planTitle}</span>
          </Badge>
        )}
      </div>

      <p className='flex flex-wrap items-baseline gap-x-1.5 leading-tight tracking-tight break-all tabular-nums'>
        <span className='text-2xl font-semibold'>
          {formatPremiumQuota(used.toString())}
        </span>
        <span className='text-muted-foreground text-lg font-medium'>
          /{' '}
          {isUnlimited ? t('Unlimited') : formatPremiumQuota(total.toString())}
        </span>
      </p>

      {split ? (
        <div className='grid grid-cols-2 gap-x-3 border-y py-4 [&>div+div]:border-s [&>div+div]:ps-3'>
          <CompactQuotaRow
            title={t('Standard model quota')}
            used={standardUsed}
            limit={standardLimit}
            description={t(
              'Standard quota is total quota minus the advanced quota limit. Standard models can also use the remaining subscription quota.'
            )}
          />
          <CompactQuotaRow
            title={t('Advanced model quota')}
            allocationPercent={quota.effective_percent}
            used={premiumUsed}
            limit={premiumLimit}
            description={t(
              'Advanced model usage counts toward total quota. Available amount is limited by both the advanced quota limit and the remaining subscription quota.'
            )}
          />
        </div>
      ) : (
        <CompactQuotaRow
          title={t('Total Quota')}
          used={used}
          limit={isUnlimited ? null : total}
          description={t('Quota usage includes pending request reservations.')}
        />
      )}

      {props.nextResetTime > 0 && (
        <div className='text-muted-foreground flex items-center gap-1.5 text-[13px]'>
          <CalendarClock className='size-3.5 shrink-0' aria-hidden='true' />
          <span className='leading-relaxed'>
            {t('Next reset')}:{' '}
            {dayjs(props.nextResetTime * 1000).format('YYYY/M/D HH:mm:ss')}
          </span>
        </div>
      )}
    </div>
  )
}

function CompactQuotaRow(props: {
  title: string
  used: bigint
  limit: bigint | null
  allocationPercent?: number
  description: string
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent =
    props.limit === null ? 0 : getUsagePercent(props.used, props.limit)
  const progressClassName = getProgressClassName(percent)
  const usageLabel =
    props.limit === 0n && props.used > 0n
      ? t('Over quota')
      : t('{{percent}}% used', {
          percent: formatNumber(percent, locale),
        })

  const formattedUsed = formatPremiumQuota(props.used.toString())
  const formattedLimit =
    props.limit === null
      ? t('Unlimited')
      : formatPremiumQuota(props.limit.toString())

  return (
    <div className='flex min-w-0 flex-col gap-2.5'>
      <QuotaDetailsPopover
        title={props.title}
        triggerLabel={`${props.title} · ${t('Details')}`}
        details={[
          { label: t('Used'), value: formattedUsed },
          { label: t('Total Quota'), value: formattedLimit },
        ]}
        description={props.description}
        triggerClassName='items-start justify-between gap-1 text-[13px] font-medium'
      >
        <span className='flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 whitespace-normal'>
          <span>{props.title}</span>
          {props.allocationPercent !== undefined && (
            <span className='text-muted-foreground text-[13px] font-normal whitespace-nowrap tabular-nums'>
              {t('Share {{percent}}%', {
                percent: formatNumber(props.allocationPercent, locale),
              })}
            </span>
          )}
        </span>
        <CircleHelp
          className='text-muted-foreground mt-0.5 size-3 shrink-0'
          aria-hidden='true'
        />
      </QuotaDetailsPopover>
      <div className='mt-auto'>
        <p className='flex flex-wrap items-baseline gap-x-1 break-all tabular-nums'>
          <span className='text-base font-semibold tracking-tight'>
            {formattedUsed}
          </span>
          <span className='text-muted-foreground text-[11px]'>
            / {formattedLimit}
          </span>
        </p>
      </div>
      {props.limit !== null && (
        <Progress
          value={Math.min(100, percent)}
          aria-label={props.title}
          aria-valuetext={usageLabel}
          className={cn(
            '[&_[data-slot=progress-track]]:h-1',
            progressClassName
          )}
        />
      )}
    </div>
  )
}
