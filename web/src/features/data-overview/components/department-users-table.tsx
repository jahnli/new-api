import { useQuery } from '@tanstack/react-query'
import type {
  PaginationState,
  OnChangeFn,
  SortingState,
  ColumnDef,
  ColumnFiltersState,
} from '@tanstack/react-table'
import {
  BarChart3,
  CheckCircle2,
  Funnel,
  Loader2,
  ScrollText,
  UserRoundX,
  Users,
} from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  useDataTable,
  type DataTablePinnedColumn,
} from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSharedUserColumns } from '@/features/users/components/shared-user-columns'

import { getDepartmentUsers } from '../api'
import {
  DEPARTMENT_USERS_INITIAL_PAGE_SIZE,
  isInitialDepartmentUsersQuery,
} from '../lib/department-users-query'
import {
  DEPARTMENT_REGISTRATION_STATUS,
  getDepartmentRegistrationStatusLabel,
  getDepartmentUserRegistrationStatus,
  isDepartmentUserRegistered,
} from '../lib/registration-status'
import type {
  DepartmentUser,
  DepartmentUsersResponse,
  UserRankingItem,
} from '../types'
import { DepartmentLogsDialog } from './department-logs-dialog'
import { UserConsumptionCharts } from './user-consumption-charts'
import { UserStatsDialog } from './user-stats-dialog'

interface DepartmentUsersTableProps {
  companyId: number
  departmentId: string
  startTimestamp: number
  endTimestamp: number
  initialUsers?: DepartmentUsersResponse
  initialRankings?: UserRankingItem[]
  initialUsersLoading: boolean
  initialRankingsLoading: boolean
}

const DEPT_COLUMN_SORT_MAP: Record<string, string> = {
  quota: 'sub_quota_used',
  total_amount_cny: 'total_amount_cny',
  average_price: 'unit_price_per_100m_tokens',
  total_tokens: 'total_tokens',
  total_requests: 'total_requests',
  id: 'id',
  username: 'username',
  used_quota: 'used_quota',
  created_at: 'created_at',
  role: 'role',
  status: 'status',
}

const DEPARTMENT_USERS_PINNED_COLUMNS = [
  { columnId: 'actions', side: 'right' },
] satisfies DataTablePinnedColumn[]

const REGISTRATION_STATUS = {
  ALL: 'all',
  ...DEPARTMENT_REGISTRATION_STATUS,
} as const

function getRegistrationStatusFilter(
  columnFilters: ColumnFiltersState
): string | undefined {
  const filterValue = columnFilters.find(
    (filter) => filter.id === 'is_registered'
  )?.value

  if (!Array.isArray(filterValue) || filterValue.length === 0) {
    return undefined
  }

  return String(filterValue[0])
}

