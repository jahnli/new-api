import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAllLogs } from '@/features/usage-logs/api'
import { useCommonLogsColumns } from '@/features/usage-logs/components/columns/common-logs-columns'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { RequestMessagesProvider } from '@/features/usage-logs/components/request-messages-provider'
import { UsageLogsProvider } from '@/features/usage-logs/components/usage-logs-provider'
import { useDemoMode } from '@/hooks/use-demo-mode'
import dayjs from '@/lib/dayjs'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import type { OffHoursDetailTarget } from '../types'
import { OffHoursViolationNoticeButton } from './off-hours-violation-notice'

interface OffHoursDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: OffHoursDetailTarget | null
}

export function OffHoursDetailDialogHeader(props: {
  target: OffHoursDetailTarget
  displayedUsername: string
  windowLabel: string
}) {
  const { t } = useTranslation()
  const demoMode = useDemoMode()

  return (
    <DialogHeader className='shrink-0 gap-2.5'>
      <div className='flex items-center justify-between gap-3 pr-10'>
        <DialogTitle className='min-w-0 truncate'>
          {t('Usage Logs')}
        </DialogTitle>
        <div className='shrink-0'>
          <OffHoursViolationNoticeButton target={props.target} />
        </div>
      </div>
      <LogUserIdentity
        size='sm'
        userId={props.target.userId}
        username={demoMode ? '' : props.target.username}
        displayName={props.displayedUsername}
        avatarUrl={demoMode ? undefined : props.target.avatarUrl}
        canFetchDetails={!demoMode}
      >
        <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-xs'>
          <span className='tabular-nums'>{props.target.date}</span>
          <span className='text-muted-foreground/60'>·</span>
          <span className='tabular-nums'>{props.windowLabel}</span>
          <span className='text-muted-foreground/60'>·</span>
          <span className='tabular-nums'>
            {t('{{value}} requests', {
              value: props.target.requestCount.toLocaleString(),
            })}
          </span>
        </div>
      </LogUserIdentity>
    </DialogHeader>
  )
}

export function OffHoursDetailDialog(props: OffHoursDetailDialogProps) {
  const demoMode = useDemoMode()

  if (!props.target) return null

  const displayedUsername = getDemoModeUsername(
    props.target.displayName,
    demoMode
  )
  const windowLabel = `${dayjs.unix(props.target.windowStart).format('HH:mm')} - ${dayjs
    .unix(props.target.windowEnd)
    .format('HH:mm')}`

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[min(1360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[calc(100vw-2rem)]'>
        <OffHoursDetailDialogHeader
          target={props.target}
          displayedUsername={displayedUsername}
          windowLabel={windowLabel}
        />

        <div className='min-h-0 flex-1 overflow-y-auto pt-2 sm:flex sm:flex-col sm:overflow-hidden'>
          <OffHoursLogsSection target={props.target} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Day-level usage log detail. Reuses the exact common usage-log columns so the
 * table matches the Usage Logs page, scoped to the user's audit window.
 */
function OffHoursLogsSection(props: { target: OffHoursDetailTarget }) {
  const { t } = useTranslation()
  const currentUserRole = useAuthStore((state) => state.auth.user?.role)
  const isSuperAdmin = (currentUserRole ?? 0) >= ROLE.SUPER_ADMIN
  const columns = useCommonLogsColumns(true, {
    canFetchUserDetails: isSuperAdmin,
  })
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'security-audit',
      'off-hours-logs',
      props.target.username,
      props.target.windowStart,
      props.target.windowEnd,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      getAllLogs({
        type: 2,
        username: props.target.username,
        start_timestamp: props.target.windowStart,
        // 后端 end_timestamp 为含端(<=),窗口为右开区间,故减一秒
        end_timestamp: props.target.windowEnd - 1,
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }),
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
        <DataTablePage
          table={table}
          columns={columns as ColumnDef<Record<string, unknown>>[]}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyTitle={t('No Logs Found')}
          emptyDescription={t('No usage logs in this time range.')}
          skeletonKeyPrefix='security-audit-detail-logs'
          applyHeaderSize
          toolbarProps={null}
          className='h-auto min-h-0 sm:flex-1'
          paginationInFooter={false}
          tableClassName='rounded-none border-0 [&_[data-slot=table]]:min-w-[1120px] [&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
        />
      </RequestMessagesProvider>
    </UsageLogsProvider>
  )
}
