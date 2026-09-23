import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { formatPremiumQuota } from '../lib/premium-quota'
import type { PremiumQuota } from '../premium-api'
import type { UserSubscription } from '../types'

export function SubscriptionQuotaBreakdown(props: {
  subscription: UserSubscription
  quota?: PremiumQuota
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const total = BigInt(props.subscription.amount_total)
  const used = BigInt(props.subscription.amount_used)
  const remaining = total > used ? total - used : 0n
  const quota = props.quota
  const split = total > 0n && quota?.enabled === true
  const premiumUsed = quota ? BigInt(quota.premium_amount_used) : 0n
  const premiumLimit = quota ? BigInt(quota.premium_limit) : 0n
  const basicLimit = total > premiumLimit ? total - premiumLimit : 0n
  const basicUsed = used > premiumUsed ? used - premiumUsed : 0n
  const basicRemaining = basicLimit > basicUsed ? basicLimit - basicUsed : 0n
  const reservationNote = t(
    'Quota usage includes pending request reservations.'
  )
  let displayedLimit: bigint | null = total > 0n ? total : null
  if (split) displayedLimit = basicLimit

  return (
    <div className='space-y-3'>
      <div className={cn('grid gap-3', split && 'sm:grid-cols-2')}>
        <QuotaUsagePanel
          title={split ? t('Basic quota') : t('Total Quota')}
          used={split ? basicUsed : used}
          limit={displayedLimit}
          remaining={split ? basicRemaining : remaining}
          description={
            split
              ? `${t('Basic allocation is total quota minus the advanced limit. Basic models can also use the shared remaining quota.')} ${reservationNote}`
              : reservationNote
          }
        />
        {split && (
          <QuotaUsagePanel
            title={t('Advanced quota')}
            used={premiumUsed}
            limit={premiumLimit}
            remaining={BigInt(quota.premium_available)}
            premium
            description={`${quota.percent_source === 'user' ? t('User override') : t('System default')} · ${formatNumber(quota.effective_percent, locale)}%. ${t('Advanced usage also consumes total quota. Remaining is limited by both the advanced limit and the shared remaining quota.')} ${reservationNote}`}
          />
        )}
      </div>
      {split && (
        <div className='text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm'>
          <span>{t('Remaining subscription quota')}</span>
          <span className='text-foreground font-medium tabular-nums'>
            {formatPremiumQuota(remaining.toString())}
            <span className='text-muted-foreground font-normal'>
              {' '}
              / {formatPremiumQuota(total.toString())}
            </span>
          </span>
          <p className='w-full text-xs leading-relaxed'>
            {t(
              'Shared by basic and advanced models. Advanced models have an additional quota limit.'
            )}
          </p>
        </div>
      )}
      {quota && !quota.enabled && (
        <p className='text-muted-foreground text-xs'>
          {t('Premium quota limit is disabled')}
        </p>
      )}
    </div>
  )
}

function QuotaUsagePanel(props: {
  title: string
  used: bigint
  limit: bigint | null
  remaining: bigint
  description: string
  premium?: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  // Preserve over-allocation percentages in text; only the visual bar is clamped.
  let percent: number | null = null
  if (props.limit !== null && props.limit > 0n) {
    percent = Number((props.used * 10000n) / props.limit) / 100
  } else if (props.limit === 0n && props.used === 0n) {
    percent = 0
  }
  let percentLabel = t('Unlimited')
  if (percent !== null) {
    percentLabel = t('{{percent}}% used', {
      percent: formatNumber(percent, locale),
    })
  } else if (props.limit === 0n) {
    percentLabel = t('Over quota')
  }
  const formattedRemaining =
    props.limit === null
      ? t('Unlimited')
      : formatPremiumQuota(props.remaining.toString())
  const formattedLimit =
    props.limit === null
      ? t('Unlimited')
      : formatPremiumQuota(props.limit.toString())
  const formattedUsed = formatPremiumQuota(props.used.toString())
  let usageColor = {
    text: 'text-emerald-500',
    progress: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
  }
  if (props.limit === null) {
    usageColor = { text: 'text-muted-foreground', progress: '' }
  } else if (percent === null || percent >= 80) {
    usageColor = {
      text: 'text-red-500',
      progress: '[&_[data-slot=progress-indicator]]:bg-red-500',
    }
  } else if (percent >= 50) {
    usageColor = {
      text: 'text-amber-500',
      progress: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    }
  }

  return (
    <div
      className={cn(
        'min-w-0 space-y-3 rounded-xl border p-4',
        props.premium
          ? 'border-violet-500/15 bg-violet-500/5'
          : 'border-sky-500/15 bg-sky-500/5'
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <span className='font-medium'>{props.title}</span>
        <span className={cn('font-medium tabular-nums', usageColor.text)}>
          {percentLabel}
        </span>
      </div>
      <QuotaDetailsPopover
        title={props.title}
        triggerLabel={`${props.title} · ${t('Remaining')} ${formattedRemaining}`}
        details={[
          { label: t('Used'), value: formattedUsed },
          { label: t('Total Quota'), value: formattedLimit },
          { label: t('Remaining'), value: formattedRemaining },
        ]}
        description={props.description}
      >
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground text-sm'>
            {t('Remaining')}
          </span>
          <span className='text-2xl font-semibold tracking-tight break-all tabular-nums'>
            {formattedRemaining}
          </span>
        </span>
      </QuotaDetailsPopover>
      {props.limit !== null && (
        <Progress
          value={Math.min(100, Math.max(0, percent ?? 100))}
          aria-label={props.title}
          aria-valuetext={percentLabel}
          className={cn(
            '[&_[data-slot=progress-track]]:h-2',
            usageColor.progress
          )}
        />
      )}
      <div className='text-muted-foreground flex flex-wrap justify-between gap-1 text-sm tabular-nums'>
        <span>
          {t('Used')} {formattedUsed}
        </span>
        <span>
          {t('Total Quota')} {formattedLimit}
        </span>
      </div>
    </div>
  )
}
