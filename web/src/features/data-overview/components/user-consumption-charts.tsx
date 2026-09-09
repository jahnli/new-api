import { VChart } from '@visactor/react-vchart'
import { BarChart3, PieChart } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import type { UserRankingItem } from '../types'

interface UserConsumptionChartsProps {
  data: UserRankingItem[]
}

function formatCost(value: number): string {
  if (value === 0) return '¥0'
  return `¥${value.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (!tokens) return '0'
  return `${(tokens / 1_0000_0000).toFixed(2)} 亿`
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

export function UserConsumptionCharts(props: UserConsumptionChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()

  const sortedData = useMemo(
    () => [...props.data].sort((a, b) => b.total_cost - a.total_cost),
    [props.data]
  )

  const totalCost = useMemo(
    () => sortedData.reduce((sum, i) => sum + i.total_cost, 0),
    [sortedData]
  )

  const barSpec = useMemo(() => {
    const values = sortedData.map((item) => ({
      name: item.display_name || item.username,
      cost: item.total_cost,
      tokens: item.total_tokens,
    }))

    const markTooltip = {
      title: {
        value: (d: { name?: string }) => d.name ?? '',
      },
      content: [
        {
          key: () => t('Total Cost'),
          value: (d: { cost?: number }) => formatCost(d.cost ?? 0),
        },
        {
          key: 'Token',
          value: (d: { tokens?: number }) => formatTokens(d.tokens ?? 0),
        },
        {
          key: () => t('Unit Price'),
          value: (d: { cost?: number; tokens?: number }) =>
            formatUnitPrice(d.cost ?? 0, d.tokens ?? 0, t('100M Tokens')),
        },
      ],
    }

    return {
      type: 'bar' as const,
      data: [{ values }],
      direction: 'horizontal' as const,
      xField: 'cost',
      yField: 'name',
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) => formatCost(value),
      },
      bar: { style: { cornerRadius: [4, 4, 4, 4] } },
      axes: [
        {
          orient: 'left',
          type: 'band',
          label: {
            style: { fontSize: 11 },
            formatMethod: (v: string) =>
              v.length > 10 ? `${v.slice(0, 10)}…` : v,
          },
        },
        {
          orient: 'bottom',
          type: 'linear',
          label: {
            formatMethod: (v: number) => formatCost(v),
          },
        },
      ],
      tooltip: {
        dimension: markTooltip,
        mark: markTooltip,
      },
      animationAppear: {
        duration: 800,
        easing: 'cubicOut',
      },
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      background: 'transparent',
    }
  }, [sortedData, resolvedTheme, t])

  const pieSpec = useMemo(() => {
    const values = sortedData
      .filter((i) => i.total_cost > 0)
      .map((i) => ({
        name: i.display_name || i.username,
        value: i.total_cost,
        tokens: i.total_tokens,
      }))

    return {
      type: 'pie' as const,
      data: [{ values }],
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
        formatMethod: (_: unknown, d: { name?: string; value?: number }) => {
          const name = d.name ?? ''
          const pct =
            totalCost > 0
              ? `${(((d.value ?? 0) / totalCost) * 100).toFixed(1)}%`
              : ''
          return pct ? `${name} ${pct}` : name
        },
      },
      tooltip: {
        mark: {
          title: {
            value: (d: { name?: string }) => d.name ?? '',
          },
          content: [
            {
              key: () => t('Total Cost'),
              value: (d: { value?: number }) => formatCost(d.value ?? 0),
            },
            {
              key: () => t('Tokens Used'),
              value: (d: { tokens?: number }) => formatTokens(d.tokens ?? 0),
            },
            {
              key: () => t('Percentage'),
              value: (d: { value?: number }) => {
                const v = d.value ?? 0
                return totalCost > 0
                  ? `${((v / totalCost) * 100).toFixed(1)}%`
                  : '-'
              },
            },
          ],
        },
      },
      legends: {
        visible: true,
        orient: 'bottom',
        type: 'discrete',
        item: {
          label: {
            style: { fontSize: 11 },
            formatMethod: (label: string) =>
              label.length > 14 ? `${label.slice(0, 14)}…` : label,
          },
        },
        autoPage: true,
      },
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      background: 'transparent',
    }
  }, [sortedData, resolvedTheme, totalCost, t])

  if (sortedData.length === 0) {
    return null
  }

  const barHeight = Math.max(200, sortedData.length * 34)

  return (
    <div className='grid grid-cols-1 md:grid-cols-2'>
      <div className='md:border-r'>
        <div className='flex items-center gap-2 px-5 py-3'>
          <BarChart3 className='text-muted-foreground/60 size-4' />
          <span className='text-sm font-semibold'>
            {t('User Consumption Ranking Top 10')}
          </span>
        </div>
        <div className='p-2' style={{ height: barHeight }}>
          {themeReady && (
            <VChart
              key={`user-bar-${resolvedTheme}`}
              spec={barSpec}
              option={VCHART_OPTION}
            />
          )}
        </div>
      </div>
      <div>
        <div className='flex items-center gap-2 border-t px-5 py-3 md:border-t-0'>
          <PieChart className='text-muted-foreground/60 size-4' />
          <span className='text-sm font-semibold'>
            {t('User Consumption Share Top 10')}
          </span>
          <span className='text-muted-foreground ml-auto text-sm'>
            {t('Total')}: {formatCost(totalCost)}
          </span>
        </div>
        <div
          className='p-2'
          style={{ height: Math.max(300, sortedData.length * 34) }}
        >
          {themeReady && (
            <VChart
              key={`user-pie-${resolvedTheme}`}
              spec={pieSpec}
              option={VCHART_OPTION}
            />
          )}
        </div>
      </div>
    </div>
  )
}
