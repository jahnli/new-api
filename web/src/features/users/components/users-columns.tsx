import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell, DataTableColumnHeaderFilter } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { useExternalMode } from '@/hooks/use-external-mode'
import { cn } from '@/lib/utils'

import {
  USER_CUSTOMER_TYPES,
  USER_SETTLEMENT_MODES,
  getRegistrationMethodOptions,
  getUserCustomerTypeOptions,
  getUserSettlementModeOptions,
} from '../constants'
import type { User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { userNameColumn, useSharedUserColumns } from './shared-user-columns'

function userCustomerTypeColumn(t: (key: string) => string): ColumnDef<User> {
  return {
    accessorKey: 'customer_type',
    header: ({ column }) => (
      <DataTableColumnHeaderFilter
        column={column}
        label={t('Customer Type')}
        options={getUserCustomerTypeOptions(t)}
      />
    ),
    cell: ({ row }) => {
      const config = USER_CUSTOMER_TYPES[row.original.customer_type ?? 'unset']
      return (
        <BadgeCell>
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            icon={config.icon}
            size='lg'
            copyable={false}
            className={cn('border shadow-xs', config.className)}
          />
        </BadgeCell>
      )
    },
    enableSorting: false,
    size: 120,
  }
}

function userSettlementModeColumn(t: (key: string) => string): ColumnDef<User> {
  return {
    accessorKey: 'settlement_mode',
    header: ({ column }) => (
      <DataTableColumnHeaderFilter
        column={column}
        label={t('Settlement Mode')}
        options={getUserSettlementModeOptions(t)}
      />
    ),
    cell: ({ row }) => {
      const config =
        USER_SETTLEMENT_MODES[row.original.settlement_mode ?? 'prepaid']
      return (
        <BadgeCell>
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            icon={config.icon}
            size='lg'
            copyable={false}
            className={cn('border shadow-xs', config.className)}
          />
        </BadgeCell>
      )
    },
    enableSorting: false,
    size: 130,
  }
}

export function useUsersColumns(
  groupRatios?: Readonly<Record<string, number>>
): ColumnDef<User>[] {
  const { t } = useTranslation()
  const externalMode = useExternalMode()
  const demoMode = useDemoMode()

  const sharedColumns = useSharedUserColumns<User>({
    costAccessor: 'monthly_total_amount_cny',
    tokensAccessor: 'monthly_total_tokens',
    requestsAccessor: 'monthly_total_requests',
    modelAccessor: 'monthly_common_model',
    requestCountAccessor: 'monthly_total_requests',
    groupRatios,
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
        accessorKey: 'registration_method',
        header: ({ column }) => (
          <DataTableColumnHeaderFilter
            column={column}
            label={t('Registration Method')}
            options={getRegistrationMethodOptions(t)}
          />
        ),
        cell: ({ row }) => {
          const method = getRegistrationMethodOptions(t).find(
            (option) => option.value === row.original.registration_method
          )
          if (!method) return null
          return (
            <div className='flex items-center gap-x-2'>
              <method.icon size={16} className='text-muted-foreground' />
              <span className='text-sm'>{method.label}</span>
            </div>
          )
        },
        enableSorting: false,
        size: 150,
      } satisfies ColumnDef<User>,
      ...(externalMode
        ? [
            {
              ...userNameColumn<User>(t, demoMode, {
                getUser: (user) => user.sales_user,
              }),
              accessorKey: undefined,
              id: 'sales',
              header: () => t('Sales'),
              enableSorting: false,
              meta: undefined,
            } satisfies ColumnDef<User>,
            userCustomerTypeColumn(t),
            userSettlementModeColumn(t),
          ]
        : []),
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
    [sharedColumns, t, externalMode, demoMode]
  )
}
