import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronsUpDown,
  Info,
  ScrollText,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { TextTooltip } from '@/components/text-tooltip'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getActiveUserRateClassName } from '../lib/active-user-rate'
import type { SubDepartmentStat } from '../types'
import { ActivityFormulaTooltip } from './activity-formula-tooltip'

export interface SubDepartmentColumnsOptions {
  activityFormula?: [number, number, number]
  onViewStats: (department: SubDepartmentStat) => void
  onViewLogs: (department: SubDepartmentStat) => void
}

export function formatSubDepartmentCNY(amount: number): string {
  if (!amount) return '¥0'
  return `¥${amount.toFixed(2)}`
}

export function formatSubDepartmentTokens(tokens: number): string {
  if (!tokens) return '0'
  return `${(tokens / 1_0000_0000).toFixed(2)} 亿`
}

export function useSharedSubDepartmentColumns({
  activityFormula,
  onViewStats,
  onViewLogs,
}: SubDepartmentColumnsOptions) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return useMemo(
    () =>
      ({
        department: {
          accessorKey: 'department_name',
          header: t('Department'),
          enableSorting: false,
          cell: ({ row }) => (
            <span className='font-medium'>{row.original.department_name}</span>
          ),
          size: 200,
        },
        users: {
          id: 'users',
          accessorFn: (row) => row.registered_users,
          header: t('Registered/Total'),
          cell: ({ row }) => (
            <div className='whitespace-nowrap'>
              <span className='font-medium'>
                {row.original.registered_users}
              </span>
              <span className='text-muted-foreground mx-0.5'>/</span>
              <span className='text-muted-foreground'>
                {row.original.total_users}
              </span>
            </div>
          ),
          size: 140,
        },
        tokens: {
          accessorKey: 'total_tokens',
          header: t('Tokens'),
          cell: ({ row }) => {
            const tokens = row.original.total_tokens
            const display = formatSubDepartmentTokens(tokens)
            const detail = formatNumber(tokens, locale, {
              maximumFractionDigits: 3,
            })
            const content = (
              <span className='text-muted-foreground cursor-default font-mono'>
                {display}
              </span>
            )
            if (detail === display) return content

            return (
              <TextTooltip
                content={<span className='font-mono text-xs'>{detail}</span>}
              >
                {content}
              </TextTooltip>
            )
          },
          size: 120,
        },
        cost: {
          accessorKey: 'total_amount_cny',
          header: t('Cost'),
          cell: ({ row }) => (
            <span className='font-mono font-medium'>
              {formatSubDepartmentCNY(row.original.total_amount_cny)}
            </span>
          ),
          size: 120,
        },
        unitPrice: {
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
              <TextTooltip
                content={
                  <p className='text-xs leading-relaxed'>{description}</p>
                }
                contentClassName='max-w-64'
              >
                <Button
                  variant='ghost'
                  className='hover:bg-accent hover:text-accent-foreground -ms-3 h-8 gap-1 rounded-md px-3'
                  onClick={() => column.toggleSorting(sorted === 'asc')}
                  aria-label={description}
                >
                  <span className='inline-flex items-center gap-1'>
                    <span>{t('Unit Price')}</span>
                    <Info className='text-muted-foreground size-3.5 shrink-0 translate-y-px' />
                  </span>
                  <SortIcon className='ms-1 size-4' />
                </Button>
              </TextTooltip>
            )
          },
          cell: ({ row }) => (
            <span className='text-muted-foreground font-mono'>
              {formatSubDepartmentCNY(row.original.unit_price_per_100m_tokens)}/
              {t('100M Tokens')}
            </span>
          ),
          size: 120,
        },
        requests: {
          accessorKey: 'total_requests',
          header: t('Request Count'),
          cell: ({ row }) => {
            const count = row.original.total_requests
            return (
              <span className='text-muted-foreground font-mono'>
                {count >= 1_0000
                  ? `${(count / 1_0000).toFixed(2)} 万`
                  : formatNumber(count, locale, { maximumFractionDigits: 3 })}
              </span>
            )
          },
          size: 120,
        },
        activeUsers: {
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
              {formatNumber(row.original.active_users, locale, {
                maximumFractionDigits: 3,
              })}{' '}
              / {row.original.active_user_rate.toFixed(1)}%
            </span>
          ),
          size: 160,
        },
        tokensPerActiveUser: {
          accessorKey: 'avg_tokens_per_active_user_mt',
          header: t('Tokens per Active User'),
          cell: ({ row }) => (
            <span className='text-muted-foreground font-mono whitespace-nowrap'>
              {formatSubDepartmentTokens(
                row.original.avg_tokens_per_active_user_mt * 1_000_000
              )}
            </span>
          ),
          size: 160,
        },
        actions: {
          id: 'actions',
          header: '',
          size: 190,
          enableSorting: false,
          meta: { pinned: 'right' },
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
      }) satisfies Record<string, ColumnDef<SubDepartmentStat>>,
    [activityFormula, locale, onViewLogs, onViewStats, t]
  )
}
