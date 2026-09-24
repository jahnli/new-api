import { VChart } from '@visactor/react-vchart'
import type { ISpec } from '@visactor/vchart'
import {
  ChartLine,
  DollarSign,
  Hash,
  Layers,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState, type ElementType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toIntlLocale } from '@/i18n/languages'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import {
  buildModelCallDistributionData,
  buildModelCostRankData,
  buildCostBucketDistributionData,
} from '../lib/usage-analysis-chart-data'
import {
  aggregateDailyStats,
  aggregateModelDailyStats,
  formatUsageBucketLabel,
  type UsageTimeGranularity,
} from '../lib/usage-analysis-granularity'
import type {
  CostBucket,
  DailyStat,
  ModelDailyStat,
  ModelStat,
  UsageAnalysis,
} from '../types'

interface UsageAnalysisProps {
  data: UsageAnalysis
  costBuckets?: CostBucket[]
}

export function UsageAnalysisSection(props: UsageAnalysisProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const hasModelData =
    props.data.model_stats && props.data.model_stats.length > 0
  const modelSeriesStats = props.data.model_series_stats ?? []
  const hasModelSeriesData = modelSeriesStats.length > 0
  const hasDailyData =
    props.data.daily_stats && props.data.daily_stats.length > 0
  const hasCostBuckets = props.costBuckets && props.costBuckets.length > 0

  if (
    !hasModelData &&
    !hasModelSeriesData &&
    !hasDailyData &&
    !hasCostBuckets
  ) {
    return null
  }

  const quotaToCnyRate = props.data.quota_to_cny || 1 / 500000
  const chartProps = { themeReady, resolvedTheme, quotaToCnyRate }

  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <ChartLine className='text-primary size-5' />
          {t('Usage Analysis')}
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='grid grid-cols-1 lg:grid-cols-2'>
          {hasCostBuckets && (
            <CostBucketDistributionChart
              data={props.costBuckets ?? []}
              {...chartProps}
            />
          )}
          {hasModelSeriesData && (
            <ModelCallDistributionChart
              data={modelSeriesStats}
              title={t('Model Series Call Distribution')}
              chartKeyPrefix='model-series-call-distribution'
              {...chartProps}
            />
          )}
          {hasModelSeriesData && (
            <ModelCostRankChart
              data={modelSeriesStats}
              title={t('Model Series Consumption Ranking')}
              chartKeyPrefix='model-series-cost-rank'
              {...chartProps}
            />
          )}
          {hasModelSeriesData && (
            <ModelTrendChart
              data={props.data.model_series_daily_stats ?? []}
              metric='unit-price'
              {...chartProps}
            />
          )}
          {hasModelData && (
            <ModelCallDistributionChart
              data={props.data.model_stats}
              title={t('Model Call Distribution')}
              chartKeyPrefix='model-call-distribution'
              {...chartProps}
            />
          )}
          {hasModelData && (
            <ModelCostRankChart
              data={props.data.model_stats}
              title={t('Model Consumption Ranking')}
              chartKeyPrefix='model-cost-rank'
              limit={15}
              {...chartProps}
            />
          )}
          {hasDailyData && (
            <CostTrendChart data={props.data.daily_stats} {...chartProps} />
          )}
          {hasDailyData && (
            <RequestTrendChart data={props.data.daily_stats} {...chartProps} />
          )}
          {hasDailyData && (
            <TokenTrendChart data={props.data.daily_stats} {...chartProps} />
          )}
          {hasModelData && (
            <ModelTrendChart
              data={props.data.model_daily_stats ?? []}
              metric='tokens'
              {...chartProps}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Shared ──

interface ChartBaseProps {
  themeReady: boolean
  resolvedTheme: string | undefined
  quotaToCnyRate: number
}

const GRANULARITY_OPTIONS: {
  value: UsageTimeGranularity
  labelKey: 'Daily' | 'Weekly' | 'Monthly'
}[] = [
  { value: 'day', labelKey: 'Daily' },
  { value: 'week', labelKey: 'Weekly' },
  { value: 'month', labelKey: 'Monthly' },
]

function GranularitySelect(props: {
  chartTitle: string
  value: UsageTimeGranularity
  onValueChange: (value: UsageTimeGranularity) => void
}) {
  const { t } = useTranslation()
  const items = useMemo(
    () =>
      GRANULARITY_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  )
  const selectedOption = GRANULARITY_OPTIONS.find(
    (option) => option.value === props.value
  )

  return (
    <Select
      items={items}
      value={props.value}
      onValueChange={(value) => {
        if (value === 'day' || value === 'week' || value === 'month') {
          props.onValueChange(value)
        }
      }}
    >
      <SelectTrigger
        size='sm'
        className='min-w-24'
        aria-label={`${props.chartTitle}: ${t('Time Granularity')}`}
      >
        <SelectValue>
          {selectedOption ? t(selectedOption.labelKey) : ''}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align='end' alignItemWithTrigger={false}>
        <SelectGroup>
          {GRANULARITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function ChartCard(props: {
  icon: ElementType
  title: string
  actions?: ReactNode
  themeReady: boolean
  resolvedTheme: string | undefined
  chartKey: string
  spec: object | null
  height?: string
  emptyState?: ReactNode
}) {
  const Icon = props.icon
  return (
    <div className='border-border/60 border-b last:border-b-0 lg:odd:border-r [&:nth-last-child(2)]:lg:border-b-0'>
      <div className='flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3'>
        <div className='flex items-center gap-2'>
          <Icon className='text-muted-foreground/60 size-4' />
          <h3 data-chart-title={props.title} className='text-sm font-semibold'>
            {props.title}
          </h3>
        </div>
        {props.actions}
      </div>
      <div className={`${props.height ?? 'h-[300px]'} p-2`}>
        {props.themeReady && !props.spec && props.emptyState}
        {props.themeReady && props.spec && (
          <VChart
            key={props.chartKey}
            spec={{
              ...(props.spec as ISpec),
              theme: props.resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </div>
  )
}

function formatLargeNumber(v: number): string {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)} 亿`
  if (v >= 1_0000) return `${(v / 1_0000).toFixed(2)} 万`
  return v.toLocaleString()
}

function formatTokenValue(v: number): string {
  if (v === 0) return '0'
  return `${(v / 1_0000_0000).toFixed(2)} 亿`
}

const DATA_ZOOM_THRESHOLD = 14

function makeDataZoom(chartType: 'area' | 'line') {
  const backgroundChart =
    chartType === 'area'
      ? {
          area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
          line: { style: { lineWidth: 1 } },
        }
      : { line: { style: { lineWidth: 1 } } }

  return [
    {
      orient: 'bottom' as const,
      filterMode: 'axis' as const,
      startText: { formatMethod: (v: string) => v },
      endText: { formatMethod: (v: string) => v },
      backgroundChart,
    },
  ]
}

const APPEAR_ANIMATION = {
  animationAppear: {
    duration: 800,
    easing: 'cubicOut',
  },
}

function makeAreaSpec(
  data: { date: string; value: number }[],
  yAxisFormat: (v: number) => string,
  tooltipKey: string,
  tooltipFormat: (v: number) => string,
  granularity: UsageTimeGranularity
) {
  return {
    type: 'area' as const,
    data: [{ values: data }],
    xField: 'date',
    yField: 'value',
    point: { visible: data.length <= 60, size: 4 },
    line: { style: { curveType: 'monotone' } },
    area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
    ...APPEAR_ANIMATION,
    ...(data.length > DATA_ZOOM_THRESHOLD
      ? { dataZoom: makeDataZoom('area') }
      : {}),
    axes: [
      {
        orient: 'bottom',
        type: 'band',
        label: {
          style: { fontSize: 11 },
          autoHide: true,
          autoHideMethod: 'greedy',
          formatMethod: (v: string) => formatUsageBucketLabel(v, granularity),
        },
      },
      {
        orient: 'left',
        type: 'linear',
        label: { formatMethod: yAxisFormat },
      },
    ],
    tooltip: {
      dimension: {
        content: [
          {
            key: tooltipKey,
            value: (d: { value?: number }) => tooltipFormat(d.value ?? 0),
          },
        ],
      },
      mark: {
        title: {
          value: (d: { date?: string }) =>
            formatUsageBucketLabel(d.date ?? '', granularity),
        },
        content: [
          {
            key: tooltipKey,
            value: (d: { value?: number }) => tooltipFormat(d.value ?? 0),
          },
        ],
      },
    },
  }
}

function formatCost(value: number): string {
  if (value === 0) return '¥0'
  return `¥${value.toFixed(2)}`
}

function formatCompactCost(value: number): string {
  if (value === 0) return '¥0'
  if (value >= 1000) return `¥${(value / 1000).toFixed(0)}K`
  return `¥${value.toFixed(0)}`
}

function formatUnitPrice(
  cost: number,
  tokens: number,
  unitLabel: string
): string {
  if (tokens <= 0) return '-'
  const pricePer100MTokens = calculateUnitPricePer100MTokens(cost, tokens)
  return `¥${pricePer100MTokens.toFixed(2)}/${unitLabel}`
}

// ── 1. 请求次数趋势 ──

function RequestTrendChart(props: ChartBaseProps & { data: DailyStat[] }) {
  const { t } = useTranslation()
  const [granularity, setGranularity] = useState<UsageTimeGranularity>('day')
  const title = t('Request Count Trend')

  const spec = useMemo(() => {
    const values = aggregateDailyStats(props.data, granularity).map((item) => ({
      date: item.date,
      value: item.total_requests,
    }))
    return makeAreaSpec(
      values,
      (v) => `${formatLargeNumber(v)} ${t('times')}`,
      t('Requests'),
      (v) => `${formatLargeNumber(v)} ${t('times')}`,
      granularity
    )
  }, [granularity, props.data, t])

  return (
    <ChartCard
      icon={Hash}
      title={title}
      actions={
        <GranularitySelect
          chartTitle={title}
          value={granularity}
          onValueChange={setGranularity}
        />
      }
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`request-trend-${granularity}-${props.resolvedTheme}`}
      spec={spec}
      height='h-[340px]'
    />
  )
}

// ── 2. Token 用量趋势 ──

function TokenTrendChart(props: ChartBaseProps & { data: DailyStat[] }) {
  const { t } = useTranslation()
  const [granularity, setGranularity] = useState<UsageTimeGranularity>('day')
  const title = t('Token Usage Trend')

  const spec = useMemo(() => {
    const values = aggregateDailyStats(props.data, granularity).map((item) => ({
      date: item.date,
      value: item.total_tokens,
      cost: item.total_quota * props.quotaToCnyRate,
    }))

    const tooltipContent = [
      {
        key: () => 'Token',
        value: (d: { value?: number }) => formatTokenValue(d.value ?? 0),
      },
      {
        key: () => t('Cost'),
        value: (d: { cost?: number }) => formatCost(d.cost ?? 0),
      },
      {
        key: () => t('Unit Price'),
        value: (d: { cost?: number; value?: number }) =>
          formatUnitPrice(d.cost ?? 0, d.value ?? 0, t('100M Tokens')),
      },
    ]

    return {
      type: 'area' as const,
      data: [{ values }],
      xField: 'date',
      yField: 'value',
      point: { visible: values.length <= 60, size: 4 },
      line: { style: { curveType: 'monotone' } },
      area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
      ...APPEAR_ANIMATION,
      ...(values.length > DATA_ZOOM_THRESHOLD
        ? { dataZoom: makeDataZoom('area') }
        : {}),
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            autoHide: true,
            autoHideMethod: 'greedy',
            formatMethod: (v: string) => formatUsageBucketLabel(v, granularity),
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: { formatMethod: (v: number) => formatTokenValue(v) },
        },
      ],
      tooltip: {
        dimension: {
          content: tooltipContent,
        },
        mark: {
          title: {
            value: (d: { date?: string }) =>
              formatUsageBucketLabel(d.date ?? '', granularity),
          },
          content: tooltipContent,
        },
      },
    }
  }, [granularity, props.data, props.quotaToCnyRate, t])

  return (
    <ChartCard
      icon={Layers}
      title={title}
      actions={
        <GranularitySelect
          chartTitle={title}
          value={granularity}
          onValueChange={setGranularity}
        />
      }
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`token-trend-${granularity}-${props.resolvedTheme}`}
      spec={spec}
      height='h-[340px]'
    />
  )
}

// ── 3. 模型使用趋势 ──

function ModelTrendChart(
  props: ChartBaseProps & {
    data: ModelDailyStat[]
    metric: 'tokens' | 'unit-price'
  }
) {
  const { t, i18n } = useTranslation()
  const [granularity, setGranularity] = useState<UsageTimeGranularity>('day')
  const isUnitPrice = props.metric === 'unit-price'
  const title = isUnitPrice
    ? t('Model Series Unit Price Trend')
    : t('Model Usage Trend')
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  const spec = useMemo(() => {
    if (props.data.length === 0) return null

    const aggregatedData = aggregateModelDailyStats(props.data, granularity)
    const bucketCount = new Set(aggregatedData.map((item) => item.date)).size
    // Overview costs are explicitly CNY; the currency helpers follow the
    // configurable display currency and cannot format this fixed currency.
    const currencyFormatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const values: { date: string; model: string; value: number | null }[] =
      aggregatedData.map((item) => {
        let value: number | null = item.total_tokens
        if (isUnitPrice) {
          value = null
          if (
            item.total_tokens > 0 &&
            item.total_quota !== undefined &&
            item.total_quota >= 0
          ) {
            value = calculateUnitPricePer100MTokens(
              item.total_quota * props.quotaToCnyRate,
              item.total_tokens
            )
          }
        }
        return { date: item.date, model: item.model_name, value }
      })
    if (isUnitPrice) {
      if (!values.some((item) => item.value !== null)) return null
      const dates = [...new Set(values.map((item) => item.date))]
      const models = [...new Set(values.map((item) => item.model))].sort()
      const byDateAndModel = new Map(
        values.map((item) => [`${item.date}\u0000${item.model}`, item])
      )
      // Missing usage is a gap, not a zero price or an interpolated price.
      values.length = 0
      for (const date of dates) {
        for (const model of models) {
          values.push(
            byDateAndModel.get(`${date}\u0000${model}`) ?? {
              date,
              model,
              value: null,
            }
          )
        }
      }
    }
    const formatValue = (value: number | null | undefined): string => {
      if (value == null) return '-'
      if (isUnitPrice) {
        return `${currencyFormatter.format(value)}/${t('100M Tokens')}`
      }
      return formatTokenValue(value)
    }

    return {
      type: 'line' as const,
      data: [
        {
          values,
        },
      ],
      xField: 'date',
      yField: 'value',
      seriesField: 'model',
      ...(isUnitPrice ? { invalidType: 'break' } : {}),
      point: { visible: bucketCount <= 60, size: 3 },
      line: { style: { curveType: isUnitPrice ? 'linear' : 'monotone' } },
      ...APPEAR_ANIMATION,
      ...(bucketCount > DATA_ZOOM_THRESHOLD
        ? { dataZoom: makeDataZoom('line') }
        : {}),
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            autoHide: true,
            autoHideMethod: 'greedy',
            formatMethod: (v: string) => formatUsageBucketLabel(v, granularity),
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (v: number) =>
              isUnitPrice ? currencyFormatter.format(v) : formatTokenValue(v),
          },
        },
      ],
      legends: {
        visible: true,
        orient: 'right',
        position: 'start',
        item: {
          label: {
            formatMethod: (v: string) =>
              v.length > 18 ? `${v.slice(0, 18)}…` : v,
          },
        },
      },
      tooltip: {
        dimension: {
          content: [
            {
              key: (d: { model?: string }) => d.model ?? '',
              value: (d: { value?: number | null }) => formatValue(d.value),
            },
          ],
        },
        mark: {
          title: {
            value: (d: { date?: string }) =>
              formatUsageBucketLabel(d.date ?? '', granularity),
          },
          content: [
            {
              key: (d: { model?: string }) => d.model ?? '',
              value: (d: { value?: number | null }) => formatValue(d.value),
            },
          ],
        },
      },
    }
  }, [granularity, props.data, props.quotaToCnyRate, isUnitPrice, locale, t])

  if (!isUnitPrice && props.data.length === 0) return null

  return (
    <ChartCard
      icon={TrendingUp}
      title={title}
      actions={
        <GranularitySelect
          chartTitle={title}
          value={granularity}
          onValueChange={setGranularity}
        />
      }
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`model-${props.metric}-trend-${granularity}-${props.resolvedTheme}-${locale}`}
      spec={spec}
      height='h-[340px]'
      emptyState={isUnitPrice ? <EmptyState /> : undefined}
    />
  )
}

// ── 4. 模型调用分布 ──

function formatModelCacheHitRate(stat: ModelStat | undefined): string {
  const cacheReadTokens = stat?.cache_read_tokens ?? 0
  // Cache writes count as misses, matching the overview statistics.
  const totalInputTokens =
    (stat?.uncached_input_tokens ?? 0) +
    cacheReadTokens +
    (stat?.cache_write_tokens ?? 0)
  const rate =
    totalInputTokens > 0 ? (cacheReadTokens / totalInputTokens) * 100 : 0
  return `${rate.toFixed(1)}%`
}

function ModelCallDistributionChart(
  props: ChartBaseProps & {
    data: ModelStat[]
    title: string
    chartKeyPrefix: string
  }
) {
  const { t } = useTranslation()

  const spec = useMemo(() => {
    const chartData = buildModelCallDistributionData(
      props.data,
      props.quotaToCnyRate
    )
    if (!chartData) return null

    const modelStatsByName = new Map(
      props.data.map((stat) => [stat.model_name, stat])
    )

    return {
      type: 'pie' as const,
      data: [
        {
          values: chartData.values,
        },
      ],
      valueField: 'value',
      categoryField: 'name',
      outerRadius: 0.8,
      innerRadius: 0.5,
      pie: {
        state: {
          hover: {
            outerRadius: 0.88,
            stroke: '#fff',
            lineWidth: 2,
          },
        },
      },
      animationAppear: {
        duration: 800,
        easing: 'cubicOut',
        preset: 'growRadiusIn',
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (
          _: unknown,
          datum: { name?: string; value?: number }
        ) => {
          const name = datum.name ?? ''
          const pct =
            chartData.totalRequests > 0
              ? `${(
                  ((datum.value ?? 0) / chartData.totalRequests) *
                  100
                ).toFixed(2)}%`
              : ''
          return pct ? `${name} ${pct}` : name
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: () => 'Token',
              value: (datum: { tokens?: number }) =>
                formatTokenValue(datum.tokens ?? 0),
            },
            {
              key: () => t('Cost'),
              value: (datum: { cost?: number }) => formatCost(datum.cost ?? 0),
            },
            {
              key: () => t('Unit Price'),
              value: (datum: { cost?: number; tokens?: number }) =>
                formatUnitPrice(
                  datum.cost ?? 0,
                  datum.tokens ?? 0,
                  t('100M Tokens')
                ),
            },
            {
              key: () => t('Requests'),
              value: (datum: { value?: number }) =>
                `${formatLargeNumber(datum.value ?? 0)} ${t('times')}`,
            },
            {
              key: () => t('Cache Hit Rate'),
              value: (datum: { name?: string }) =>
                formatModelCacheHitRate(modelStatsByName.get(datum.name ?? '')),
            },
          ],
        },
      },
      legends: {
        visible: true,
        orient: 'right',
        type: 'discrete',
        item: {
          width: 120,
          label: {
            style: { fontSize: 11 },
            formatMethod: (label: string) =>
              label.length > 12 ? `${label.slice(0, 12)}…` : label,
          },
        },
        maxRow: 12,
        autoPage: true,
      },
    }
  }, [props.data, props.quotaToCnyRate, t])

  if (!spec) return null

  return (
    <ChartCard
      icon={PieChart}
      title={props.title}
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`${props.chartKeyPrefix}-${props.resolvedTheme}`}
      spec={spec}
      height='h-[340px]'
    />
  )
}

// ── 5. 模型消耗排行 ──

function ModelCostRankChart(
  props: ChartBaseProps & {
    data: ModelStat[]
    title: string
    chartKeyPrefix: string
    limit?: number
  }
) {
  const { t } = useTranslation()

  const spec = useMemo(() => {
    const sorted = buildModelCostRankData(
      props.data,
      props.quotaToCnyRate,
      props.limit
    )
    const modelStatsByName = new Map(
      props.data.map((stat) => [stat.model_name, stat])
    )

    return {
      type: 'bar' as const,
      data: [
        {
          values: sorted,
        },
      ],
      direction: 'horizontal' as const,
      xField: 'value',
      yField: 'name',
      ...APPEAR_ANIMATION,
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) =>
          value === 0 ? '¥0' : `¥${value.toFixed(2)}`,
      },
      bar: { style: { cornerRadius: [0, 4, 4, 0] } },
      axes: [
        {
          orient: 'left',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            formatMethod: (v: string) =>
              v.length > 20 ? `${v.slice(0, 20)}…` : v,
          },
        },
        {
          orient: 'bottom',
          type: 'linear',
          label: {
            formatMethod: (v: number) => formatCompactCost(v),
          },
        },
      ],
      tooltip: {
        dimension: {
          content: [
            {
              key: () => 'Token',
              value: (d: { tokens?: number }) =>
                formatTokenValue(d.tokens ?? 0),
            },
            {
              key: () => t('Cost'),
              value: (d: { value?: number }) => formatCost(d.value ?? 0),
            },
            {
              key: () => t('Unit Price'),
              value: (d: { value?: number; tokens?: number }) =>
                formatUnitPrice(d.value ?? 0, d.tokens ?? 0, t('100M Tokens')),
            },
            {
              key: () => t('Requests'),
              value: (d: { requests?: number }) =>
                `${formatLargeNumber(d.requests ?? 0)} ${t('times')}`,
            },
            {
              key: () => t('Cache Hit Rate'),
              value: (d: { name?: string }) =>
                formatModelCacheHitRate(modelStatsByName.get(d.name ?? '')),
            },
          ],
        },
        mark: {
          content: [
            {
              key: () => 'Token',
              value: (d: { tokens?: number }) =>
                formatTokenValue(d.tokens ?? 0),
            },
            {
              key: () => t('Cost'),
              value: (d: { value?: number }) => formatCost(d.value ?? 0),
            },
            {
              key: () => t('Unit Price'),
              value: (d: { value?: number; tokens?: number }) =>
                formatUnitPrice(d.value ?? 0, d.tokens ?? 0, t('100M Tokens')),
            },
            {
              key: () => t('Requests'),
              value: (d: { requests?: number }) =>
                `${formatLargeNumber(d.requests ?? 0)} ${t('times')}`,
            },
            {
              key: () => t('Cache Hit Rate'),
              value: (d: { name?: string }) =>
                formatModelCacheHitRate(modelStatsByName.get(d.name ?? '')),
            },
          ],
        },
      },
    }
  }, [props.data, props.limit, props.quotaToCnyRate, t])

  return (
    <ChartCard
      icon={DollarSign}
      title={props.title}
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`${props.chartKeyPrefix}-${props.resolvedTheme}`}
      spec={spec}
      height='h-[340px]'
    />
  )
}

// ── 6. 费用趋势 ──

function CostTrendChart(props: ChartBaseProps & { data: DailyStat[] }) {
  const { t } = useTranslation()
  const [granularity, setGranularity] = useState<UsageTimeGranularity>('day')
  const title = t('Quota Consumption Trend')

  const spec = useMemo(() => {
    const values = aggregateDailyStats(props.data, granularity).map((item) => ({
      date: item.date,
      value: item.total_quota * props.quotaToCnyRate,
      tokens: item.total_tokens,
      requests: item.total_requests,
    }))

    return {
      type: 'area' as const,
      data: [{ values }],
      xField: 'date',
      yField: 'value',
      point: { visible: values.length <= 60, size: 4 },
      line: { style: { curveType: 'monotone' } },
      area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
      ...APPEAR_ANIMATION,
      ...(values.length > DATA_ZOOM_THRESHOLD
        ? { dataZoom: makeDataZoom('area') }
        : {}),
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            autoHide: true,
            autoHideMethod: 'greedy',
            formatMethod: (value: string) =>
              formatUsageBucketLabel(value, granularity),
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatCompactCost(value),
          },
        },
      ],
      tooltip: {
        dimension: {
          content: [
            {
              key: () => 'Token',
              value: (datum: { tokens?: number }) =>
                formatTokenValue(datum.tokens ?? 0),
            },
            {
              key: () => t('Cost'),
              value: (datum: { value?: number }) =>
                formatCost(datum.value ?? 0),
            },
            {
              key: () => t('Unit Price'),
              value: (datum: { value?: number; tokens?: number }) =>
                formatUnitPrice(
                  datum.value ?? 0,
                  datum.tokens ?? 0,
                  t('100M Tokens')
                ),
            },
            {
              key: () => t('Requests'),
              value: (datum: { requests?: number }) =>
                `${formatLargeNumber(datum.requests ?? 0)} ${t('times')}`,
            },
          ],
        },
        mark: {
          title: {
            value: (datum: { date?: string }) =>
              formatUsageBucketLabel(datum.date ?? '', granularity),
          },
          content: [
            {
              key: () => 'Token',
              value: (datum: { tokens?: number }) =>
                formatTokenValue(datum.tokens ?? 0),
            },
            {
              key: () => t('Cost'),
              value: (datum: { value?: number }) =>
                formatCost(datum.value ?? 0),
            },
            {
              key: () => t('Unit Price'),
              value: (datum: { value?: number; tokens?: number }) =>
                formatUnitPrice(
                  datum.value ?? 0,
                  datum.tokens ?? 0,
                  t('100M Tokens')
                ),
            },
            {
              key: () => t('Requests'),
              value: (datum: { requests?: number }) =>
                `${formatLargeNumber(datum.requests ?? 0)} ${t('times')}`,
            },
          ],
        },
      },
    }
  }, [granularity, props.data, props.quotaToCnyRate, t])

  return (
    <ChartCard
      icon={DollarSign}
      title={title}
      actions={
        <GranularitySelect
          chartTitle={title}
          value={granularity}
          onValueChange={setGranularity}
        />
      }
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`cost-trend-${granularity}-${props.resolvedTheme}`}
      spec={spec}
      height='h-[340px]'
    />
  )
}

// ── 费用分布柱状图 ──

function CostBucketDistributionChart(
  props: ChartBaseProps & { data: CostBucket[] }
) {
  const { t } = useTranslation()

  const spec = useMemo(() => {
    const chartData = buildCostBucketDistributionData(props.data, {
      zeroSpend: t('Spent ¥0'),
      overMin: (min: number) => t('Spent over ¥{{min}}', { min }),
      between: (min: number, max: number) =>
        t('Spent ¥{{min}}~¥{{max}}', { min, max }),
    })

    if (!chartData) return null

    return {
      type: 'bar' as const,
      data: [{ values: chartData.values }],
      xField: 'range',
      yField: 'users',
      ...APPEAR_ANIMATION,
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            autoRotate: true,
            autoHide: true,
            autoHideMethod: 'greedy',
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (v: number) => {
              if (v >= 1_0000) return `${(v / 1_0000).toFixed(1)}万`
              return v.toFixed(0)
            },
          },
        },
      ],
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
        },
      },
      label: {
        visible: true,
        position: 'top',
        style: {
          fontSize: 11,
          fontWeight: 500,
        },
        formatMethod: (value: number) => {
          if (value >= 1_0000) return `${(value / 1_0000).toFixed(1)}万`
          return value.toString()
        },
      },
      tooltip: {
        mark: {
          title: { value: (datum: { range?: string }) => datum.range ?? '' },
          content: [
            {
              key: () => t('Number of Users'),
              value: (datum: { users?: number }) =>
                (datum.users ?? 0).toString(),
            },
          ],
        },
      },
    }
  }, [props.data, t])

  return (
    <ChartCard
      icon={TrendingUp}
      title={t('Cost Distribution by User Count')}
      themeReady={props.themeReady}
      resolvedTheme={props.resolvedTheme}
      chartKey={`cost-bucket-distribution-${props.resolvedTheme}`}
      spec={spec}
    />
  )
}
