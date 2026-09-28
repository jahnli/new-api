import VChart, { type ISpec } from '@visactor/vchart'
import i18n, { t } from 'i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import type {
  CostBucket,
  DailyStat,
  ModelDailyStat,
  ModelStat,
  SubDepartmentStat,
  UserRankingItem,
} from '../types'
import {
  buildCostBucketDistributionData,
  buildModelCallDistributionData,
  buildModelCostRankData,
  type CostBucketLabelTranslator,
} from './usage-analysis-chart-data'

const CHART_WIDTH = 680
const CHART_HEIGHT = 400

export async function renderChartToBase64(
  spec: ISpec,
  width = CHART_WIDTH,
  height = CHART_HEIGHT
): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${width}px;height:${height}px;`
  document.body.appendChild(container)

  try {
    const chartSpec = {
      ...spec,
      animation: false,
      background: 'white',
    } as ISpec
    const chart = new VChart(chartSpec, { dom: container, animation: false })
    chart.renderSync()

    const dataUrl: string = await new Promise((resolve) => {
      setTimeout(() => {
        const canvas = container.querySelector('canvas')
        if (canvas) {
          resolve(canvas.toDataURL('image/png'))
        } else {
          resolve('')
        }
      }, 300)
    })

    chart.release()
    return dataUrl
  } catch (e) {
    console.warn('Chart render failed:', e)
    return ''
  } finally {
    document.body.removeChild(container)
  }
}

function fmtTokens(v: number): string {
  if (v === 0) return '0'
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)} 亿`
  if (v >= 1_0000) return `${(v / 1_0000).toFixed(2)} 万`
  return v.toLocaleString()
}

function fmtCny(v: number): string {
  if (v === 0) return '¥0'
  return `¥${v.toFixed(2)}`
}

