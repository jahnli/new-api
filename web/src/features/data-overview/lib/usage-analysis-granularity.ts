import type { DailyStat, ModelDailyStat } from '../types'

export type UsageTimeGranularity = 'day' | 'week' | 'month'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDate(date: string): Date | null {
  const match = DATE_PATTERN.exec(date)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getBucketDate(
  date: string,
  granularity: UsageTimeGranularity
): string {
  if (granularity === 'day') return date

  const parsed = parseDate(date)
  if (!parsed) return date

  if (granularity === 'month') {
    parsed.setUTCDate(1)
    return formatDate(parsed)
  }

  const daysAfterMonday = (parsed.getUTCDay() + 6) % 7
  parsed.setUTCDate(parsed.getUTCDate() - daysAfterMonday)
  return formatDate(parsed)
}

export function formatUsageBucketLabel(
  date: string,
  granularity: UsageTimeGranularity
): string {
  const parsed = parseDate(date)
  if (!parsed) return date

  if (granularity === 'month') return date.slice(0, 7)
  if (granularity === 'day') return date.slice(5)

  const end = new Date(parsed)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${date.slice(5)} – ${formatDate(end).slice(5)}`
}

export function aggregateDailyStats(
  data: DailyStat[],
  granularity: UsageTimeGranularity
): DailyStat[] {
  const buckets = new Map<string, DailyStat>()

  for (const item of data) {
    const date = getBucketDate(item.date, granularity)
    const existing = buckets.get(date)

    if (existing) {
      existing.total_tokens += item.total_tokens
      existing.total_quota += item.total_quota
      existing.total_requests += item.total_requests
      continue
    }

    buckets.set(date, {
      date,
      total_tokens: item.total_tokens,
      total_quota: item.total_quota,
      total_requests: item.total_requests,
    })
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function aggregateModelDailyStats(
  data: ModelDailyStat[],
  granularity: UsageTimeGranularity
): ModelDailyStat[] {
  const buckets = new Map<string, ModelDailyStat>()

  for (const item of data) {
    const date = getBucketDate(item.date, granularity)
    const key = `${date}\u0000${item.model_name}`
    const existing = buckets.get(key)

    if (existing) {
      existing.total_tokens += item.total_tokens
      if (item.total_quota !== undefined) {
        existing.total_quota = (existing.total_quota ?? 0) + item.total_quota
      }
      continue
    }

    buckets.set(key, {
      date,
      model_name: item.model_name,
      total_tokens: item.total_tokens,
      ...(item.total_quota === undefined
        ? {}
        : { total_quota: item.total_quota }),
    })
  }

  return [...buckets.values()].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date)
    return dateComparison || a.model_name.localeCompare(b.model_name)
  })
}