export function DepartmentUsersTable(props: DepartmentUsersTableProps) {
  const { t } = useTranslation()
  const companyId = props.companyId
  const departmentId = props.departmentId
  const startTimestamp = props.startTimestamp
  const endTimestamp = props.endTimestamp
  const baseColumns = useSharedUserColumns<DepartmentUser>({
    costAccessor: 'total_amount_cny',
    tokensAccessor: 'total_tokens',
    requestsAccessor: 'total_requests',
    modelAccessor: 'common_model',
    requestCountAccessor: 'total_requests',
    quotaHeaderDescription: undefined,
    usernameClassName: 'text-muted-foreground/70',
    combineActivityTimes: true,
    combineEmploymentOverview: true,
  })

  const [statsUser, setStatsUser] = useState<DepartmentUser | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [pagination, setPagination] = usePagination()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'quota', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const registrationStatusFilter = getRegistrationStatusFilter(columnFilters)

  const setRegistrationStatusFilterValue = useCallback(
    (value: string) => {
      setColumnFilters((prev) => {
        const next = prev.filter((filter) => filter.id !== 'is_registered')
        if (value === REGISTRATION_STATUS.ALL) {
          return next
        }
        return [...next, { id: 'is_registered', value: [value] }]
      })
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    },
    [setPagination]
  )

  const registrationStatusColumn = useMemo<ColumnDef<DepartmentUser>>(
    () => ({
      id: 'is_registered',
      accessorFn: getDepartmentUserRegistrationStatus,
      header: () => (
        <div className='flex items-center gap-1.5'>
          <span>{t('Registration Status')}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  className={
                    registrationStatusFilter
                      ? 'text-primary hover:text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }
                  aria-label={t('Registration Status')}
                />
              }
            >
              <Funnel className='size-3.5' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-36'>
              <DropdownMenuRadioGroup
                value={registrationStatusFilter ?? REGISTRATION_STATUS.ALL}
                onValueChange={setRegistrationStatusFilterValue}
              >
                <DropdownMenuRadioItem value={REGISTRATION_STATUS.ALL}>
                  {t('All')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value={REGISTRATION_STATUS.REGISTERED}>
                  <CheckCircle2 className='text-success size-3.5' />
                  {t('Registered')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value={REGISTRATION_STATUS.UNREGISTERED}>
                  <UserRoundX className='text-muted-foreground size-3.5' />
                  {t('Unregistered')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value={REGISTRATION_STATUS.DEPARTED}>
                  <UserRoundX className='text-warning size-3.5' />
                  {t('Departed')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      cell: ({ row }) => {
        const status = getDepartmentUserRegistrationStatus(row.original)
        const isDeparted = status === REGISTRATION_STATUS.DEPARTED
        let variant: 'success' | 'neutral' | 'warning' = 'success'
        if (status === REGISTRATION_STATUS.UNREGISTERED) {
          variant = 'neutral'
        } else if (isDeparted) {
          variant = 'warning'
        }
        return (
          <StatusBadge
            label={t(getDepartmentRegistrationStatusLabel(status))}
            variant={variant}
            copyable={false}
          />
        )
      },
      enableSorting: false,
      filterFn: (row, id, value) => {
        if (!Array.isArray(value) || value.length === 0) return true
        return value.includes(String(row.getValue(id)))
      },
      size: 150,
      meta: { mobileBadge: true },
    }),
    [registrationStatusFilter, setRegistrationStatusFilterValue, t]
  )

  const columns = useMemo<ColumnDef<DepartmentUser>[]>(() => {
    const createdAtIndex = baseColumns.findIndex((column) => {
      if (column.id === 'created_at') return true
      return (
        'accessorKey' in column &&
        typeof column.accessorKey === 'string' &&
        column.accessorKey === 'created_at'
      )
    })
    const nextColumns = [...baseColumns]
    nextColumns.splice(
      createdAtIndex >= 0 ? createdAtIndex + 1 : nextColumns.length,
      0,
      registrationStatusColumn
    )

    return [
      ...nextColumns,
      {
        id: 'actions',
        header: '',
        size: 80,
        enableSorting: false,
        meta: { pinned: 'right' as const },
        cell: ({ row }) => {
          if (!isDepartmentUserRegistered(row.original)) {
            return <span className='text-muted-foreground text-sm'>-</span>
          }

          return (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onClick={() => setStatsUser(row.original)}
            >
              <BarChart3 className='size-3.5' />
              {t('Statistics')}
            </Button>
          )
        },
      },
    ]
  }, [baseColumns, registrationStatusColumn, t])

  const sortParam = sorting[0]
  const sortBy = sortParam ? (DEPT_COLUMN_SORT_MAP[sortParam.id] ?? '') : ''
  let sortOrder = ''
  if (sortParam) {
    sortOrder = sortParam.desc ? 'desc' : 'asc'
  }

  const isInitialQuery = isInitialDepartmentUsersQuery({
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    registrationStatus: registrationStatusFilter,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'department',
      'users',
      companyId,
      departmentId,
      startTimestamp,
      endTimestamp,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortOrder,
      registrationStatusFilter,
    ],
    queryFn: () =>
      getDepartmentUsers({
        company_id: companyId,
        department_id: departmentId,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort_by: sortBy || undefined,
        sort_order: sortOrder || undefined,
        registration_status: registrationStatusFilter,
        include_unregistered:
          registrationStatusFilter !== REGISTRATION_STATUS.REGISTERED,
      }),
    enabled: !!departmentId && !isInitialQuery,
    staleTime: 60 * 1000,
  })

  const userSummary = isInitialQuery ? props.initialUsers : data?.data
  const users = userSummary?.items ?? []
  const total = userSummary?.total ?? 0
  const totalUsers = userSummary?.total_users ?? 0
  const registeredUsers = userSummary?.registered_users ?? 0
  const unregisteredUsers = userSummary?.unregistered_users ?? 0

  const { table } = useDataTable({
    data: users,
    columns,
    enableRowSelection: false,
    pagination,
    onPaginationChange: setPagination,
    columnFilters,
    onColumnFiltersChange: (updater) => {
      setColumnFilters((prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      )
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    },
    sorting,
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    },
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    totalCount: total,
  })

  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <CardTitle className='flex min-w-0 flex-1 flex-wrap items-center gap-2 text-base'>
            <span className='inline-flex items-center gap-2'>
              <Users className='text-primary size-5' />
              {t('Department Personnel List')}
            </span>
            <span className='flex flex-wrap items-center gap-1.5 text-[13px] font-medium'>
              <span className='rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'>
                {t('Total Users')}: {totalUsers}
              </span>
              <span className='rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'>
                {t('Registered')}: {registeredUsers}
              </span>
              <span className='rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300'>
                {t('Unregistered')}: {unregisteredUsers}
              </span>
            </span>
          </CardTitle>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 gap-1.5 px-2.5 text-xs'
            onClick={() => setLogsOpen(true)}
          >
            <ScrollText className='size-3.5' />
            {t('Logs')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className='px-4 pt-0 pb-4'>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isInitialQuery ? props.initialUsersLoading : isLoading}
          isFetching={isInitialQuery ? props.initialUsersLoading : isFetching}
          emptyTitle={t('No Users Found')}
          emptyDescription={t('No users in this department.')}
          skeletonKeyPrefix='dept-users-skeleton'
          applyHeaderSize
          pinnedColumns={DEPARTMENT_USERS_PINNED_COLUMNS}
          toolbarProps={null}
          fixedHeight={false}
          paginationInFooter={false}
          tableClassName='border-0 rounded-none'
        />
        {props.initialRankingsLoading && (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground size-6 animate-spin' />
          </div>
        )}
        {props.initialRankings && props.initialRankings.length > 0 && (
          <div className='pt-8'>
            <UserConsumptionCharts data={props.initialRankings} />
          </div>
        )}
      </CardContent>
      <UserStatsDialog
        key={
          statsUser
            ? `${statsUser.id}-${startTimestamp}-${endTimestamp}`
            : 'closed'
        }
        open={!!statsUser}
        onOpenChange={(open) => {
          if (!open) setStatsUser(null)
        }}
        user={statsUser}
        companyId={companyId}
        departmentId={departmentId}
        initialStartTimestamp={startTimestamp}
        initialEndTimestamp={endTimestamp}
      />
      <DepartmentLogsDialog
        key={`department-logs-${companyId}-${departmentId}-${startTimestamp}-${endTimestamp}`}
        open={logsOpen}
        onOpenChange={setLogsOpen}
        companyId={companyId}
        departmentId={departmentId}
        departmentName={t('Department Personnel List')}
        initialStartTimestamp={startTimestamp}
        initialEndTimestamp={endTimestamp}
      />
    </Card>
  )
}

function usePagination(): [PaginationState, OnChangeFn<PaginationState>] {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEPARTMENT_USERS_INITIAL_PAGE_SIZE,
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
