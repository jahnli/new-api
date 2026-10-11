import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { TextTooltip } from '@/components/text-tooltip'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getRecordDeliveries, notificationKeys } from '../api'
import type { DeliveryFilters, NotificationDelivery } from '../types'
import { NotificationStatusBadge } from './status-badge'

export function DeliveryTable(props: { recordId: number; active: boolean }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [username, setUsername] = useState('')
  const [filters, setFilters] = useState<DeliveryFilters>({
    page: 1,
    page_size: 10,
  })
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        page: 1,
        username: username.trim(),
      }))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [username])
  const query = useQuery({
    queryKey: notificationKeys.deliveries(props.recordId, filters),
    queryFn: ({ signal }) =>
      getRecordDeliveries(props.recordId, filters, signal),
    placeholderData: keepPreviousData,
    refetchInterval: props.active ? 2000 : false,
  })
  const refetch = query.refetch
  const previouslyActive = useRef(props.active)
  useEffect(() => {
    // Fetch the final results when the parent record stops polling. Mounting an
    // already finished record must not refetch, because that cancels the
    // request the mount just started.
    if (previouslyActive.current && !props.active) void refetch()
    previouslyActive.current = props.active
  }, [props.active, refetch])
  const statuses = [
    { value: '', label: t('All statuses') },
    { value: 'queued', label: t('Queued') },
    { value: 'sending', label: t('Sending') },
    { value: 'success', label: t('Success') },
    { value: 'failed', label: t('Failed') },
    { value: 'unknown', label: t('Unknown') },
  ]
  const columns = useMemo<ColumnDef<NotificationDelivery>[]>(
    () => [
      {
        accessorKey: 'username',
        header: t('Recipient'),
        cell: ({ row }) => (
          <TextTooltip content={row.original.recipient}>
            <span className='text-xs [overflow-wrap:anywhere] whitespace-normal'>
              {row.original.username || row.original.recipient}
            </span>
          </TextTooltip>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <NotificationStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: 'error',
        header: t('Error'),
        cell: ({ row }) => (
          <p className='text-xs [overflow-wrap:anywhere] whitespace-normal'>
            {row.original.error || '—'}
          </p>
        ),
      },
      {
        accessorKey: 'attempts',
        header: t('Attempts'),
        cell: ({ row }) => formatNumber(row.original.attempts, locale),
      },
    ],
    [locale, t]
  )
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination: { pageIndex: filters.page - 1, pageSize: filters.page_size },
    onPaginationChange: (updater) => {
      setFilters((current) => {
        const previous = {
          pageIndex: current.page - 1,
          pageSize: current.page_size,
        }
        const next = typeof updater === 'function' ? updater(previous) : updater
        return {
          ...current,
          page: next.pageIndex + 1,
          page_size: next.pageSize,
        }
      })
    },
    totalCount: query.data?.total ?? 0,
    ensurePageInRange: (pageCount) => {
      if (!query.data || query.isPlaceholderData) return
      const lastPage = Math.max(1, pageCount)
      setFilters((current) =>
        current.page > lastPage ? { ...current, page: lastPage } : current
      )
    },
    manualPagination: true,
    manualFiltering: true,
    getRowId: (delivery) => String(delivery.id),
    enableSorting: false,
    enableRowSelection: false,
  })

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex shrink-0 flex-wrap items-center gap-2'>
        <div className='relative min-w-48 flex-1 sm:max-w-xs'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4'
            aria-hidden='true'
          />
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t('Search username')}
            aria-label={t('Search username')}
            maxLength={128}
            className='pl-8'
          />
        </div>
        <Select
          items={statuses}
          value={filters.status ?? ''}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              status: value || undefined,
            }))
          }
        >
          <SelectTrigger aria-label={t('Status')} className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='start' alignItemWithTrigger={false}>
            <SelectGroup>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {query.isFetching && <Spinner className='size-4' />}
      </div>
      {query.isError && !query.isFetching ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <DataTableView
          table={table}
          splitHeader
          isLoading={query.isPending || (!query.data && query.isFetching)}
          containerClassName='min-h-0 flex-1'
          containerProps={{ 'aria-busy': query.isFetching }}
          tableContainerClassName='h-full min-h-0'
          emptyContent={t('No results found')}
        />
      )}
      <div className='shrink-0'>
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
