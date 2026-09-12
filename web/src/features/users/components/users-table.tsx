import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { createServerError } from '@/lib/server-error-message'

import { getUserCompanies, getUsers, searchUsers } from '../api'
import {
  USER_STATUS,
  getUserStatusOptions,
  getUserRoleOptions,
  isUserDeleted,
} from '../constants'
import type { User, UserSortBy, UserSortOrder } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { UserStatusSummary } from './user-status-summary'
import { useUsersColumns } from './users-columns'
import { useUsers } from './users-provider'

const route = getRouteApi('/_authenticated/users/')

function isDisabledUserRow(user: User) {
  return isUserDeleted(user) || user.status === USER_STATUS.DISABLED
}

const USER_COLUMN_SORT_MAP: Partial<Record<string, UserSortBy>> = {
  quota: 'sub_quota_used',
  monthly_total_amount_cny: 'monthly_total_amount_cny',
  average_price: 'monthly_unit_price_per_100m_tokens',
  monthly_total_tokens: 'monthly_total_tokens',
  monthly_total_requests: 'monthly_total_requests',
  id: 'id',
  username: 'username',
  used_quota: 'used_quota',
  created_at: 'created_at',
  role: 'role',
  status: 'status',
}

const USER_COLUMN_VISIBILITY = { company: false }

export function UsersTable() {
  const { t } = useTranslation()
  const columns = useUsersColumns()
  const { refreshTrigger } = useUsers()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ])

  const sortParam = sorting[0]
  const sortBy = sortParam ? USER_COLUMN_SORT_MAP[sortParam.id] : undefined
  let sortOrder: UserSortOrder | undefined
  if (sortBy && sortParam) {
    sortOrder = sortParam.desc ? 'desc' : 'asc'
  }

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: {
      pageSizeStorageKey: 'page-size:users',
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : 20,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
      { columnId: 'group', searchKey: 'group', type: 'string' },
      { columnId: 'company', searchKey: 'company', type: 'array' },
    ],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const roleFilter =
    (columnFilters.find((filter) => filter.id === 'role')?.value as
      | string[]
      | undefined) ?? []
  const groupFilter =
    (columnFilters.find((filter) => filter.id === 'group')?.value as string) ??
    ''
  const companyFilter =
    (columnFilters.find((filter) => filter.id === 'company')?.value as
      | string[]
      | undefined) ?? []

  const { data: companiesResponse } = useQuery({
    queryKey: ['user-companies'],
    queryFn: getUserCompanies,
  })
  const companyOptions = (companiesResponse?.data ?? []).map((company) => ({
    label: company,
    value: company,
    icon: Building2,
  }))

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    if (pagination.pageIndex > 0) {
      onPaginationChange({ ...pagination, pageIndex: 0 })
    }
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'users',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilter,
      roleFilter,
      groupFilter,
      companyFilter,
      refreshTrigger,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const hasColumnFilter =
        statusFilter.length > 0 ||
        roleFilter.length > 0 ||
        Boolean(groupFilter) ||
        companyFilter.length > 0
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort_by: sortBy || undefined,
        sort_order: sortOrder || undefined,
      }

      const result =
        hasFilter || hasColumnFilter
          ? await searchUsers({
              ...params,
              keyword: globalFilter,
              status: statusFilter[0] ?? '',
              role: roleFilter[0] ?? '',
              group: groupFilter,
              company: companyFilter[0] ?? '',
            })
          : await getUsers(params)

      if (!result.success) {
        throw createServerError(
          result,
          t(hasFilter ? 'Failed to search users' : 'Failed to load users')
        )
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
        enabledCount: result.data?.enabled_count || 0,
        disabledCount: result.data?.disabled_count || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const users = data?.items || []

  const { table } = useDataTable({
    data: users,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    sorting,
    initialColumnVisibility: USER_COLUMN_VISIBILITY,
    onSortingChange: handleSortingChange,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fields = [
        row.getValue('username'),
        row.original.display_name,
        row.original.email,
      ]
      return fields.some((field) =>
        String(field || '')
          .toLowerCase()
          .includes(searchValue)
      )
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Users Found')}
      emptyDescription={t(
        'No users available. Try adjusting your search or filters.'
      )}
      skeletonKeyPrefix='users-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by username, name or email...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: getUserStatusOptions(t),
            singleSelect: true,
          },
          {
            columnId: 'role',
            title: t('Role'),
            options: getUserRoleOptions(t),
            singleSelect: true,
          },
          {
            columnId: 'company',
            title: t('Company'),
            options: companyOptions,
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, context) => {
        if (!isDisabledUserRow(row.original)) {
          return undefined
        }
        return context.isMobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
      }}
      bulkActions={<DataTableBulkActions table={table} />}
      paginationSummary={
        <UserStatusSummary
          totalCount={data?.total || 0}
          enabledCount={data?.enabledCount || 0}
          disabledCount={data?.disabledCount || 0}
        />
      }
    />
  )
}
