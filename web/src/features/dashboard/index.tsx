import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { RotateCcw, Search, Eye, EyeOff } from 'lucide-react'
import {
  type ChangeEvent,
  useState,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { ROLE } from '@/lib/roles'
import type { TimeGranularity } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { OverviewDashboard } from './components/overview/overview-dashboard'
import {
  DEFAULT_DASHBOARD_CHART_PREFERENCES,
  DEFAULT_TIME_GRANULARITY,
  TIME_GRANULARITY_OPTIONS,
} from './constants'
import { buildDefaultDashboardFilters } from './lib'
import {
  type DashboardSectionId,
  DASHBOARD_DEFAULT_SECTION,
  DASHBOARD_SECTION_IDS,
} from './section-registry'
import type { DashboardFilters, QuotaDataItem } from './types'

const route = getRouteApi('/_authenticated/dashboard/$section')

const LazyLogStatCards = lazy(() =>
  import('./components/models/log-stat-cards').then((m) => ({
    default: m.LogStatCards,
  }))
)

const LazyModelCharts = lazy(() =>
  import('./components/models/model-charts').then((m) => ({
    default: m.ModelCharts,
  }))
)

const LazyPerformanceOverview = lazy(() =>
  import('./components/models/performance-overview').then((m) => ({
    default: m.PerformanceOverview,
  }))
)

const LazyFlowCharts = lazy(() =>
  import('./components/flow/flow-charts').then((m) => ({
    default: m.FlowCharts,
  }))
)

const LOG_STAT_CARD_FALLBACK_ITEMS = [
  'token-used',
  'total-cost',
  'average-price',
  'request-count',
  'average-rpm',
  'average-tpm',
]

const PERFORMANCE_FALLBACK_METRICS = ['status', 'latency', 'success-rate']

const PERFORMANCE_FALLBACK_BADGES = ['bucket-count', 'sample-count']

function LogStatCardsFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-6'>
        {LOG_STAT_CARD_FALLBACK_ITEMS.map((fallbackItem) => (
          <div key={fallbackItem} className='px-2.5 py-1.5 sm:px-5 sm:py-4'>
            <div className='flex items-center gap-1.5 sm:gap-2'>
              <Skeleton className='size-4 rounded-sm sm:size-7 sm:rounded-md' />
              <Skeleton className='h-4 w-16' />
            </div>
            <Skeleton className='mt-1 h-5 w-16 sm:mt-2 sm:h-7 sm:w-20' />
            <Skeleton className='mt-1 hidden h-3.5 w-28 md:block' />
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelChartsFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-8 w-72' />
      </div>
      <div className='h-96 p-2'>
        <Skeleton className='h-full w-full' />
      </div>
    </div>
  )
}

function PerformanceOverviewFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-24' />
        </div>
        {PERFORMANCE_FALLBACK_METRICS.map((fallbackMetric) => (
          <div key={fallbackMetric} className='flex items-center gap-1.5'>
            <Skeleton className='h-3 w-14' />
            <Skeleton className='h-4 w-16' />
          </div>
        ))}
        <div className='ml-auto flex items-center gap-2'>
          {PERFORMANCE_FALLBACK_BADGES.map((fallbackBadge) => (
            <Skeleton key={fallbackBadge} className='h-5 w-28 rounded-full' />
          ))}
        </div>
      </div>
    </div>
  )
}

