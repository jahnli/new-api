import { useQuery } from '@tanstack/react-query'
import { Crown, Clock, CalendarDays, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StatusBadge,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import { CardStaggerItem } from '@/components/page-transition'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import { PremiumQuotaSummary } from '@/features/subscriptions/components/premium-quota-summary'
import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import { formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const SUBSCRIPTION_SKELETON_IDS = ['subscription-1', 'subscription-2'] as const

export function SubscriptionCard() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['subscription-premium', 'self'],
    queryFn: async () => {
      const [plansResponse, selfResponse] = await Promise.all([
        getPublicPlans(),
        getSelfSubscriptionFull(),
      ])
      const plans = requireServerSuccess(plansResponse).data || []
      const subscriptions = requireServerSuccess(selfResponse).data
      return {
        plans,
        active: subscriptions?.subscriptions || [],
        all: subscriptions?.all_subscriptions || [],
        referenceTime: Date.now() / 1000,
      }
    },
  })
  const plans = query.data?.plans
  const activeSubscriptions = query.data?.active || []
  const allSubscriptions = query.data?.all || []
  const referenceTime = query.data?.referenceTime || 0
  const loading = query.isPending

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of plans || []) {
      if (p?.plan?.id) {
        map.set(p.plan.id, p.plan.title || '')
      }
    }
    return map
  }, [plans])

  if (loading) {
    return (
      <CardStaggerItem>
        <TitledCard
          icon={<Crown className='size-4 text-amber-500' />}
          title={t('My Subscriptions')}
        >
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {SUBSCRIPTION_SKELETON_IDS.map((skeletonId) => (
              <div key={skeletonId} className='rounded-xl border p-4'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='mt-3 h-3 w-24' />
                <Skeleton className='mt-2 h-2 w-full' />
              </div>
            ))}
          </div>
        </TitledCard>
      </CardStaggerItem>
    )
  }

  if (allSubscriptions.length === 0) return null

  const hasActive = activeSubscriptions.length > 0
  const expiredCount = allSubscriptions.length - activeSubscriptions.length

  const headerDescription = (
    <span className='flex items-center gap-2'>
      <span className='flex items-center gap-1.5'>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            hasActive ? dotColorMap.success : dotColorMap.neutral
          )}
          aria-hidden='true'
        />
        {hasActive ? (
          <span className={cn(textColorMap.success)}>
            {activeSubscriptions.length} {t('active')}
          </span>
        ) : (
          <span className='text-muted-foreground'>{t('No Active')}</span>
        )}
      </span>
      {expiredCount > 0 && (
        <span className='text-muted-foreground'>
          · {expiredCount} {t('expired')}
        </span>
      )}
    </span>
  )

  return (
    <CardStaggerItem>
      <TitledCard
        icon={<Crown className='size-4 text-amber-500' />}
        title={t('My Subscriptions')}
        description={headerDescription}
      >
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {allSubscriptions.map((sub) => (
            <SubscriptionItem
              key={sub.subscription?.id}
              sub={sub}
              planTitleMap={planTitleMap}
              referenceTime={referenceTime}
            />
          ))}
        </div>
      </TitledCard>
    </CardStaggerItem>
  )
}

function SubscriptionItem({
  sub,
  planTitleMap,
  referenceTime,
}: {
  sub: UserSubscriptionRecord
  planTitleMap: Map<number, string>
  referenceTime: number
}) {
  const { t } = useTranslation()
  const subscription = sub.subscription
  const totalAmount = Number(subscription?.amount_total || 0)
  const usedAmount = Number(subscription?.amount_used || 0)
  const remainAmount =
    totalAmount > 0 ? Math.max(0, totalAmount - usedAmount) : 0
  const planTitle = planTitleMap.get(subscription?.plan_id) || ''
  const endTime = subscription?.end_time || 0
  const nextResetTime = subscription?.next_reset_time ?? 0
  const remainDays = endTime
    ? Math.max(0, Math.ceil((endTime - referenceTime) / 86400))
    : 0
  const usagePercent =
    totalAmount > 0 ? Math.round((usedAmount / totalAmount) * 100) : 0
  const isExpired = endTime < referenceTime
  const isCancelled = subscription?.status === 'cancelled'
  const isActive = subscription?.status === 'active' && !isExpired
  let statusBadge = (
    <StatusBadge
      label={t('Expired')}
      variant='neutral'
      copyable={false}
      className='text-base'
    />
  )
  if (isActive) {
    statusBadge = (
      <StatusBadge
        label={t('Active')}
        variant='success'
        copyable={false}
        className='text-base'
      />
    )
  } else if (isCancelled) {
    statusBadge = (
      <StatusBadge
        label={t('Cancelled')}
        variant='neutral'
        copyable={false}
        className='text-base'
      />
    )
  }

  let endDateLabel = t('Expired at')
  if (isActive) {
    endDateLabel = t('Until')
  } else if (isCancelled) {
    endDateLabel = t('Cancelled at')
  }

  let progressClassName = '[&_[data-slot=progress-indicator]]:bg-red-500'
  if (usagePercent < 50) {
    progressClassName = '[&_[data-slot=progress-indicator]]:bg-emerald-500'
  } else if (usagePercent < 80) {
    progressClassName = '[&_[data-slot=progress-indicator]]:bg-amber-500'
  }

  return (
    <div className='flex min-w-0 flex-col justify-between gap-3 rounded-xl border p-3 sm:p-4'>
      <div>
        <div className='flex items-center justify-between gap-2'>
          <span className='truncate text-base font-medium'>
            {planTitle || `${t('Subscription')} #${subscription?.id}`}
          </span>
          {statusBadge}
        </div>

        <div className='text-muted-foreground mt-2 space-y-1 text-sm'>
          {isActive && (
            <div className='flex items-center gap-1.5'>
              <Clock className='size-3 shrink-0' />
              <span>
                {t('{{count}} days remaining', { count: remainDays })}
              </span>
            </div>
          )}
          <div className='flex items-center gap-1.5'>
            <CalendarDays className='size-3 shrink-0' />
            <span>
              {endDateLabel} {new Date(endTime * 1000).toLocaleDateString()}
            </span>
          </div>
          {isActive && nextResetTime > 0 && (
            <div className='flex items-center gap-1.5'>
              <RefreshCw className='size-3 shrink-0' />
              <span>
                {t('Next reset')}:{' '}
                {new Date(nextResetTime * 1000).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <PremiumQuotaSummary quota={sub.premium_quota} />
      {totalAmount > 0 && (
        <div className='border-t pt-3'>
          <div className='flex items-center justify-between text-sm'>
            <Tooltip>
              <TooltipTrigger
                render={<span className='text-muted-foreground cursor-help' />}
              >
                {formatQuota(usedAmount)} / {formatQuota(totalAmount)}
              </TooltipTrigger>
              <TooltipContent>
                {t('Raw Quota')}: {usedAmount}/{totalAmount} · {t('Remaining')}{' '}
                {remainAmount}
              </TooltipContent>
            </Tooltip>
            <span className='text-muted-foreground font-medium tabular-nums'>
              {usagePercent}%
            </span>
          </div>
          {isActive && (
            <Progress
              value={usagePercent}
              className={cn('mt-2 h-1.5', progressClassName)}
            />
          )}
        </div>
      )}
    </div>
  )
}
