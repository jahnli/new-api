import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { getUserQuotaDates } from '@/features/dashboard/api'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import type { SubscriptionPlan } from '@/features/subscriptions/types'
import { useStatus } from '@/hooks/use-status'
import dayjs from '@/lib/dayjs'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { SubscriptionSummary } from './subscription-summary'
import { SummaryUsageCards } from './summary-usage-cards'
import { WalletSummary } from './wallet-summary'

function calcNextResetTime(
  plan: SubscriptionPlan,
  baseSec: number,
  endSec: number
): number {
  const period = plan.quota_reset_period
  if (!period || period === 'never') return 0

  const base = dayjs(baseSec * 1000)
  let next: dayjs.Dayjs

  switch (period) {
    case 'daily':
      next = base.startOf('day').add(1, 'day')
      break
    case 'weekly': {
      const weekday = base.day() // 0=Sun
      const daysUntil = weekday === 0 ? 1 : 8 - weekday
      next = base.startOf('day').add(daysUntil, 'day')
      break
    }
    case 'monthly':
      next = base.startOf('month').add(1, 'month')
      break
    case 'custom': {
      const secs = plan.quota_reset_custom_seconds ?? 0
      if (secs <= 0) return 0
      next = base.add(secs, 'second')
      break
    }
    default:
      return 0
  }

  const nextSec = Math.floor(next.valueOf() / 1000)
  if (endSec > 0 && nextSec > endSec) return 0
  return nextSec
}

export function SummaryCards() {
  const user = useAuthStore((state) => state.auth.user)
  const { loading } = useStatus()

  const summaryTimeRange = useMemo(() => computeTimeRange(1), [])
  const remainQuota = Number(user?.quota ?? 0)

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      user?.id,
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: summaryTimeRange.start_timestamp,
          end_timestamp: summaryTimeRange.end_timestamp,
          default_time: 'hour',
        })
      ),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })

  const subscriptionQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'subscription-self', user?.id],
    queryFn: async () => requireServerSuccess(await getSelfSubscriptionFull()),
    staleTime: 60 * 1000,
  })

  const plansQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'public-plans', user?.id],
    queryFn: async () => requireServerSuccess(await getPublicPlans()),
    staleTime: 5 * 60 * 1000,
  })

  const planMap = useMemo(() => {
    const map = new Map<number, SubscriptionPlan>()
    for (const record of plansQuery.data?.data ?? []) {
      map.set(record.plan.id, record.plan)
    }
    return map
  }, [plansQuery.data?.data])

  const activeSubscriptionRecord = useMemo(() => {
    const subs = subscriptionQuery.data?.data?.subscriptions ?? []
    if (subs.length === 0) return null
    return subs[0]
  }, [subscriptionQuery.data?.data?.subscriptions])
  const activeSub = activeSubscriptionRecord?.subscription ?? null

  const nextResetTime = useMemo(() => {
    if (!activeSub) return 0
    if (activeSub.next_reset_time && activeSub.next_reset_time > 0) {
      return activeSub.next_reset_time
    }
    const plan = planMap.get(activeSub.plan_id)
    if (!plan) return 0
    const baseSec = activeSub.start_time || summaryTimeRange.end_timestamp
    return calcNextResetTime(plan, baseSec, activeSub.end_time)
  }, [activeSub, planMap, summaryTimeRange.end_timestamp])

  const recentUsage = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.quota) || 0),
        0
      ),
    [usageTrendQuery.data?.data]
  )

  const activePlanTitle = activeSub
    ? planMap.get(activeSub.plan_id)?.title
    : undefined

  return (
    <div className='bg-card overflow-hidden rounded-2xl border shadow-xs'>
      <div className='grid xl:grid-cols-[minmax(0,1fr)_19rem]'>
        <SummaryUsageCards />

        <div className='flex min-w-0 flex-col justify-center gap-4 border-t bg-[linear-gradient(135deg,color-mix(in_oklch,var(--overview-accent-2)_12%,var(--background))_0%,color-mix(in_oklch,oklch(0.82_0.04_155)_8%,var(--background))_48%,color-mix(in_oklch,var(--overview-accent-1)_7%,var(--background))_100%)] p-4 sm:p-5 xl:border-t-0 xl:border-l'>
          {subscriptionQuery.isPending && <LoadingState className='min-h-32' />}
          {subscriptionQuery.isError && !subscriptionQuery.data && (
            <ErrorState
              className='min-h-32 p-0'
              onRetry={() => void subscriptionQuery.refetch()}
            />
          )}
          {activeSub && (
            <SubscriptionSummary
              subscription={activeSub}
              premiumQuota={activeSubscriptionRecord?.premium_quota}
              planTitle={activePlanTitle}
              nextResetTime={nextResetTime}
            />
          )}
          {subscriptionQuery.data && !activeSub && (
            <WalletSummary
              remainQuota={remainQuota}
              recentUsage={recentUsage}
              loading={loading || !user}
              usagePending={usageTrendQuery.isPending}
              usageError={usageTrendQuery.isError}
              onRetry={() => void usageTrendQuery.refetch()}
            />
          )}
        </div>
      </div>
    </div>
  )
}
