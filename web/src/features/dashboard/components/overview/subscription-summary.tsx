import { CalendarClock, Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { IconBadge } from '@/components/ui/icon-badge'
import { Progress } from '@/components/ui/progress'
import { SubscriptionQuotaDetailsPopover } from '@/features/subscriptions/components/subscription-quota-details-popover'
import { formatPremiumQuota } from '@/features/subscriptions/lib/premium-quota'
import type { PremiumQuota } from '@/features/subscriptions/premium-api'
import type { UserSubscription } from '@/features/subscriptions/types'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SubscriptionSummary(props: {
  subscription: UserSubscription
  premiumQuota?: PremiumQuota
  planTitle?: string
  nextResetTime: number
}) {
  const { t, i18n } = useTranslation()
  const total = BigInt(props.subscription.amount_total)
  const used = BigInt(props.subscription.amount_used)
  const isUnlimited = total === 0n
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const usedPercent = total > 0n ? Number((used * 10000n) / total) / 100 : 0
  let usageColor = 'text-emerald-500'
  let progressColor = '[&_[data-slot=progress-indicator]]:bg-emerald-500'
  if (usedPercent >= 80) {
    usageColor = 'text-red-500'
    progressColor = '[&_[data-slot=progress-indicator]]:bg-red-500'
  } else if (usedPercent >= 50) {
    usageColor = 'text-amber-500'
    progressColor = '[&_[data-slot=progress-indicator]]:bg-amber-500'
  }
  const premiumUsed = BigInt(props.premiumQuota?.premium_amount_used ?? '0')
  const premiumLimit = BigInt(props.premiumQuota?.premium_limit ?? '0')
  const premiumPercent =
    premiumLimit > 0n ? Number((premiumUsed * 10000n) / premiumLimit) / 100 : 0
  const premiumPercentLabel =
    premiumLimit === 0n && premiumUsed > 0n
      ? t('Over quota')
      : t('{{percent}}% used', {
          percent: formatNumber(premiumPercent, locale),
        })
  let premiumUsageColor = 'text-emerald-500'
  let premiumProgressColor = '[&_[data-slot=progress-indicator]]:bg-emerald-500'
  if (premiumLimit === 0n && premiumUsed > 0n) {
    premiumUsageColor = 'text-red-500'
    premiumProgressColor = '[&_[data-slot=progress-indicator]]:bg-red-500'
  } else if (premiumLimit > 0n) {
    if (premiumPercent >= 80) {
      premiumUsageColor = 'text-red-500'
      premiumProgressColor = '[&_[data-slot=progress-indicator]]:bg-red-500'
    } else if (premiumPercent >= 50) {
      premiumUsageColor = 'text-amber-500'
      premiumProgressColor = '[&_[data-slot=progress-indicator]]:bg-amber-500'
    }
  }

  return (
    <section
      className='flex min-w-0 flex-col gap-3'
      aria-label={t('Current Subscription')}
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <IconBadge size='sm' tone='warning'>
            <Crown />
          </IconBadge>
          <h3 className='text-sm font-semibold'>{t('Current Subscription')}</h3>
        </div>
        {props.planTitle && (
          <Badge
            variant='outline'
            className='bg-primary/10 text-primary border-primary/15 h-auto max-w-full rounded-md px-2 py-0.5 text-xs break-words whitespace-normal'
          >
            {props.planTitle}
          </Badge>
        )}
      </div>

      <div className='space-y-2'>
        <dl className='flex flex-wrap items-end justify-between gap-x-4 gap-y-2'>
          <div className='min-w-0 space-y-1'>
            <dt className='text-muted-foreground text-xs'>{t('Used')}</dt>
            <dd
              className={cn(
                'text-2xl leading-tight font-semibold tracking-tight break-all tabular-nums',
                usageColor
              )}
            >
              {formatPremiumQuota(used.toString())}
            </dd>
          </div>
          <div className='min-w-0 space-y-1'>
            <dt className='text-muted-foreground text-xs'>
              {t('Total Quota')}
            </dt>
            <dd className='text-muted-foreground text-2xl leading-tight font-semibold tracking-tight break-all tabular-nums'>
              {isUnlimited
                ? t('Unlimited')
                : formatPremiumQuota(total.toString())}
            </dd>
          </div>
        </dl>
        {!isUnlimited && (
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <Progress
              value={Math.min(100, usedPercent)}
              aria-label={t('Total Quota')}
              aria-valuetext={t('{{percent}}% used', {
                percent: formatNumber(usedPercent, locale),
              })}
              className={cn(
                'min-w-12 flex-1 [&_[data-slot=progress-track]]:h-1.5',
                progressColor
              )}
            />
            <p className={cn('text-xs tabular-nums', usageColor)}>
              {t('{{percent}}% used', {
                percent: formatNumber(usedPercent, locale),
              })}
            </p>
          </div>
        )}
      </div>

      {props.premiumQuota?.enabled && (
        <div className='bg-background/60 border-border/70 min-w-0 space-y-2 rounded-xl border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
            <div className='flex items-center gap-1'>
              <h4 className='text-sm font-medium'>
                {t('Advanced model quota')}
              </h4>
              <SubscriptionQuotaDetailsPopover
                title={t('Advanced model quota')}
                used={formatPremiumQuota(premiumUsed.toString())}
                limit={formatPremiumQuota(premiumLimit.toString())}
                remaining={formatPremiumQuota(
                  props.premiumQuota.premium_available
                )}
                description={t(
                  'Advanced model usage counts toward total quota. Available amount is limited by both the advanced quota limit and the remaining subscription quota.'
                )}
                showPremiumModels
              />
            </div>
            <p className='text-muted-foreground ml-auto text-right text-xs tabular-nums'>
              {t('{{percent}}% of total quota', {
                percent: formatNumber(
                  props.premiumQuota.effective_percent,
                  locale,
                  { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                ),
              })}
            </p>
          </div>
          <dl className='flex flex-wrap justify-between gap-x-3 gap-y-2'>
            <div className='min-w-0 space-y-1'>
              <dt className='text-muted-foreground text-xs'>{t('Used')}</dt>
              <dd
                className={cn(
                  'text-sm font-semibold break-all tabular-nums',
                  premiumUsageColor
                )}
              >
                {formatPremiumQuota(premiumUsed.toString())}
              </dd>
            </div>
            <div className='min-w-0 space-y-1'>
              <dt className='text-muted-foreground text-xs'>
                {t('Total Quota')}
              </dt>
              <dd className='text-muted-foreground text-sm font-medium break-all tabular-nums'>
                {formatPremiumQuota(premiumLimit.toString())}
              </dd>
            </div>
          </dl>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <Progress
              value={
                premiumLimit === 0n && premiumUsed > 0n
                  ? 100
                  : Math.min(100, Math.max(0, premiumPercent))
              }
              aria-label={t('Advanced model quota')}
              aria-valuetext={premiumPercentLabel}
              className={cn(
                'min-w-12 flex-1 [&_[data-slot=progress-track]]:h-1',
                premiumProgressColor
              )}
            />
            <p className={cn('text-xs tabular-nums', premiumUsageColor)}>
              {premiumPercentLabel}
            </p>
          </div>
        </div>
      )}

      {props.nextResetTime > 0 && (
        <div className='text-muted-foreground -my-1 flex items-start gap-2 text-xs'>
          <CalendarClock
            className='mt-0.5 size-3.5 shrink-0'
            aria-hidden='true'
          />
          <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
            <p>{t('Next reset')}</p>
            <time
              className='text-foreground block font-medium tabular-nums'
              dateTime={dayjs(props.nextResetTime * 1000).toISOString()}
            >
              {dayjs(props.nextResetTime * 1000).format('YYYY/M/D HH:mm:ss')}
            </time>
          </div>
        </div>
      )}
    </section>
  )
}
