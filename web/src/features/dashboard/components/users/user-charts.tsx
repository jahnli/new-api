import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { Users } from 'lucide-react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { getUserQuotaDataByUsers } from '@/features/dashboard/api'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import { getDefaultDays, processUserChartData } from '@/features/dashboard/lib'
import type {
  DashboardFilters,
  ProcessedUserChartData,
} from '@/features/dashboard/types'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const USER_CHARTS: {
  value: string
  labelKey: string
  specKey: keyof ProcessedUserChartData
}[] = [
  {
    value: 'rank',
    labelKey: 'User Consumption Ranking',
    specKey: 'spec_user_rank',
  },
  {
    value: 'trend',
    labelKey: 'User Consumption Trend',
    specKey: 'spec_user_trend',
  },
]

interface UserChartsProps {
  filters: DashboardFilters
}

export function UserCharts(props: UserChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  const timeGranularity =
    props.filters.time_granularity ?? DEFAULT_TIME_GRANULARITY
  const topUserLimit = 10

  const timeRange = useMemo(
    () =>
      computeTimeRange(
        getDefaultDays(timeGranularity),
        props.filters.start_timestamp,
        props.filters.end_timestamp
      ),
    [
      props.filters.end_timestamp,
      props.filters.start_timestamp,
      timeGranularity,
    ]
  )

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
  }, [resolvedTheme])

  const { data: userData, isLoading } = useQuery({
    queryKey: ['dashboard', 'user-quota', timeRange],
    queryFn: async () =>
      requireServerSuccess(await getUserQuotaDataByUsers(timeRange)),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const chartData = useMemo(
    () =>
      processUserChartData(
        isLoading ? [] : (userData ?? []),
        timeGranularity,
        t,
        topUserLimit
      ),
    [userData, isLoading, timeGranularity, t, topUserLimit]
  )

  return (
    <div className='grid gap-3'>
      {USER_CHARTS.map((chart) => {
        const spec = chartData[chart.specKey]

        return (
          <div key={chart.value} className='overflow-hidden rounded-lg border'>
            <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
              <IconBadge tone='info' size='sm'>
                <Users />
              </IconBadge>
              <div className='text-sm font-semibold'>{t(chart.labelKey)}</div>
            </div>

            <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
              {isLoading ? (
                <Skeleton className='h-full w-full' />
              ) : (
                themeReady &&
                spec && (
                  <VChart
                    key={`user-${chart.value}-${topUserLimit}-${resolvedTheme}`}
                    spec={{
                      ...spec,
                      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                      background: 'transparent',
                    }}
                    option={VCHART_OPTION}
                  />
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
