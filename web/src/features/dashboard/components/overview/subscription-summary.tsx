import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  const totalPercent = getUsagePercent(used, total)
  const totalProgressClassName = getProgressClassName(totalPercent)
  const quota = externalMode ? undefined : props.premiumQuota
  const split = total > 0n && quota?.enabled === true
  const premiumUsed = quota ? BigInt(quota.premium_amount_used) : 0n
  const premiumLimit = quota ? BigInt(quota.premium_limit) : 0n
  const standardLimit = total > premiumLimit ? total - premiumLimit : 0n
  const standardUsed = used > premiumUsed ? used - premiumUsed : 0n

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        split ? 'flex-1 justify-between gap-3' : 'gap-2.5'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='text-muted-foreground text-sm font-medium'>
          {t('Current Subscription')}
        </span>
        {props.planTitle && (
          <Badge
            variant='secondary'
            className='bg-primary/10 text-primary max-w-36 truncate border-0 text-sm'
          >
            {props.planTitle}
          </Badge>
        )}
      </div>

      <div className='space-y-1.5'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Total Quota')}
          </span>
          <p className='flex items-baseline gap-x-1 font-mono tracking-tight'>
            <span className='text-xl font-semibold'>
              {formatPremiumQuota(used.toString())}
            </span>
            <span className='text-muted-foreground text-sm font-medium'>
              /{' '}
              {isUnlimited
                ? t('Unlimited')
                : formatPremiumQuota(total.toString())}
            </span>
          </p>
        </div>
        {!isUnlimited && (
          <Progress
            value={Math.min(100, totalPercent)}
            aria-label={t('Total Quota')}
            className={cn(
              '[&_[data-slot=progress-track]]:h-1.5',
              totalProgressClassName
            )}
          />
        )}
      </div>

      {split && (
        <div className='grid gap-3 border-t border-white/50 pt-3 dark:border-white/10'>
          <CompactQuotaRow
            title={t('Standard model quota')}
            used={standardUsed}
            limit={standardLimit}
          />
          <CompactQuotaRow
            title={t('Advanced model quota')}
            allocationPercent={quota.effective_percent}
            used={premiumUsed}
            limit={premiumLimit}
          />
        </div>
      )}

      {props.nextResetTime > 0 && (
        <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <CalendarClock className='size-3.5 shrink-0' aria-hidden='true' />
          <span>
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
  limit: bigint
  allocationPercent?: number
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent = getUsagePercent(props.used, props.limit)
  const progressClassName = getProgressClassName(percent)
  const usageLabel =
    props.limit === 0n && props.used > 0n
      ? t('Over quota')
      : t('{{percent}}% used', {
          percent: formatNumber(percent, locale),
        })

  return (
    <div className='min-w-0'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs'>
        <span className='min-w-0 font-medium'>
          {props.title}
          {props.allocationPercent !== undefined && (
            <span className='text-muted-foreground ms-1 font-normal tabular-nums'>
              ·{' '}
              {t('Share {{percent}}%', {
                percent: formatNumber(props.allocationPercent, locale),
              })}
            </span>
          )}
        </span>
        <span className='text-muted-foreground min-w-0 text-right break-all tabular-nums'>
          {formatPremiumQuota(props.used.toString())}
          {' / '}
          {formatPremiumQuota(props.limit.toString())}
        </span>
      </div>
      <Progress
        value={Math.min(100, percent)}
        aria-label={props.title}
        aria-valuetext={usageLabel}
        className={cn(
          'mt-1 [&_[data-slot=progress-track]]:h-1',
          progressClassName
        )}
      />
    </div>
  )
}
