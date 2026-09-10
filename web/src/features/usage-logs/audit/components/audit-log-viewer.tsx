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
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useTableUrlState, type NavigateFn } from '@/hooks/use-table-url-state'
import { useAuthStore } from '@/stores/auth-store'

import {
  getAuditLogs,
  type AuditFilters,
  type AuditLog,
  type AuditSearchState,
} from '../api'
import { useAuditLogColumns } from './audit-log-columns'
import { AuditLogFilterBar } from './audit-log-filter-bar'

const EMPTY_LOGS: AuditLog[] = []

export function AuditLogViewer(props: {
  scope: 'all' | 'self'
  accessOnly?: boolean
  currentTokenRef?: string
  onAccessDenied?: () => Promise<void>
  search?: AuditSearchState
  navigate?: NavigateFn
}) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [localSearch, setLocalSearch] = useState<AuditSearchState>({})
  const [tokenScope, setTokenScope] = useState('all')
  const localNavigate = useCallback<NavigateFn>((options) => {
    setLocalSearch((previous) => {
      if (options.search === true) return previous
      const next =
        typeof options.search === 'function'
          ? options.search(previous)
          : options.search
      return next as AuditSearchState
    })
  }, [])
  const search = props.search ?? localSearch
  const navigate = props.navigate ?? localNavigate
  const tableState = useTableUrlState({
    search,
    navigate,
    pagination: {
      pageKey: 'auditPage',
      pageSizeKey: 'auditPageSize',
      pageSizeStorageKey: props.accessOnly
        ? 'page-size:audit-access'
        : 'page-size:audit',
      defaultPageSize: 20,
    },
    globalFilter: { enabled: false },
  })
  const filters = useMemo<AuditFilters>(
    () => ({
      p: tableState.pagination.pageIndex + 1,
      page_size: tableState.pagination.pageSize,
      start_timestamp: search.auditStartTime,
      end_timestamp: search.auditEndTime,
      success: search.auditSuccess,
      category: search.auditCategory,
      token_ref: search.auditTokenRef,
      username: search.auditUsername,
      request_id: search.auditRequestId,
    }),
    [search, tableState.pagination]
  )
  const params = { ...filters }
  if (props.accessOnly) params.category = 'access_token'
  if (tokenScope === 'current') params.token_ref = props.currentTokenRef
  if (tokenScope === 'historical') {
    params.exclude_token_ref = props.currentTokenRef
  }
  const canQuery =
    tokenScope === 'all' ||
    (props.currentTokenRef !== undefined &&
      (tokenScope === 'historical' || !!props.currentTokenRef))
  const invalidRange =
    filters.start_timestamp !== undefined &&
    filters.end_timestamp !== undefined &&
    filters.start_timestamp > filters.end_timestamp
  const query = useQuery({
    queryKey: ['audit', userId, props.scope, params],
    queryFn: () => getAuditLogs(props.scope, params),
    enabled: canQuery && !invalidRange,
    retry: false,
  })
  const accessDenied =
    props.scope === 'all' &&
    isAxiosError(query.error) &&
    query.error.response?.status === 403
  const onAccessDenied = props.onAccessDenied
  useEffect(() => {
    if (accessDenied) void onAccessDenied?.()
  }, [accessDenied, onAccessDenied])
  const columns = useAuditLogColumns(props.accessOnly, props.scope === 'all')
  const { table } = useDataTable({
    columns,
    data:
      canQuery && !query.isError
        ? (query.data?.items ?? EMPTY_LOGS)
        : EMPTY_LOGS,
    getRowId: (entry) => entry.event_id,
    totalCount: query.isError ? 0 : (query.data?.total ?? 0),
    pagination: tableState.pagination,
    onPaginationChange: (updater) => {
      if (query.isFetching || query.isError || invalidRange || !canQuery) return
      const next =
        typeof updater === 'function' ? updater(tableState.pagination) : updater
      tableState.onPaginationChange(
        next.pageSize === tableState.pagination.pageSize
          ? next
          : { ...next, pageIndex: 0 }
      )
    },
    enableRowSelection: false,
    enableSorting: false,
    manualFiltering: true,
    manualPagination: true,
    ensurePageInRange: tableState.ensurePageInRange,
  })
  const update = useCallback(
    (patch: Partial<AuditFilters>) => {
      navigate({
        search: (previous) => {
          const next: AuditSearchState = {
            ...previous,
            auditPage: undefined,
          }
          if ('start_timestamp' in patch) {
            next.auditStartTime = patch.start_timestamp
          }
          if ('end_timestamp' in patch) {
            next.auditEndTime = patch.end_timestamp
          }
          if ('success' in patch) next.auditSuccess = patch.success
          if ('category' in patch) next.auditCategory = patch.category
          if ('token_ref' in patch) next.auditTokenRef = patch.token_ref
          if ('username' in patch) next.auditUsername = patch.username
          if ('request_id' in patch) next.auditRequestId = patch.request_id
          return next
        },
      })
    },
    [navigate]
  )

  const reset = useCallback(() => {
    setTokenScope('all')
    navigate({
      search: (previous) => ({
        ...previous,
        auditPage: undefined,
        auditStartTime: undefined,
        auditEndTime: undefined,
        auditSuccess: undefined,
        auditCategory: undefined,
        auditTokenRef: undefined,
        auditUsername: undefined,
        auditRequestId: undefined,
      }),
    })
  }, [navigate])

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={query.isPending && canQuery && !invalidRange}
        isFetching={query.isFetching}
        emptyTitle={
          query.isError ? t('Failed to load audit records') : t('No records')
        }
        hideMobile={props.accessOnly}
        paginationInFooter={!props.accessOnly}
        className='h-auto min-h-0 flex-1'
        applyHeaderSize
        getColumnClassName={() => 'py-2'}
        tableClassName='[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
        toolbar={
          <div className='shrink-0 space-y-2'>
            <AuditLogFilterBar
              table={table}
              filters={filters}
              onChange={update}
              scope={props.scope}
              accessOnly={props.accessOnly}
              tokenScope={tokenScope}
              currentTokenRef={props.currentTokenRef}
              onTokenScopeChange={(value) => {
                setTokenScope(value)
                update({})
              }}
              isFetching={query.isFetching}
              onSearch={() => {
                if (!invalidRange && canQuery) void query.refetch()
              }}
              onReset={reset}
            />
            {invalidRange && (
              <Alert variant='destructive'>
                <AlertDescription>
                  {t('End time must be after start time')}
                </AlertDescription>
              </Alert>
            )}
            {query.isError && (
              <Alert variant='destructive'>
                <AlertDescription className='flex items-center justify-between gap-2'>
                  <span>{t('Failed to load audit records')}</span>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => void query.refetch()}
                  >
                    {t('Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        }
      />
    </div>
  )
}
