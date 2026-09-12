import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'

import type { User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { useSharedUserColumns } from './shared-user-columns'

export function useUsersColumns(): ColumnDef<User>[] {
  const { t } = useTranslation()

  const sharedColumns = useSharedUserColumns<User>({
    costAccessor: 'monthly_total_amount_cny',
    tokensAccessor: 'monthly_total_tokens',
    requestsAccessor: 'monthly_total_requests',
    modelAccessor: 'monthly_common_model',
    requestCountAccessor: 'monthly_total_requests',
    withGroupBadgeCell: true,
    combineActivityTimes: true,
    combineEmploymentOverview: true,
  })

  return useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label={t('Select all')}
            className='translate-y-[2px]'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('Select row')}
            className='translate-y-[2px]'
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      } satisfies ColumnDef<User>,
      ...sharedColumns,
      {
        accessorKey: 'company',
        header: () => t('Company'),
        enableSorting: false,
        enableHiding: false,
      } satisfies ColumnDef<User>,
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => <DataTableRowActions row={row} />,
        meta: { pinned: 'right' as const },
      } satisfies ColumnDef<User>,
    ],
    [sharedColumns, t]
  )
}
