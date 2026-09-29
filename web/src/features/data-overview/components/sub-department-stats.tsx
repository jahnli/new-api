import { VChart } from '@visactor/react-vchart'
import { BarChart3, Building2, PieChart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTableView,
  useDataTable,
  type DataTablePinnedColumn,
} from '@/components/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExternalMode } from '@/hooks/use-external-mode'
import { toIntlLocale } from '@/i18n/languages'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { useExternalSubDepartmentColumns } from '../hooks/use-external-sub-department-columns'
import { useInternalSubDepartmentColumns } from '../hooks/use-internal-sub-department-columns'
import { createConsumptionTooltip } from '../lib/consumption-tooltip'
import type { SubDepartmentStat } from '../types'
import { DepartmentLogsDialog } from './department-logs-dialog'
import {
  formatSubDepartmentCNY,
  formatSubDepartmentTokens,
} from './shared-sub-department-columns'
import { SubDepartmentStatsDialog } from './sub-department-stats-dialog'

interface SubDepartmentStatsProps {
  data: SubDepartmentStat[]
  companyId: number
  activityFormula?: [number, number, number]
  startTimestamp: number
  endTimestamp: number
  isOverview?: boolean
}

const SUB_DEPARTMENT_PINNED_COLUMNS = [
  { columnId: 'actions', side: 'right' },
] satisfies DataTablePinnedColumn[]

export function SubDepartmentStats(props: SubDepartmentStatsProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { resolvedTheme, themeReady } = useChartTheme()
  const [statsDepartment, setStatsDepartment] =
    useState<SubDepartmentStat | null>(null)
  const [logsDepartment, setLogsDepartment] =
    useState<SubDepartmentStat | null>(null)
  const options = {
    activityFormula: props.activityFormula,
    onViewStats: setStatsDepartment,
    onViewLogs: setLogsDepartment,
  }
  const internalColumns = useInternalSubDepartmentColumns(options)
  const externalColumns = useExternalSubDepartmentColumns(options)
  const columns = useExternalMode() ? externalColumns : internalColumns

  const sortedData = useMemo(
    () =>
      [...props.data].sort((a, b) => b.total_amount_cny - a.total_amount_cny),
    [props.data]
  )

  const { table } = useDataTable({
    data: sortedData,
    columns,
    initialSorting: [{ id: 'total_amount_cny', desc: true }],
    withPaginationRowModel: false,
    withFilteredRowModel: false,
    withFacetedRowModel: false,
  })

  const totalCost = useMemo(
    () => sortedData.reduce((sum, i) => sum + i.total_amount_cny, 0),
    [sortedData]
  )

  const consumptionTooltip = useMemo(
    () => createConsumptionTooltip(t, locale, formatSubDepartmentCNY),
    [t, locale]
  )

  const barSpec = useMemo(() => {
    return {
      type: 'bar' as const,
      data: [
        {
          values: sortedData.map((item) => ({
            ...item,
            name: item.department_name,
            tokens: item.total_tokens,
            cost: item.total_amount_cny,
          })),
        },
      ],
      direction: 'horizontal' as const,
      xField: 'tokens',
      yField: 'name',
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) => formatSubDepartmentTokens(value),
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
            formatMethod: (v: number) => {
              if (v === 0) return '0'
              return `${(v / 1_0000_0000).toFixed(2)} 亿`
            },
          },
        },
      ],
      tooltip: {
        mark: consumptionTooltip,
        dimension: consumptionTooltip,
      },
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      background: 'transparent',
    }
  }, [sortedData, resolvedTheme, consumptionTooltip])

  const pieSpec = useMemo(
    () => ({
      type: 'pie' as const,
      data: [
        {
          values: sortedData
            .filter((i) => i.total_amount_cny > 0)
            .map((i) => ({
              ...i,
              tokens: i.total_tokens,
              cost: i.total_amount_cny,
              name: i.department_name,
              value: i.total_amount_cny,
            })),
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
          ...consumptionTooltip,
          content: [
            ...consumptionTooltip.content,
            {
              key: t('Percentage'),
              value: (d: { value?: number }) =>
                totalCost > 0
                  ? `${(((d.value ?? 0) / totalCost) * 100).toFixed(1)}%`
                  : '-',
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
    }),
    [sortedData, resolvedTheme, totalCost, t, consumptionTooltip]
  )

  if (props.data.length === 0) {
    return null
  }

  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Building2 className='text-primary size-5' />
          {props.isOverview
            ? t('Company Statistics')
            : t('Sub-department Statistics')}
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        {/* Table */}
        <div className='px-2 pb-4'>
          <DataTableView
            table={table}
            containerClassName='border-0 shadow-none'
            applyHeaderSize
            pinnedColumns={SUB_DEPARTMENT_PINNED_COLUMNS}
          />
        </div>

        {/* Charts side by side */}
        <div className='grid grid-cols-1 md:grid-cols-2'>
          {/* Bar chart - consumption ranking */}
          <div className='md:border-r'>
            <div className='flex items-center gap-2 px-5 py-3'>
              <BarChart3 className='text-muted-foreground/60 size-4' />
              <span className='text-sm font-semibold'>
                {t('Token Usage by Department')}
              </span>
            </div>
            <div
              className='p-2'
              style={{ height: Math.max(200, sortedData.length * 34) }}
            >
              {themeReady && (
                <VChart
                  key={`bar-${resolvedTheme}`}
                  spec={barSpec}
                  option={VCHART_OPTION}
                />
              )}
            </div>
          </div>
          {/* Pie chart - consumption share */}
          <div>
            <div className='flex items-center gap-2 border-t px-5 py-3 md:border-t-0'>
              <PieChart className='text-muted-foreground/60 size-4' />
              <span className='text-sm font-semibold'>
                {t('Department Consumption Share')}
              </span>
              <span className='text-muted-foreground ml-auto text-sm'>
                {t('Total')}: {formatSubDepartmentCNY(totalCost)}
              </span>
            </div>
            <div
              className='p-2'
              style={{ height: Math.max(300, sortedData.length * 34) }}
            >
              {themeReady && (
                <VChart
                  key={`pie-${resolvedTheme}`}
                  spec={pieSpec}
                  option={VCHART_OPTION}
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <SubDepartmentStatsDialog
        key={
          statsDepartment
            ? `${props.companyId}-${statsDepartment.department_id}-${props.startTimestamp}-${props.endTimestamp}`
            : 'closed'
        }
        open={!!statsDepartment}
        onOpenChange={(open) => {
          if (!open) setStatsDepartment(null)
        }}
        department={statsDepartment}
        companyId={statsDepartment?.company_id ?? props.companyId}
        isOverview={props.isOverview}
        startTimestamp={props.startTimestamp}
        endTimestamp={props.endTimestamp}
      />
      <DepartmentLogsDialog
        key={
          logsDepartment
            ? `logs-${props.companyId}-${logsDepartment.department_id}-${props.startTimestamp}-${props.endTimestamp}`
            : 'logs-closed'
        }
        open={!!logsDepartment}
        onOpenChange={(open) => {
          if (!open) setLogsDepartment(null)
        }}
        companyId={logsDepartment?.company_id ?? props.companyId}
        departmentId={logsDepartment?.department_id ?? null}
        departmentName={logsDepartment?.department_name ?? ''}
        initialStartTimestamp={props.startTimestamp}
        initialEndTimestamp={props.endTimestamp}
      />
    </Card>
  )
}
