import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'

import { formatPremiumQuota } from '../lib/premium-quota'
import type { PremiumQuota } from '../premium-api'

export function PremiumQuotaSummary(props: { quota?: PremiumQuota }) {
  const { t } = useTranslation()
  const quota = props.quota
  if (!quota) return null
  const used = BigInt(quota.premium_amount_used)
  const limit = BigInt(quota.premium_limit)
  let percent = used > 0n ? 100 : 0
  if (limit > 0n) {
    const calculated = (used * 100n) / limit
    percent = calculated > 100n ? 100 : Number(calculated)
  }
  return (
    <div className='space-y-2 rounded-md border p-3 text-xs'>
      <div className='flex flex-wrap justify-between gap-2'>
        <span>{t('Premium model quota')}</span>
        <span>
          {quota.effective_percent}% ·{' '}
          {quota.percent_source === 'user'
            ? t('User override')
            : t('System default')}
        </span>
      </div>
      <div>
        {formatPremiumQuota(quota.premium_amount_used)} /{' '}
        {formatPremiumQuota(quota.premium_limit)}
      </div>
      <Progress value={percent} aria-label={t('Premium model quota')} />
      <div>
        {quota.enabled
          ? t('Premium quota available: {{amount}}', {
              amount: formatPremiumQuota(quota.premium_available),
            })
          : t('Premium quota limit is disabled')}
      </div>
      <p className='text-muted-foreground'>
        {t('Quota usage includes pending request reservations.')}
      </p>
    </div>
  )
}
