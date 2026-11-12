import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleHelp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DescriptionTooltip } from '@/components/description-tooltip'
import { ErrorState } from '@/components/error-state'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { TextTooltip } from '@/components/text-tooltip'
import { TokenBreakdownTooltipContent } from '@/components/token-breakdown-tooltip-content'
import { Button } from '@/components/ui/button'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import { calculateDashboardStats } from '@/features/dashboard/lib/stats'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { useStatus } from '@/hooks/use-status'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import {
  getDateTimePresetRange,
  type DateTimePresetKind,
  type DateTimePresetRange,
} from '@/lib/date-time-presets'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'
import { useAuthStore } from '@/stores/auth-store'

import { StatCard } from '../ui/stat-card'
import { TopModelsSummary } from './top-models-summary'

function buildSummarySparklines(
  data: QuotaDataItem[],
  range: DateTimePresetRange,
  preset: DateTimePresetKind
) {
  let granularity: 'hour' | 'day' | 'month' = 'day'
  if (preset === 'lastHour' || preset === 'today' || preset === 'yesterday') {
    granularity = 'hour'
  } else if (
    preset === 'thisHalfYear' ||
    preset === 'lastHalfYear' ||
    preset === 'thisYear' ||
    preset === 'lastYear'
  ) {
    granularity = 'month'
  }

  const start = dayjs(range.start).startOf(granularity)
  const end = dayjs(Math.min(range.end.getTime(), Date.now()))
  const bucketCount = Math.max(1, end.diff(start, granularity) + 1)
  const buckets = Array.from(
    { length: bucketCount },
    () => [] as QuotaDataItem[]
  )

  for (const item of data) {
    const index = dayjs
      .unix(item.created_at)
      .startOf(granularity)
      .diff(start, granularity)
    if (index >= 0 && index < bucketCount) buckets[index].push(item)
  }

  const stats = buckets.map(calculateDashboardStats)
  return {
    tokens: stats.map((bucket) => bucket.totalTokens),
    quota: stats.map((bucket) => bucket.totalQuota),
    avgPrice: stats.map((bucket) =>
      calculateUnitPricePer100MTokens(bucket.totalQuota, bucket.totalTokens)
    ),
    count: stats.map((bucket) => bucket.totalCount),
  }
}

export function SummaryUsageCards() {
  const { t, i18n } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const { loading: statusLoading } = useStatus()
  const [selection, setSelection] = useState(() => ({
    preset: 'today' as DateTimePresetKind,
    range: getDateTimePresetRange('today'),
  }))
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const startTimestamp = Math.floor(selection.range.start.getTime() / 1000)
  const endTimestamp = Math.floor(selection.range.end.getTime() / 1000)

  const usageQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'usage',
      userId,
      startTimestamp,
      endTimestamp,
    ],
    queryFn: async ({ signal }) =>
      requireServerSuccess(
        await getUserQuotaDates(
          {
            start_timestamp: startTimestamp,
            end_timestamp: endTimestamp,
            default_time: 'hour',
          },
          false,
          signal
        )
      ),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  })

  const stats = useMemo(
    () => calculateDashboardStats(usageQuery.data?.data ?? []),
    [usageQuery.data?.data]
  )
  const sparklines = useMemo(
    () =>
      buildSummarySparklines(
        usageQuery.data?.data ?? [],
        selection.range,
        selection.preset
      ),
    [selection, usageQuery.data?.data]
  )
  const currencyFormatOptions = {
    fixedFractionDigits: 2,
    abbreviate: false,
    locale,
  }
  const items = useSummaryCardsConfig({
    tokenCountDisplay:
      stats.totalTokens > 0
        ? `${formatNumber(stats.totalTokens / 100_000_000, locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${t('100M')}`
        : '0',
    costDisplay: formatQuotaWithCurrency(
      stats.totalQuota,
      currencyFormatOptions
    ),
    unitPriceDisplay:
      stats.totalTokens > 0
        ? `${formatQuotaWithCurrency(
            calculateUnitPricePer100MTokens(
              stats.totalQuota,
              stats.totalTokens
            ),
            currencyFormatOptions
          )}/${t('100M Tokens')}`
        : '—',
    requestCountDisplay: formatNumber(stats.totalCount, locale, {
      notation: stats.totalCount >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: 2,
    }).replace(/^([\d.,]+)(?=\p{Script=Han})/u, '$1 '),
  })

  return (
    <div className='flex min-w-0 flex-col gap-3 p-4 sm:p-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-1'>
          <h3 className='text-base font-semibold'>{t('Usage at a glance')}</h3>
          <DescriptionTooltip
            description={t('Usage is aggregated hourly and may be delayed.')}
            icon={CircleHelp}
          />
        </div>
        <div className='ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2'>
          <p className='text-muted-foreground text-xs tabular-nums sm:text-sm'>
            {dayjs(selection.range.start).format('YYYY/MM/DD HH:mm')} —{' '}
            {dayjs(selection.range.end).format('YYYY/MM/DD HH:mm')}
          </p>
          <CompactDateTimeRangePicker
            presetDisplay='select'
            preset={selection.preset}
            start={selection.range.start}
            end={selection.range.end}
            className='shrink-0'
            onChange={(range, preset) => {
              if (!preset || !range.start || !range.end) return
              setSelection({
                preset,
                range: { start: range.start, end: range.end },
              })
            }}
          />
        </div>
      </div>
      <StaggerContainer
        className='grid grid-cols-2 gap-3 2xl:grid-cols-4'
        aria-busy={usageQuery.isPending}
      >
        {items.map((item, index) => {
          const tones = [
            'accent-1',
            'accent-2',
            'accent-3',
            'accent-1',
          ] as const
          return (
            <StaggerItem
              key={item.key}
              className='bg-background/60 min-w-0 rounded-xl border p-3'
            >
              <StatCard
                title={item.title}
                value={
                  item.key === 'tokens' ? (
                    <span className='inline-flex items-baseline gap-1.5'>
                      {item.value}
                      <TextTooltip
                        content={
                          <TokenBreakdownTooltipContent
                            totalTokens={stats.totalTokens}
                            inputTokens={stats.totalInputTokens}
                            outputTokens={stats.totalOutputTokens}
                            cacheReadTokens={stats.totalCacheReadTokens}
                            cacheWriteTokens={stats.totalCacheWriteTokens}
                          />
                        }
                      >
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-xs'
                          className='text-muted-foreground size-5 -translate-y-2'
                          aria-label={t('View details')}
                        >
                          <CircleAlert className='size-3' aria-hidden='true' />
                        </Button>
                      </TextTooltip>
                    </span>
                  ) : (
                    item.value
                  )
                }
                description={item.description}
                icon={item.icon}
                iconTone={item.iconTone}
                tone={tones[index]}
                sparkline={
                  usageQuery.isError ? undefined : sparklines[item.key]
                }
                sparklineVariant='line'
                loading={statusLoading || usageQuery.isPending}
                error={usageQuery.isError}
              />
            </StaggerItem>
          )
        })}
      </StaggerContainer>
      {!usageQuery.isError && (
        <TopModelsSummary
          data={usageQuery.data?.data}
          loading={usageQuery.isPending}
        />
      )}
      {usageQuery.isError && (
        <ErrorState
          className='min-h-0 p-3'
          description={getServerErrorMessage(usageQuery.error)}
          onRetry={() => void usageQuery.refetch()}
        />
      )}
    </div>
  )
}
