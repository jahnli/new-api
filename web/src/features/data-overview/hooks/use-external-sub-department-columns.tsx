import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'

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
        cell: ({ row }) => {
          const salesUser = row.original.sales_user
          if (!salesUser) {
            return <span className='text-muted-foreground'>-</span>
          }
          const name = salesUser.display_name || salesUser.username
          return (
            <div className='flex min-w-0 items-center gap-2'>
              <Avatar size='sm' className='shrink-0'>
                {salesUser.avatar_url && (
                  <AvatarImage src={salesUser.avatar_url} alt={name} />
                )}
                <AvatarFallback
                  className='text-xs font-medium text-white'
                  style={getUserAvatarStyle(name)}
                >
                  {getUserAvatarFallback(name)}
                </AvatarFallback>
              </Avatar>
              <span className='min-w-0 truncate'>{name}</span>
            </div>
          )
        },
        size: 160,
      },
      columns.actions,
    ],
    [columns, t]
  )
}
