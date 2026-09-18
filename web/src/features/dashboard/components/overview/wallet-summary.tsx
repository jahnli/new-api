import { Flame, ShieldCheck, TrendingDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

interface WalletSummaryProps {
  remainQuota: number
  recentUsage: number
  loading: boolean
  usagePending: boolean
  usageError: boolean
  onRetry: () => void
}

export function WalletSummary(props: WalletSummaryProps) {
  const { t } = useTranslation()
  if (props.loading) return <LoadingState className='min-h-32' />

  const usageReady = !props.usagePending && !props.usageError
  // Like upstream, estimate from total recent usage, including subscriptions.
  let runwayDays: number | null = null
  if (usageReady && props.remainQuota > 0 && props.recentUsage > 0) {
    const days = props.remainQuota / props.recentUsage
    if (Number.isFinite(days)) runwayDays = days
  }
  let healthLabel = t('Healthy')
  let healthClass = 'text-foreground'
  let dotClass = 'bg-success'
  let runwayDisplay = t('No recent usage')
  if (props.remainQuota <= 0) {
    healthLabel = t('Balance depleted')
    healthClass = 'text-destructive'
    dotClass = 'bg-destructive'
    runwayDisplay = t('Balance depleted')
  } else if (runwayDays !== null) {
    if (runwayDays < 3) {
      healthLabel = t('Low balance')
      healthClass = 'text-warning'
      dotClass = 'bg-warning'
    }
    if (runwayDays < 1) {
      runwayDisplay = t('Less than 1 day left')
    } else if (runwayDays > 999) {
      runwayDisplay = `999+ ${t('days')}`
    } else {
      runwayDisplay = `~${formatNumber(Math.floor(runwayDays))} ${t('days')}`
    }
  }

  return (
    <div className='flex flex-col gap-2 sm:gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {t('Credit remaining')}
        </span>
        {(usageReady || props.remainQuota <= 0) && (
          <span className='flex items-center gap-1.5'>
            <span
              className={cn('size-1.5 rounded-full', dotClass)}
              aria-hidden='true'
            />
            <span className='text-muted-foreground text-[11px] font-medium'>
              {healthLabel}
            </span>
          </span>
        )}
      </div>
      <div className='font-mono text-xl font-semibold tracking-tight break-all sm:text-2xl'>
        {formatQuota(props.remainQuota)}
      </div>
      {props.usagePending && (
        <LoadingState inline size='sm' message={t('Loading...')} />
      )}
      {props.usageError && (
        <ErrorState className='min-h-0 p-0' onRetry={props.onRetry} />
      )}
      {usageReady && (
        <div className='grid grid-cols-2 gap-2'>
          <div className='bg-background/60 rounded-lg px-2.5 py-2'>
            <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
              <Flame className='size-3 shrink-0' aria-hidden='true' />
              <span>{t('Last 24h usage')}</span>
            </div>
            <div className='text-foreground mt-1.5 text-xs font-semibold break-words tabular-nums'>
              {formatQuota(props.recentUsage)}
            </div>
          </div>
          <div className='bg-background/60 rounded-lg px-2.5 py-2'>
            <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
              {runwayDays !== null && runwayDays < 3 ? (
                <TrendingDown className='size-3 shrink-0' aria-hidden='true' />
              ) : (
                <ShieldCheck className='size-3 shrink-0' aria-hidden='true' />
              )}
              <span>{t('Runway')}</span>
            </div>
            <div
              className={cn(
                'mt-1.5 text-xs font-semibold tabular-nums',
                healthClass
              )}
            >
              {runwayDisplay}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
