import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { SalesContactsCell } from '@/features/users/components/sales-contacts-cell'

import {
  useSharedSubDepartmentColumns,
  type SubDepartmentColumnsOptions,
} from '../components/shared-sub-department-columns'
import type { SubDepartmentStat } from '../types'

export function useExternalSubDepartmentColumns(
  options: SubDepartmentColumnsOptions
): ColumnDef<SubDepartmentStat>[] {
  const { t } = useTranslation()
  const columns = useSharedSubDepartmentColumns(options)

  return useMemo(
    () => [
      columns.department,
      columns.users,
      columns.tokens,
      columns.cost,
      columns.unitPrice,
      columns.requests,
      columns.activeUsers,
      columns.tokensPerActiveUser,
      {
        accessorKey: 'group',
        header: t('Group'),
        cell: ({ row }) => {
          const group = row.original.group
          return (
            <GroupBadge
              group={group}
              ratio={group ? row.original.group_ratio : undefined}
              className='pr-0.5 text-[12px] [&>span]:text-[12px]'
              containerClassName='gap-0.5'
              ratioClassName='h-4 min-w-0 rounded-sm border-transparent bg-muted/70 px-1 text-[12px] text-muted-foreground [&>span]:text-[12px]'
            />
          )
        },
        size: 140,
      },
      {
        id: 'sales',
        header: t('Sales'),
        enableSorting: false,
        cell: ({ row }) => (
          <SalesContactsCell
            salesUsers={row.original.sales_users}
            salesUser={row.original.sales_user}
          />
        ),
        size: 160,
      },
      columns.actions,
    ],
    [columns, t]
  )
}
