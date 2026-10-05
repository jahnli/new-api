import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatPremiumQuota } from '../lib/premium-quota'
import type { SubscriptionQuotaType, UserSubscriptionRecord } from '../types'

export function SubscriptionQuotaAdjustmentPreview(props: {
  record: UserSubscriptionRecord
  amount: string
  quotaType: SubscriptionQuotaType
  decrease: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const subscription = props.record.subscription
  const quota = props.record.premium_quota
  const amount = Number(props.amount)
  const exchangeRate =
    Number.isFinite(currency.usdExchangeRate) && currency.usdExchangeRate > 0
      ? currency.usdExchangeRate
      : 1
  // This is an estimate using the same CNY conversion and upward rounding as
  // the server. The server validates current usage and settles the final value.
  const delta = Math.ceil((amount / exchangeRate) * currency.quotaPerUnit)
  let totalAfter: bigint | null = null
  let premiumAfter: bigint | null = null
  let percentAfter: number | null = null
  const safeTotal = Number.isSafeInteger(subscription.amount_total)
  const totalBefore = safeTotal ? BigInt(subscription.amount_total) : null
  const premiumBefore = quota ? BigInt(quota.premium_limit) : null
  const hasAmount = props.amount.trim() !== ''
  if (
    safeTotal &&
    totalBefore !== null &&
    totalBefore >= 0n &&
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isSafeInteger(delta) &&
    delta > 0
  ) {
    const signedDelta = props.decrease ? -BigInt(delta) : BigInt(delta)
    const total = totalBefore + signedDelta
    let valid = total > 0n && total <= BigInt(Number.MAX_SAFE_INTEGER)
    if (props.decrease) {
      valid = valid && total >= BigInt(subscription.amount_used)
    }
    if (valid && quota?.enabled && premiumBefore !== null) {
      let basisPoints = BigInt(Math.round(quota.effective_percent * 100))
      if (props.quotaType !== 'total') {
        let targetPremium = premiumBefore
        if (props.quotaType === 'premium') targetPremium += signedDelta
        valid = targetPremium >= 0n && targetPremium <= total
        if (valid) {
          // Positive decimal rounding to two percentage places, then floor the
          // category quota, matching the server's basis-point calculation.
          basisPoints = (targetPremium * 20000n + total) / (2n * total)
          if (props.decrease) {
            const premiumUsed = BigInt(quota.premium_amount_used)
            const basicUsed = BigInt(subscription.amount_used) - premiumUsed
            if (props.quotaType === 'premium') {
              valid = targetPremium >= premiumUsed
            } else {
              valid = total - targetPremium >= basicUsed
            }
          }
          const roundedPremium = (total * basisPoints) / 10000n
          const premiumUsed = BigInt(quota.premium_amount_used)
          const basicBefore = totalBefore - premiumBefore
          const basicUsed = BigInt(subscription.amount_used) - premiumUsed
          const premiumFloor =
            premiumBefore < premiumUsed ? premiumBefore : premiumUsed
          const basicFloor = basicBefore < basicUsed ? basicBefore : basicUsed
          valid =
            valid &&
            roundedPremium >= premiumFloor &&
            total - roundedPremium >= basicFloor
        }
      }
      if (valid) {
        premiumAfter = (total * basisPoints) / 10000n
        percentAfter = Number(basisPoints) / 100
      }
    }
    if (valid) totalAfter = total
  }

  const rows = [
    {
      label: t('Total Quota'),
      before:
        totalBefore !== null && totalBefore > 0n
          ? formatPremiumQuota(totalBefore.toString())
          : t('Unlimited'),
      after:
        totalAfter === null ? '—' : formatPremiumQuota(totalAfter.toString()),
      increased:
        totalAfter !== null && totalBefore !== null && totalAfter > totalBefore,
      decreased:
        totalAfter !== null && totalBefore !== null && totalAfter < totalBefore,
    },
  ]
  if (quota?.enabled && premiumBefore !== null) {
    rows.push(
      {
        label: t('Premium model quota'),
        before: formatPremiumQuota(premiumBefore.toString()),
        after:
          premiumAfter === null
            ? '—'
            : formatPremiumQuota(premiumAfter.toString()),
        increased: premiumAfter !== null && premiumAfter > premiumBefore,
        decreased: premiumAfter !== null && premiumAfter < premiumBefore,
      },
      {
        label: t('Premium percentage'),
        before: `${formatNumber(quota.effective_percent, locale)}%`,
        after:
          percentAfter === null
            ? '—'
            : `${formatNumber(percentAfter, locale)}%`,
        increased:
          percentAfter !== null && percentAfter > quota.effective_percent,
        decreased:
          percentAfter !== null && percentAfter < quota.effective_percent,
      }
    )
  }

  return (
    <div
      className='bg-primary/5 space-y-3 rounded-lg border p-4'
      aria-live='polite'
      aria-atomic='true'
    >
      <h4 className='text-sm font-medium'>{t('Preview')}</h4>
      <dl className='space-y-2 text-sm'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='flex flex-wrap items-center justify-between gap-2'
          >
            <dt className='text-muted-foreground'>{row.label}</dt>
            <dd className='flex items-center gap-2 tabular-nums'>
              <span className='text-muted-foreground'>{row.before}</span>
              <ArrowRight className='size-3.5' aria-hidden='true' />
              <span
                className={cn('inline-flex items-center gap-1 font-semibold', {
                  'text-success': row.increased,
                  'text-warning': row.decreased,
                })}
              >
                {row.increased && (
                  <ArrowUp className='size-3.5' aria-hidden='true' />
                )}
                {row.decreased && (
                  <ArrowDown className='size-3.5' aria-hidden='true' />
                )}
                {row.increased && (
                  <span className='sr-only'>{t('Increase quota')}</span>
                )}
                {row.decreased && (
                  <span className='sr-only'>{t('Decrease quota')}</span>
                )}
                {row.after}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {hasAmount && totalAfter === null && (
        <p className='text-destructive text-xs'>
          {props.decrease
            ? t(
                'Enter the CNY amount to deduct. The total quota cannot be lower than the used quota.'
              )
            : t('Please enter a valid amount')}
        </p>
      )}
    </div>
  )
}