const SECTION_META: Record<DashboardSectionId, { titleKey: string }> = {
  overview: {
    titleKey: 'Overview',
  },
  models: {
    titleKey: 'Model Call Analytics',
  },
  flow: {
    titleKey: 'Flow',
  },
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const activeSection = (params.section ??
    DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [modelFilters, setModelFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(DEFAULT_DASHBOARD_CHART_PREFERENCES)
  )
  const [draftModelFilters, setDraftModelFilters] = useState<DashboardFilters>(
    () => buildDefaultDashboardFilters(DEFAULT_DASHBOARD_CHART_PREFERENCES)
  )
  const [flowSensitiveVisible, setFlowSensitiveVisible] = useState(true)

  const handleDashboardTimeRangeChange = useCallback(
    (range: { start?: Date; end?: Date }) => {
      setDraftModelFilters((prev) => ({
        ...prev,
        start_timestamp: range.start,
        end_timestamp: range.end,
      }))
    },
    []
  )

  const handleDashboardUsernameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const username = event.target.value
      setDraftModelFilters((prev) => ({
        ...prev,
        username: username || undefined,
      }))
    },
    []
  )

  const handleDashboardGranularityChange = useCallback(
    (value: TimeGranularity | null) => {
      if (!value) return
      setDraftModelFilters((prev) => ({
        ...prev,
        time_granularity: value,
      }))
    },
    []
  )

  const handleDashboardSearch = useCallback(() => {
    setModelFilters(draftModelFilters)
  }, [draftModelFilters])

  const handleDashboardReset = useCallback(() => {
    const defaultFilters = buildDefaultDashboardFilters(
      DEFAULT_DASHBOARD_CHART_PREFERENCES
    )
    setDraftModelFilters(defaultFilters)
    setModelFilters(defaultFilters)
  }, [])

  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  const meta = SECTION_META[activeSection] ?? SECTION_META.overview
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const isSuperAdmin = Boolean(userRole && userRole >= ROLE.SUPER_ADMIN)
  const visibleSections = useMemo(
    () => DASHBOARD_SECTION_IDS.filter((section) => section !== 'overview'),
    []
  )
  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/dashboard/$section',
        params: { section: section as DashboardSectionId },
      })
    },
    [navigate]
  )
  const showSectionTabs =
    activeSection !== 'overview' && visibleSections.length > 1
  const dashboardFilterControls = (
    <>
      <CompactDateTimeRangePicker
        start={draftModelFilters.start_timestamp}
        end={draftModelFilters.end_timestamp}
        onChange={handleDashboardTimeRangeChange}
        className='h-8 w-[320px] max-w-[320px] shrink-0'
      />
      {isSuperAdmin && (
        <Input
          value={draftModelFilters.username ?? ''}
          onChange={handleDashboardUsernameChange}
          placeholder={t('User Name')}
          aria-label={t('User Name')}
          className='h-8 w-full sm:w-44'
        />
      )}
      <Select
        items={TIME_GRANULARITY_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.label),
        }))}
        value={draftModelFilters.time_granularity ?? DEFAULT_TIME_GRANULARITY}
        onValueChange={handleDashboardGranularityChange}
      >
        <SelectTrigger
          aria-label={t('Time Granularity')}
          className='h-8 w-full gap-2 sm:w-36'
        >
          <span className='text-muted-foreground shrink-0'>
            {t('Time Granularity')}
          </span>
          <SelectValue placeholder={t('Time Granularity')} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {TIME_GRANULARITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        variant='outline'
        className='h-8 gap-1.5'
        onClick={handleDashboardReset}
      >
        <RotateCcw className='size-3.5' />
        {t('Reset')}
      </Button>
      <Button className='h-8 gap-1.5' onClick={handleDashboardSearch}>
        <Search className='size-3.5' />
        {t('Search')}
      </Button>
    </>
  )
  const modelActions =
    activeSection === 'models' ? dashboardFilterControls : null
  const flowActions =
    activeSection === 'flow' ? (
      <>
        {dashboardFilterControls}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setFlowSensitiveVisible((prev) => !prev)}
                aria-label={
                  flowSensitiveVisible
                    ? t('Hide sensitive data')
                    : t('Show sensitive data')
                }
                className='text-muted-foreground hover:text-foreground size-8'
              />
            }
          >
            {flowSensitiveVisible ? <Eye /> : <EyeOff />}
          </TooltipTrigger>
          <TooltipContent>
            {flowSensitiveVisible
              ? t('Hide sensitive data')
              : t('Show sensitive data')}
          </TooltipContent>
        </Tooltip>
      </>
    ) : null
  const sectionActions = modelActions ?? flowActions

  if (activeSection === 'overview') {
    return <OverviewDashboard />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          <div className='flex items-center justify-between gap-1.5 sm:gap-2'>
            {sectionActions != null && (
              <div className='flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:gap-2'>
                {sectionActions}
              </div>
            )}
            {showSectionTabs ? (
              <Tabs
                value={activeSection}
                onValueChange={handleSectionChange}
                className='shrink-0'
              >
                <TabsList className='max-w-full flex-nowrap justify-start'>
                  {visibleSections.map((section) => (
                    <TabsTrigger key={section} value={section}>
                      {t(SECTION_META[section].titleKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <div />
            )}
          </div>
          {activeSection === 'models' && (
            <>
              <FadeIn>
                <Suspense fallback={<LogStatCardsFallback />}>
                  <LazyLogStatCards
                    filters={modelFilters}
                    onDataUpdate={handleDataUpdate}
                  />
                </Suspense>
              </FadeIn>
              {isAdmin && (
                <FadeIn delay={0.05}>
                  <Suspense fallback={<PerformanceOverviewFallback />}>
                    <LazyPerformanceOverview />
                  </Suspense>
                </FadeIn>
              )}
              <FadeIn delay={0.15}>
                <Suspense fallback={<ModelChartsFallback />}>
                  <LazyModelCharts
                    data={modelData}
                    filters={modelFilters}
                    loading={dataLoading}
                    canViewUserConsumption={isAdmin}
                    defaultChartTab={
                      DEFAULT_DASHBOARD_CHART_PREFERENCES.modelAnalyticsChart
                    }
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </FadeIn>
            </>
          )}
          {activeSection === 'flow' && (
            <FadeIn>
              <Suspense fallback={<ModelChartsFallback />}>
                <LazyFlowCharts
                  filters={modelFilters}
                  sensitiveVisible={flowSensitiveVisible}
                />
              </Suspense>
            </FadeIn>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
