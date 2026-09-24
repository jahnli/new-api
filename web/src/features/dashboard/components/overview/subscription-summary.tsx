import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
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
  let premiumUsageColor = 'text-emerald-500'
  if (premiumLimit === 0n && premiumUsed > 0n) {
    premiumUsageColor = 'text-red-500'
  } else if (premiumLimit > 0n) {
    const premiumPercent = Number((premiumUsed * 10000n) / premiumLimit) / 100
    if (premiumPercent >= 80) {
      premiumUsageColor = 'text-red-500'
    } else if (premiumPercent >= 50) {
      premiumUsageColor = 'text-amber-500'
    }
  }

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <div className='flex items-center justify-between gap-2'>
        <span className='dark:text-foreground text-sm font-semibold text-[#152547]'>
          {t('Current Subscription')}
        </span>
        {props.planTitle && (
          <Badge
            variant='secondary'
            className='bg-primary/10 text-primary h-auto max-w-36 rounded-md border-0 px-3 py-1 text-sm'
          >
            <span className='truncate'>{props.planTitle}</span>
          </Badge>
        )}
      </div>

      <div className='space-y-1.5'>
        <p className='text-2xl leading-tight font-semibold tracking-tight break-all tabular-nums'>
          <span className={usageColor}>
            {formatPremiumQuota(used.toString())}
          </span>
          <span className='dark:text-foreground text-[#152547]'>
            {` / ${isUnlimited ? t('Unlimited') : formatPremiumQuota(total.toString())}`}
          </span>
        </p>
        {!isUnlimited && (
          <Progress
            value={Math.min(100, usedPercent)}
            aria-label={t('Total Quota')}
            aria-valuetext={t('{{percent}}% used', {
              percent: formatNumber(usedPercent, locale),
            })}
            className={cn('[&_[data-slot=progress-track]]:h-2', progressColor)}
          />
        )}
      </div>

      {props.premiumQuota?.enabled && (
        <div className='bg-primary/5 min-w-0 space-y-1 rounded-lg px-2.5 py-2'>
          <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm'>
            <div className='flex items-center gap-1'>
              <span className='dark:text-foreground text-sm font-semibold text-[#152547]'>
                {t('Advanced model quota')}
              </span>
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
            <span className='text-muted-foreground text-xs font-semibold tabular-nums'>
              {t('Share {{percent}}%', {
                percent: formatNumber(
                  props.premiumQuota.effective_percent,
                  locale
                ),
              })}
            </span>
          </div>
          <p
            className={`text-base font-semibold break-all tabular-nums ${premiumUsageColor}`}
          >
            {formatPremiumQuota(premiumUsed.toString())}
            <span className='font-semibold text-[#152547]'>
              {' / '}
              {formatPremiumQuota(premiumLimit.toString())}
            </span>
          </p>
        </div>
      )}

      {props.nextResetTime > 0 && (
        <div className='dark:text-foreground flex items-center gap-1.5 text-sm text-[#152547]'>
          <CalendarClock className='size-4 shrink-0' aria-hidden='true' />
          <span>
            {t('Next reset')}:{' '}
            {dayjs(props.nextResetTime * 1000).format('YYYY/M/D HH:mm:ss')}
          </span>
        </div>
      )}
    </div>
  )
}
