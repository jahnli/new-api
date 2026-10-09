import { useQuery } from '@tanstack/react-query'
import type {
  PaginationState,
  OnChangeFn,
  ColumnDef,
} from '@tanstack/react-table'
import { ScrollText } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useCommonLogsColumns } from '@/features/usage-logs/components/columns/common-logs-columns'
import { RequestMessagesProvider } from '@/features/usage-logs/components/request-messages-provider'
import { UsageLogsProvider } from '@/features/usage-logs/components/usage-logs-provider'
import type { GetLogsResponse } from '@/features/usage-logs/types'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getDepartmentLogs, getDepartmentUserLogs } from '../api'

interface UserLogsSectionProps {
  companyId: number
  departmentId: string
  userId: number
  startTimestamp: number
  endTimestamp: number
}

export function UserLogsSection(props: UserLogsSectionProps) {
  return (
    <LogsSection
      queryKey={[
        'user-stats-logs',
        props.companyId,
        props.departmentId,
        props.userId,
        props.startTimestamp,
        props.endTimestamp,
      ]}
      queryFn={(pagination) =>
        getDepartmentUserLogs({
          company_id: props.companyId,
          department_id: props.departmentId,
          user_id: props.userId,
          start_timestamp: props.startTimestamp,
          end_timestamp: props.endTimestamp,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
      enabled={props.userId > 0}
      skeletonKeyPrefix='user-stats-logs-skeleton'
    />
  )
}

interface DepartmentLogsSectionProps {
  companyId: number
  departmentId: string
  startTimestamp: number
  endTimestamp: number
}

export function DepartmentLogsSection(props: DepartmentLogsSectionProps) {
  return (
    <LogsSection
      queryKey={[
        'department-logs',
        props.companyId,
        props.departmentId,
        props.startTimestamp,
        props.endTimestamp,
      ]}
      queryFn={(pagination) =>
        getDepartmentLogs({
          company_id: props.companyId,
          department_id: props.departmentId,
          start_timestamp: props.startTimestamp,
          end_timestamp: props.endTimestamp,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
      enabled={!!props.departmentId}
      skeletonKeyPrefix='department-logs-skeleton'
    />
  )
}

interface LogsSectionProps {
  queryKey: readonly unknown[]
  queryFn: (pagination: PaginationState) => Promise<GetLogsResponse>
  enabled: boolean
  skeletonKeyPrefix: string
}

function LogsSection(props: LogsSectionProps) {
  const { t } = useTranslation()
  const currentUserRole = useAuthStore((state) => state.auth.user?.role)
  const isSuperAdmin = (currentUserRole ?? 0) >= ROLE.SUPER_ADMIN
  const columns = useCommonLogsColumns(true, {
    canFetchUserDetails: isSuperAdmin,
    showChannelColumn: isSuperAdmin,
    canViewChannelDetails: isSuperAdmin,
    canViewGroupRatio: isSuperAdmin,
  }).map((column) =>
    'accessorKey' in column && column.accessorKey === 'quota'
      ? { ...column, size: 120 }
      : column
  )
  const [pagination, setPagination] = usePagination()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...props.queryKey, pagination.pageIndex, pagination.pageSize],
    queryFn: () => props.queryFn(pagination),
    enabled: props.enabled,
    staleTime: 60 * 1000,
  })

  const logs = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const requestIds = (logs as Array<{ request_id?: string }>)
    .map((log) => log.request_id ?? '')
    .filter(Boolean)

  const { table } = useDataTable({
    data: logs as Record<string, unknown>[],
    columns: columns as ColumnDef<Record<string, unknown>>[],
    enableRowSelection: false,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualFiltering: true,
    totalCount: total,
  })

  return (
    <UsageLogsProvider>
      <RequestMessagesProvider
        requestIds={requestIds}
        canViewRequestContent={isSuperAdmin}
        isAdmin={isSuperAdmin}
      >
        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
          <h3 className='flex shrink-0 items-center gap-2 text-sm font-medium'>
            <ScrollText className='text-primary size-4' />
            {t('Recent Usage Logs')}
          </h3>
          <DataTablePage
            table={table}
            columns={columns as ColumnDef<Record<string, unknown>>[]}
            isLoading={isLoading}
            isFetching={isFetching}
            emptyTitle={t('No Logs Found')}
            emptyDescription={t('No usage logs in this time range.')}
            skeletonKeyPrefix={props.skeletonKeyPrefix}
            applyHeaderSize
            toolbarProps={null}
            className='min-h-0 flex-1'
            paginationInFooter={false}
            tableClassName='rounded-none border-0 [scrollbar-gutter:stable] [&_[data-slot=table]]:min-w-[1120px] [&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
          />
        </div>
      </RequestMessagesProvider>
    </UsageLogsProvider>
  )
}

function usePagination(): [PaginationState, OnChangeFn<PaginationState>] {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      setPagination((prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      )
    },
    []
  )
  return [pagination, onPaginationChange]
}