function fmtLargeNum(v: number): string {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)} 亿`
  if (v >= 1_0000) return `${(v / 1_0000).toFixed(2)} 万`
  return v.toLocaleString()
}

export function buildSubDeptBarSpec(subStats: SubDepartmentStat[]): ISpec {
  const sorted = [...subStats].sort((a, b) => b.total_tokens - a.total_tokens)
  return {
    type: 'bar',
    title: { visible: true, text: '子部门 Token 用量排行' },
    data: [
      {
        values: sorted.map((s) => ({
          name: s.department_name,
          value: s.total_tokens,
        })),
      },
    ],
    direction: 'horizontal',
    xField: 'value',
    yField: 'name',
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (v: number) => fmtTokens(v),
    },
    bar: { style: { cornerRadius: [4, 4, 4, 4] } },
    axes: [
      {
        orient: 'left',
        type: 'band',
        label: {
          style: { fontSize: 11 },
          formatMethod: (v: string) =>
            v.length > 12 ? `${v.slice(0, 12)}…` : v,
        },
      },
      {
        orient: 'bottom',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtTokens(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildSubDeptPieSpec(subStats: SubDepartmentStat[]): ISpec {
  const sorted = [...subStats].sort(
    (a, b) => b.total_amount_cny - a.total_amount_cny
  )
  const total = sorted.reduce((s, i) => s + i.total_amount_cny, 0)
  return {
    type: 'pie',
    title: { visible: true, text: '子部门消耗占比' },
    data: [
      {
        values: sorted
          .filter((i) => i.total_amount_cny > 0)
          .map((i) => ({ name: i.department_name, value: i.total_amount_cny })),
      },
    ],
    valueField: 'value',
    categoryField: 'name',
    outerRadius: 0.75,
    innerRadius: 0.45,
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (_: unknown, d: { name?: string; value?: number }) => {
        const pct =
          total > 0 ? `${(((d.value ?? 0) / total) * 100).toFixed(1)}%` : ''
        return pct ? `${d.name} ${pct}` : (d.name ?? '')
      },
    },
    legends: { visible: true, orient: 'bottom', type: 'discrete' },
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildCostTrendSpec(
  dailyStats: DailyStat[],
  quotaToCnyRate: number
): ISpec {
  const values = dailyStats.map((d) => ({
    date: d.date,
    value: d.total_quota * quotaToCnyRate,
  }))
  return {
    type: 'area',
    title: { visible: true, text: '消耗趋势' },
    data: [{ values }],
    xField: 'date',
    yField: 'value',
    point: { visible: false },
    line: { style: { curveType: 'monotone' } },
    area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
    axes: [
      {
        orient: 'bottom',
        type: 'band',
        label: { style: { fontSize: 10 }, autoHide: true },
      },
      {
        orient: 'left',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtCny(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildRequestTrendSpec(dailyStats: DailyStat[]): ISpec {
  const values = dailyStats.map((d) => ({
    date: d.date,
    value: d.total_requests,
  }))
  return {
    type: 'area',
    title: { visible: true, text: '请求次数趋势' },
    data: [{ values }],
    xField: 'date',
    yField: 'value',
    point: { visible: false },
    line: { style: { curveType: 'monotone' } },
    area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
    axes: [
      {
        orient: 'bottom',
        type: 'band',
        label: { style: { fontSize: 10 }, autoHide: true },
      },
      {
        orient: 'left',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtLargeNum(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildTokenTrendSpec(dailyStats: DailyStat[]): ISpec {
  const values = dailyStats.map((d) => ({
    date: d.date,
    value: d.total_tokens,
  }))
  return {
    type: 'area',
    title: { visible: true, text: 'Token 用量趋势' },
    data: [{ values }],
    xField: 'date',
    yField: 'value',
    point: { visible: false },
    line: { style: { curveType: 'monotone' } },
    area: { style: { fillOpacity: 0.15, curveType: 'monotone' } },
    axes: [
      {
        orient: 'bottom',
        type: 'band',
        label: { style: { fontSize: 10 }, autoHide: true },
      },
      {
        orient: 'left',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtTokens(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildModelUsageTrendSpec(
  modelDailyStats: ModelDailyStat[]
): ISpec | null {
  if (modelDailyStats.length === 0) return null
  return {
    type: 'line',
    title: { visible: true, text: '模型使用趋势' },
    data: [
      {
        values: modelDailyStats.map((item) => ({
          date: item.date,
          model: item.model_name,
          tokens: item.total_tokens,
        })),
      },
    ],
    xField: 'date',
    yField: 'tokens',
    seriesField: 'model',
    point: { visible: false },
    line: { style: { curveType: 'monotone' } },
    axes: [
      {
        orient: 'bottom',
        type: 'band',
        label: { style: { fontSize: 10 }, autoHide: true },
      },
      {
        orient: 'left',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtTokens(v) },
      },
    ],
    legends: { visible: true, orient: 'bottom', type: 'discrete' },
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildModelCallDistributionSpec(
  modelStats: ModelStat[],
  title = '模型调用分布'
): ISpec | null {
  const chartData = buildModelCallDistributionData(modelStats, 0)
  if (!chartData) return null

  return {
    type: 'pie',
    title: { visible: true, text: title },
    data: [{ values: chartData.values }],
    valueField: 'value',
    categoryField: 'name',
    outerRadius: 0.75,
    innerRadius: 0.45,
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (_: unknown, d: { name?: string; value?: number }) => {
        const pct =
          chartData.totalRequests > 0
            ? `${(((d.value ?? 0) / chartData.totalRequests) * 100).toFixed(
                2
              )}%`
            : ''
        return pct ? `${d.name} ${pct}` : (d.name ?? '')
      },
    },
    legends: {
      visible: true,
      orient: 'right',
      type: 'discrete',
      item: {
        label: {
          style: { fontSize: 10 },
          formatMethod: (v: string) =>
            v.length > 14 ? `${v.slice(0, 14)}…` : v,
        },
      },
      autoPage: true,
    },
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildModelCostRankSpec(
  modelStats: ModelStat[],
  quotaToCnyRate: number,
  options: { title?: string; limit?: number } = {}
): ISpec {
  const values = buildModelCostRankData(
    modelStats,
    quotaToCnyRate,
    options.limit
  )

  return {
    type: 'bar',
    title: { visible: true, text: options.title ?? '模型消耗排行' },
    data: [
      {
        values,
      },
    ],
    direction: 'horizontal',
    xField: 'value',
    yField: 'name',
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (v: number) => fmtCny(v),
    },
    bar: { style: { cornerRadius: [0, 4, 4, 0] } },
    axes: [
      {
        orient: 'left',
        type: 'band',
        label: {
          style: { fontSize: 10 },
          formatMethod: (v: string) =>
            v.length > 18 ? `${v.slice(0, 18)}…` : v,
        },
      },
      {
        orient: 'bottom',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtCny(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildUserRankBarSpec(rankings: UserRankingItem[]): ISpec {
  const sorted = [...rankings]
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10)
  return {
    type: 'bar',
    title: { visible: true, text: '用户消耗排行 Top 10' },
    data: [
      {
        values: sorted.map((u) => ({
          name: u.display_name || u.username,
          value: u.total_cost,
        })),
      },
    ],
    direction: 'horizontal',
    xField: 'value',
    yField: 'name',
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (v: number) => fmtCny(v),
    },
    bar: { style: { cornerRadius: [4, 4, 4, 4] } },
    axes: [
      {
        orient: 'left',
        type: 'band',
        label: {
          style: { fontSize: 11 },
          formatMethod: (v: string) =>
            v.length > 12 ? `${v.slice(0, 12)}…` : v,
        },
      },
      {
        orient: 'bottom',
        type: 'linear',
        label: { formatMethod: (v: number) => fmtCny(v) },
      },
    ],
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

export function buildUserRankPieSpec(rankings: UserRankingItem[]): ISpec {
  const sorted = [...rankings]
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10)
  const total = sorted.reduce((s, u) => s + u.total_cost, 0)
  return {
    type: 'pie',
    title: { visible: true, text: '用户消耗占比 Top 10' },
    data: [
      {
        values: sorted
          .filter((u) => u.total_cost > 0)
          .map((u) => ({
            name: u.display_name || u.username,
            value: u.total_cost,
          })),
      },
    ],
    valueField: 'value',
    categoryField: 'name',
    outerRadius: 0.75,
    innerRadius: 0.45,
    label: {
      visible: true,
      position: 'outside',
      formatMethod: (_: unknown, d: { name?: string; value?: number }) => {
        const pct =
          total > 0 ? `${(((d.value ?? 0) / total) * 100).toFixed(1)}%` : ''
        return pct ? `${d.name} ${pct}` : (d.name ?? '')
      },
    },
    legends: { visible: true, orient: 'bottom', type: 'discrete' },
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}

function fmtUserCount(count: number): string {
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return t('{{count}} people', {
    count,
    replace: {
      count: formatNumber(count, locale, {
        notation: count >= 10_000 ? 'compact' : 'standard',
        minimumFractionDigits: count >= 10_000 ? 1 : 0,
        maximumFractionDigits: count >= 10_000 ? 1 : 0,
      }),
    },
  })
}

export function buildCostBucketDistributionSpec(
  costBuckets: CostBucket[]
): ISpec | null {
  const labels: CostBucketLabelTranslator = {
    zeroSpend: t('Spent ¥0'),
    overMin: (min: number) => t('Spent over ¥{{min}}', { min }),
    between: (min: number, max: number) =>
      t('Spent ¥{{min}}~¥{{max}}', { min, max }),
  }

  const chartData = buildCostBucketDistributionData(costBuckets, labels)
  if (!chartData) return null

  return {
    type: 'bar',
    title: { visible: true, text: t('Cost Distribution by User Count') },
    data: [{ values: chartData.values }],
    xField: 'range',
    yField: 'users',
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
        label: { formatMethod: (v: number) => fmtUserCount(v) },
      },
    ],
    bar: { style: { cornerRadius: [4, 4, 0, 0] } },
    label: {
      visible: true,
      position: 'top',
      style: { fontSize: 11, fontWeight: 500 },
      formatMethod: (v: number) => fmtUserCount(v),
    },
    theme: 'light',
    background: 'white',
  } as unknown as ISpec
}
