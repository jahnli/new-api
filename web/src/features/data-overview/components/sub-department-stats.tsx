import type { ColumnDef } from '@tanstack/react-table'
import { VChart } from '@visactor/react-vchart'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  ChevronsUpDown,
  Info,
  PieChart,
  ScrollText,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTableView,
  useDataTable,
  type DataTablePinnedColumn,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { getActiveUserRateClassName } from '../lib/active-user-rate'
import type { SubDepartmentStat } from '../types'
import { ActivityFormulaTooltip } from './activity-formula-tooltip'
import { DepartmentLogsDialog } from './department-logs-dialog'
import { SubDepartmentStatsDialog } from './sub-department-stats-dialog'

interface SubDepartmentStatsProps {
  data: SubDepartmentStat[]
  companyId: number
  activityFormula?: [number, number, number]
  startTimestamp: number
  endTimestamp: number
}

const SUB_DEPARTMENT_PINNED_COLUMNS = [
  { columnId: 'actions', side: 'right' },
] satisfies DataTablePinnedColumn[]

function formatCNY(amount: number): string {
  if (!amount) return '¥0'
  return `¥${amount.toFixed(2)}`
}

function formatUnitPrice(amount: number, unitLabel: string): string {
  if (!amount) return `¥0/${unitLabel}`
  return `¥${amount.toFixed(2)}/${unitLabel}`
}

function formatTokens(tokens: number): string {
  if (!tokens) return '0'
  return `${(tokens / 1_0000_0000).toFixed(2)} 亿`
}

function formatTokensDetail(tokens: number): string {
  if (tokens === 0) return '0'
  return tokens.toLocaleString()
}

function formatRequests(count: number): string {
  if (count >= 1_0000) return `${(count / 1_0000).toFixed(2)} 万`
  return count.toLocaleString()
}

function useSubDepartmentColumns(
  activityFormula: [number, number, number] | undefined,
  onViewStats: (department: SubDepartmentStat) => void,
  onViewLogs: (department: SubDepartmentStat) => void
): ColumnDef<SubDepartmentStat>[] {
  const { t } = useTranslation()

  return useMemo(
    (): ColumnDef<SubDepartmentStat>[] => [
      {
        accessorKey: 'department_name',
        header: t('Department'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='font-medium'>{row.original.department_name}</span>
        ),
        size: 200,
      },
      {
        id: 'users',
        accessorFn: (row) => row.registered_users,
        header: t('Registered/Total'),
        cell: ({ row }) => (
          <div className='whitespace-nowrap'>
            <span className='font-medium'>{row.original.registered_users}</span>
            <span className='text-muted-foreground mx-0.5'>/</span>
            <span className='text-muted-foreground'>
              {row.original.total_users}
            </span>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: 'total_tokens',
        header: t('Tokens'),
        cell: ({ row }) => {
          const tokens = row.original.total_tokens
          const display = formatTokens(tokens)
          const detail = formatTokensDetail(tokens)
          if (detail && detail !== display) {
            return (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className='text-muted-foreground cursor-default font-mono' />
                  }
                >
                  {display}
                </TooltipTrigger>
                <TooltipContent>
                  <span className='font-mono text-xs'>{detail}</span>
                </TooltipContent>
              </Tooltip>
            )
          }
          return (
            <span className='text-muted-foreground font-mono'>{display}</span>
          )
        },
        size: 120,
      },
      {
        accessorKey: 'total_amount_cny',
        header: t('Cost'),
        cell: ({ row }) => (
          <span className='font-mono font-medium'>
            {formatCNY(row.original.total_amount_cny)}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'unit_price_per_100m_tokens',
        header: ({ column }) => {
          const description = t('Unit price per 100M tokens')
          const sorted = column.getIsSorted()
          let SortIcon = ChevronsUpDown
          if (sorted === 'desc') {
            SortIcon = ArrowDown
          } else if (sorted === 'asc') {
            SortIcon = ArrowUp
          }

          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type='button'
                    className='hover:bg-accent hover:text-accent-foreground -ms-3 inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors'
                    onClick={() => column.toggleSorting(sorted === 'asc')}
                    aria-label={description}
                  />
                }
              >
                <span className='inline-flex items-center gap-1'>
                  <span>{t('Unit Price')}</span>
                  <Info className='text-muted-foreground size-3.5 shrink-0 translate-y-px' />
                </span>
                <SortIcon className='ms-1 size-4' />
              </TooltipTrigger>
              <TooltipContent className='max-w-64'>
                <p className='text-xs leading-relaxed'>{description}</p>
              </TooltipContent>
            </Tooltip>
          )
        },
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono'>
            {formatUnitPrice(
              row.original.unit_price_per_100m_tokens,
              t('100M Tokens')
            )}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'total_requests',
        header: t('Request Count'),
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono'>
            {formatRequests(row.original.total_requests)}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'active_users',
        header: () => (
          <span className='inline-flex items-center gap-1'>
            {t('Users / Share')}
            {activityFormula && (
              <ActivityFormulaTooltip formula={activityFormula} />
            )}
          </span>
        ),
        cell: ({ row }) => (
          <span
            className={`${getActiveUserRateClassName(row.original.active_user_rate)} font-mono whitespace-nowrap`}
          >
            {row.original.active_users.toLocaleString()} /{' '}
            {row.original.active_user_rate.toFixed(1)}%
          </span>
        ),
        size: 160,
      },
      {
        accessorKey: 'avg_tokens_per_active_user_mt',
        header: t('Tokens per Active User'),
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono whitespace-nowrap'>
            {formatTokens(
              row.original.avg_tokens_per_active_user_mt * 1_000_000
            )}
          </span>
        ),
        size: 160,
      },
      {
        id: 'actions',
        header: '',
        size: 190,
        enableSorting: false,
        meta: { pinned: 'right' as const },
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onClick={() => onViewStats(row.original)}
            >
              <BarChart3 className='size-3.5' />
              {t('Statistics')}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onClick={() => onViewLogs(row.original)}
            >
              <ScrollText className='size-3.5' />
              {t('Logs')}
            </Button>
          </div>
        ),
      },
    ],
    [activityFormula, onViewLogs, onViewStats, t]
  )
}

