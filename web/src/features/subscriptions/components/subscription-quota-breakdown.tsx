import {
  CircleQuestionMark,
  Info,
  Layers,
  Sparkles,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { IconBadge } from '@/components/ui/icon-badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
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
  const totalUsedPercent =
    total > 0n ? Number((used * 10000n) / total) / 100 : 0
  const ringPercent = Math.min(100, Math.max(0, totalUsedPercent))
  let ringColor = 'text-emerald-500'
  if (totalUsedPercent >= 80) {
    ringColor = 'text-red-500'
  } else if (totalUsedPercent >= 50) {
    ringColor = 'text-amber-500'
  }

  return (
    <div
      className={cn(
        'grid gap-5',
        split &&
          'lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.8fr)] lg:gap-x-16 lg:px-4'
      )}
    >
      {split && (
        <div className='flex min-w-0 flex-col items-center justify-center'>
          <p className='flex items-center gap-2 text-sm font-medium'>
            <IconBadge size='sm' tone='primary'>
              <Wallet />
            </IconBadge>
            {t('Remaining subscription quota')}
          </p>
          <div className='relative mt-4 mb-3 aspect-square w-48 max-w-full'>
            <svg
              viewBox='0 0 200 200'
              className='size-full -rotate-90'
              aria-hidden='true'
            >
              <circle
                cx='100'
                cy='100'
                r='90'
                fill='none'
                stroke='currentColor'
                strokeWidth='8'
                className='text-muted'
              />
              <circle
                cx='100'
                cy='100'
                r='90'
                pathLength='100'
                fill='none'
                stroke='currentColor'
                strokeWidth='8'
                strokeLinecap='round'
                strokeDasharray={`${ringPercent} 100`}
                className={cn(ringColor, ringPercent === 0 && 'opacity-0')}
              />
            </svg>
            <div className='absolute inset-7 flex flex-col items-center justify-center gap-1 text-center'>
              <span className='text-muted-foreground text-sm'>
                {t('Remaining')}
              </span>
              <span className='w-full text-2xl font-semibold tracking-tight break-all tabular-nums'>
                {formatPremiumQuota(remaining.toString())}
              </span>
            </div>
          </div>
          <p className={cn('text-sm font-medium tabular-nums', ringColor)}>
            {t('{{percent}}% used', {
              percent: formatNumber(totalUsedPercent, locale),
            })}
          </p>
          <dl className='grid w-full grid-cols-2 gap-3 pt-4 text-center text-sm tabular-nums'>
            <div className='space-y-1'>
              <dt className='text-muted-foreground'>{t('Used')}</dt>
              <dd className='font-medium break-all'>
                {formatPremiumQuota(used.toString())}
              </dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground'>{t('Total Quota')}</dt>
              <dd className='font-medium break-all'>
                {formatPremiumQuota(total.toString())}
              </dd>
            </div>
          </dl>
          <p className='text-muted-foreground mt-4 flex items-center justify-center gap-1 text-center text-[13px] leading-relaxed'>
            <Info className='size-3.5 shrink-0' aria-hidden='true' />
            <span>
              {t(
                'Shared by basic and advanced models. Advanced models have an additional quota limit.'
              )}
            </span>
          </p>
        </div>
      )}
      <div
        className={cn(
          'flex min-w-0 flex-col self-stretch',
          split && 'lg:pb-1.5 lg:pl-4'
        )}
      >
        <QuotaUsagePanel
          title={split ? t('Basic quota') : t('Total Quota')}
          icon={split ? <Layers /> : <Wallet />}
          used={split ? basicUsed : used}
          limit={displayedLimit}
          remaining={split ? basicRemaining : remaining}
          description={
            split
              ? t(
                  'Basic quota is total quota minus the advanced quota limit. Basic models can also use the remaining subscription quota.'
                )
              : reservationNote
          }
        />
        {split && (
          <div className='flex min-h-12 flex-1 items-center px-5 sm:px-6'>
            <Separator className='border-t border-dashed bg-transparent' />
          </div>
        )}
        {split && (
          <QuotaUsagePanel
            title={t('Advanced quota')}
            icon={<Sparkles />}
            allocationPercent={quota.effective_percent}
            used={premiumUsed}
            limit={premiumLimit}
            remaining={BigInt(quota.premium_available)}
            description={t(
              'Advanced model usage counts toward total quota. Available amount is limited by both the advanced quota limit and the remaining subscription quota.'
            )}
          />
        )}
      </div>
      {quota && !quota.enabled && (
        <p className='text-muted-foreground border-t px-5 py-3 text-xs sm:px-6'>
          {t('Premium quota limit is disabled')}
        </p>
      )}
    </div>
  )
}

function QuotaUsagePanel(props: {
  title: string
  icon: ReactNode
  allocationPercent?: number
  used: bigint
  limit: bigint | null
  remaining: bigint
  description: string
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
    <div className='bg-muted/20 flex min-w-0 shrink-0 flex-col gap-3 rounded-2xl'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2 text-base font-medium'>
          <IconBadge size='sm' tone='primary'>
            {props.icon}
          </IconBadge>
          <div className='flex items-center gap-1.5'>
            <span>{props.title}</span>
            {props.allocationPercent !== undefined && (
              <span className='text-muted-foreground text-sm font-normal tabular-nums'>
                {t('Share {{percent}}%', {
                  percent: formatNumber(props.allocationPercent, locale),
                })}
              </span>
            )}
            <QuotaDetailsPopover
              title={props.title}
              triggerLabel={`${props.title} · ${t('Details')}`}
              details={[
                { label: t('Used'), value: formattedUsed },
                { label: t('Total Quota'), value: formattedLimit },
                { label: t('Remaining'), value: formattedRemaining },
              ]}
              description={props.description}
              className='w-auto'
              triggerClassName='text-muted-foreground size-5 shrink-0 justify-center p-0 hover:text-foreground'
            >
              <CircleQuestionMark
                className='size-3.5 translate-y-px'
                aria-hidden='true'
              />
            </QuotaDetailsPopover>
          </div>
        </div>
        <span
          className={cn('text-sm font-medium tabular-nums', usageColor.text)}
        >
          {percentLabel}
        </span>
      </div>
      <div className='grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4'>
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground text-base'>
            {t('Remaining')}
          </span>
          <span className='text-2xl font-semibold tracking-tight break-all tabular-nums'>
            {formattedRemaining}
          </span>
        </span>
        <dl className='space-y-2 text-right text-sm tabular-nums'>
          <div className='flex flex-wrap justify-end gap-x-2 gap-y-1'>
            <dt className='text-muted-foreground'>{t('Used')}</dt>
            <dd className='break-all'>{formattedUsed}</dd>
          </div>
          <div className='flex flex-wrap justify-end gap-x-2 gap-y-1'>
            <dt className='text-muted-foreground'>{t('Total Quota')}</dt>
            <dd className='break-all'>{formattedLimit}</dd>
          </div>
        </dl>
      </div>
      <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
        {props.limit !== null && (
          <Progress
            value={Math.min(100, Math.max(0, percent ?? 100))}
            aria-label={props.title}
            aria-valuetext={percentLabel}
            className={cn(
              'min-w-20 flex-1 [&_[data-slot=progress-track]]:h-1.5',
              usageColor.progress
            )}
          />
        )}
      </div>
    </div>
  )
}
