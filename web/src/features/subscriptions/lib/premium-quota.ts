import { t } from 'i18next'

import { formatQuota } from '@/lib/format'

// Only pass exactly representable integers to the existing currency formatter.
export function formatPremiumQuota(value: string): string {
  if (!/^\d+$/.test(value)) return '—'
  const quota = BigInt(value)
  if (quota > BigInt(Number.MAX_SAFE_INTEGER)) {
    return `${quota.toLocaleString()} ${t('Quota')}`
  }
  return formatQuota(Number(quota))
}