export function SubDepartmentStats(props: SubDepartmentStatsProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const [statsDepartment, setStatsDepartment] =
    useState<SubDepartmentStat | null>(null)
  const [logsDepartment, setLogsDepartment] =
    useState<SubDepartmentStat | null>(null)
  const columns = useSubDepartmentColumns(
    props.activityFormula,
    setStatsDepartment,
    setLogsDepartment
  )

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

  const barSpec = useMemo(() => {
    const tooltipContent = [
      {
        key: 'Token',
        value: (d: { tokens?: number }) => formatTokens(d.tokens ?? 0),
      },
      {
        key: t('Cost'),
        value: (d: { cost?: number }) => {
          const v = d.cost ?? 0
          return v === 0 ? '¥0' : `¥${v.toFixed(2)}`
        },
      },
    ]

    return {
      type: 'bar' as const,
      data: [
        {
          values: sortedData.map((item) => ({
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
        formatMethod: (value: number) => formatTokens(value),
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
        mark: { content: tooltipContent },
        dimension: { content: tooltipContent },
      },
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      background: 'transparent',
    }
  }, [sortedData, resolvedTheme, t])

  const pieSpec = useMemo(
    () => ({
      type: 'pie' as const,
      data: [
        {
          values: sortedData
            .filter((i) => i.total_amount_cny > 0)
            .map((i) => ({
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
          content: [
            {
              key: (d: { name?: string }) => d.name ?? '',
              value: (d: { value?: number }) => {
                const v = d.value ?? 0
                const cost = v === 0 ? '¥0' : `¥${v.toFixed(2)}`
                const pct =
                  totalCost > 0 ? `${((v / totalCost) * 100).toFixed(1)}%` : ''
                return pct ? `${cost} (${pct})` : cost
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
    }),
    [sortedData, resolvedTheme, totalCost]
  )

  if (props.data.length === 0) {
    return null
  }

  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Building2 className='text-primary size-5' />
          {t('Sub-department Statistics')}
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
                {t('Total')}:{' '}
                {totalCost === 0 ? '¥0' : `¥${totalCost.toFixed(2)}`}
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
        companyId={props.companyId}
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
        companyId={props.companyId}
        departmentId={logsDepartment?.department_id ?? null}
        departmentName={logsDepartment?.department_name ?? ''}
        initialStartTimestamp={props.startTimestamp}
        initialEndTimestamp={props.endTimestamp}
      />
    </Card>
  )
}
