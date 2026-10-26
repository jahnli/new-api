import type { QuotaDataItem } from '@/features/dashboard/types'

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (isNaN(result) || !isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(data: QuotaDataItem[]) {
  return data.reduce(
    (acc, item) => ({
      totalQuota: acc.totalQuota + (Number(item.quota) || 0),
      totalCount: acc.totalCount + (Number(item.count) || 0),
      totalTokens:
        acc.totalTokens +
        (Number(item.uncached_input_tokens) || 0) +
        (Number(item.uncached_output_tokens) || 0) +
        (Number(item.cache_read_tokens) || 0) +
        (Number(item.cache_write_tokens) || 0),
      totalCacheReadTokens:
        acc.totalCacheReadTokens +
        Math.max(0, Number(item.cache_read_tokens) || 0),
      totalCacheWriteTokens:
        acc.totalCacheWriteTokens +
        Math.max(0, Number(item.cache_write_tokens) || 0),
    }),
    {
      totalQuota: 0,
      totalCount: 0,
      totalTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
    }
  )
}
