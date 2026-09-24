import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { TokenBreakdownTooltipContent } from '@/components/token-breakdown-tooltip-content'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatLogQuota } from '@/lib/format'
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
  const { isAdminView: isAdmin } = useLogsViewScope()
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
  const [tokenTooltipOpen, setTokenTooltipOpen] = useState(false)
  const { sensitiveVisible } = useUsageLogsContext()
  const params = useMemo(() => {
    const hasTimeParams = searchParams.startTime ?? searchParams.endTime
    return buildApiParams({
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
  }, [searchParams, defaultTimeRange, isAdmin])

  const {
    data: stats,
    isLoading,
    isFetching,
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

  const tokenStats = useQuery({
    queryKey: ['usage-logs-stats', 'quota-tokens', isAdmin, params],
    queryFn: async ({ signal }) => {
      const detailParams = { ...params, token_breakdown: true }
      const result = isAdmin
        ? requireServerSuccess(await getLogStats(detailParams, signal))
        : requireServerSuccess(await getUserLogStats(detailParams, signal))
      return result.data || DEFAULT_LOG_STATS
    },
    enabled: tokenTooltipOpen && !!stats && !isFetching,
    staleTime: 60_000,
    retry: false,
    meta: { errorToast: false },
  })

  const tokenValue = `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((stats?.total_tokens ?? 0) / 100_000_000)} ${t('100M')}`
  let tokenDetails: ReactNode = <LoadingState className='min-h-24' size='sm' />
  if (tokenStats.data) {
    tokenDetails = (
      <TokenBreakdownTooltipContent
        totalTokens={tokenStats.data.total_tokens}
        inputTokens={tokenStats.data.uncached_input_tokens ?? 0}
        outputTokens={tokenStats.data.uncached_output_tokens ?? 0}
        cacheReadTokens={tokenStats.data.cache_read_tokens ?? 0}
        cacheWriteTokens={tokenStats.data.cache_write_tokens ?? 0}
      />
    )
  } else if (tokenStats.isError) {
    tokenDetails = (
      <ErrorState
        className='min-h-24 border-0 p-2'
        onRetry={() => void tokenStats.refetch()}
      />
    )
  }

  if (isLoading) {
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
        <Skeleton className='h-7 w-[150px] rounded-md' />
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
        value={stats?.rpm || 0}
        accent='bg-rose-500/65'
      />
      <StatBadge
        label={t('TPM')}
        value={stats?.tpm || 0}
        accent='bg-slate-400/70'
      />
      <TooltipProvider delay={100}>
        <Tooltip open={tokenTooltipOpen} onOpenChange={setTokenTooltipOpen}>
          <StatBadge
            label={t('Token')}
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
          <TooltipContent>{tokenDetails}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
