import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { TokenBreakdownTooltipContent } from '@/components/token-breakdown-tooltip-content'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
} from '@/lib/currency'
import { formatLogQuota, formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams, getDefaultTimeRange } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  value: ReactNode
  accent: string
  suffix?: ReactNode
}) {
  return (
    <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs'>
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
      {props.suffix}
    </span>
  )
}

export function CommonLogsStats() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { isAdminView: isAdmin, isRootView } = useLogsViewScope()
  const searchParams = route.useSearch({
    select: (search) => ({
      startTime: search.startTime,
      endTime: search.endTime,
      model: search.model,
      group: search.group,
      username: search.username,
      channel: search.channel,
      userCategory: search.userCategory,
    }),
    structuralSharing: true,
  })
  const [defaultTimeRange] = useState(getDefaultTimeRange)
  const { sensitiveVisible } = useUsageLogsContext()
  const params = useMemo(() => {
    const hasTimeParams = searchParams.startTime ?? searchParams.endTime
    const apiParams = buildApiParams({
      page: 1,
      pageSize: 1,
      searchParams: hasTimeParams
        ? searchParams
        : {
            ...searchParams,
            startTime: defaultTimeRange.start.getTime(),
            endTime: defaultTimeRange.end.getTime(),
          },
      columnFilters: [],
      isAdmin,
    })
    // Token details and the cache hit rate are root-only badges, so only that
    // view asks the statistics endpoint for the token breakdown.
    return isRootView ? { ...apiParams, token_breakdown: true } : apiParams
  }, [searchParams, defaultTimeRange, isAdmin, isRootView])

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['usage-logs-stats', 'quota-summary', isAdmin, params],
    queryFn: async ({ signal }) => {
      const result = isAdmin
        ? requireServerSuccess(await getLogStats(params, signal))
        : requireServerSuccess(await getUserLogStats(params, signal))

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
  })

  const totalTokens = stats?.total_tokens ?? 0
  const cacheReadTokens = stats?.cache_read_tokens ?? 0
  const totalInputTokens =
    (stats?.uncached_input_tokens ?? 0) +
    cacheReadTokens +
    (stats?.cache_write_tokens ?? 0)
  const tokenValue = `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalTokens / 100_000_000)} ${t('100M')}`
  let averagePricePerMillionTokens = '-'
  if (!sensitiveVisible) {
    averagePricePerMillionTokens = '••••'
  } else if (totalTokens > 0) {
    const { config } = getCurrencyDisplay()
    const averagePriceUSD =
      ((stats?.quota ?? 0) * 1_000_000) / config.quotaPerUnit / totalTokens
    averagePricePerMillionTokens = formatBillingCurrencyFromUSD(
      averagePriceUSD,
      {
        fixedFractionDigits: 2,
        abbreviate: false,
        locale,
      }
    )
  }
  // Cache writes count as misses, matching the data overview definition.
  const cacheHitRate =
    totalInputTokens > 0
      ? `${((cacheReadTokens / totalInputTokens) * 100).toFixed(1)}%`
      : '-'

  if (isLoading) {
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
        {isRootView && (
          <>
            <Skeleton className='h-7 w-[150px] rounded-md' />
            <Skeleton className='h-7 w-[100px] rounded-md' />
            <Skeleton className='h-7 w-[110px] rounded-md' />
          </>
        )}
      </div>
    )
  }

  if (isError && !stats) {
    return <ErrorState className='min-h-24' onRetry={() => void refetch()} />
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••'}
        accent='bg-sky-500/70'
      />
      <StatBadge
        label={t('RPM')}
        value={formatNumber(stats?.rpm || 0, locale)}
        accent='bg-rose-500/65'
      />
      <StatBadge
        label={t('TPM')}
        value={formatNumber(stats?.tpm || 0, locale)}
        accent='bg-slate-400/70'
      />
      {isRootView && (
        <>
          <Tooltip>
            <StatBadge
              label={t('Tokens')}
              value={tokenValue}
              accent='bg-emerald-500/70'
              suffix={
                <TooltipTrigger
                  render={
                    <button
                      type='button'
                      className='text-muted-foreground/70 hover:text-foreground shrink-0 transition-colors'
                      aria-label={t('View details')}
                    />
                  }
                >
                  <CircleAlert className='size-3 sm:size-3.5' />
                </TooltipTrigger>
              }
            />
            <TooltipContent>
              <TokenBreakdownTooltipContent
                totalTokens={totalTokens}
                inputTokens={stats?.uncached_input_tokens ?? 0}
                outputTokens={stats?.uncached_output_tokens ?? 0}
                cacheReadTokens={cacheReadTokens}
                cacheWriteTokens={stats?.cache_write_tokens ?? 0}
              />
            </TooltipContent>
          </Tooltip>
          <StatBadge
            label={t('Unit Price')}
            value={averagePricePerMillionTokens}
            accent='bg-amber-500/70'
          />
          <StatBadge
            label={t('Hit Rate')}
            value={cacheHitRate}
            accent='bg-indigo-500/70'
          />
        </>
      )}
    </div>
  )
}
