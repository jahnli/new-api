import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTablePage,
  DataTableRowActionMenu,
  useDataTable,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { LogUserCell } from '@/features/usage-logs/components/log-user-cell'
import { useMediaQuery } from '@/hooks'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'

import {
  deleteRecords,
  getRecords,
  notificationKeys,
  retryRecords,
} from '../api'
import { notificationDate } from '../lib/message'
import type {
  NotificationChannel,
  NotificationMessage,
  NotificationRecord,
  RecordFilters,
} from '../types'
import { RecordDetail } from './record-detail'
import { NotificationStatusBadge } from './status-badge'

const CHANNEL_LABEL_KEYS: Record<NotificationChannel, string> = {
  feishu: 'Feishu',
  dingtalk: 'DingTalk',
  email: 'Email',
}

const MAX_BATCH_SIZE = 50

export function NotificationHistory(props: {
  onClone: (message: NotificationMessage) => void
  canSend: boolean
  canTest: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const client = useQueryClient()
  const [filters, setFilters] = useState<RecordFilters>(() => {
    const now = dayjs()
    return {
      page: 1,
      page_size: 20,
      from: now.startOf('month').toISOString(),
      to: now.endOf('month').toISOString(),
      include_tests: true,
    }
  })
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [detailId, setDetailId] = useState<number | null>(null)
  const [retryIds, setRetryIds] = useState<number[]>([])
  const [deleteIds, setDeleteIds] = useState<number[]>([])
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({ ...current, page: 1, keyword }))
      setSelected([])
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [keyword])
  const query = useQuery({
    queryKey: [...notificationKeys.records, filters],
    queryFn: () => getRecords(filters),
    placeholderData: keepPreviousData,
    refetchInterval: (state) =>
      state.state.data?.items.some((record) =>
        ['queued', 'sending'].includes(record.status)
      )
        ? 3000
        : false,
  })
  const retry = useMutation({
    retry: false,
    mutationFn: retryRecords,
    onSuccess: (results) => {
      setRetryIds([])
      const failed = results.filter((result) => !result.success)
      setSelected(failed.map((result) => result.id))
      void client.invalidateQueries({ queryKey: notificationKeys.all })
      if (failed.length) {
        toast.error(
          failed
            .map((result) => `#${result.id}: ${result.message ?? t('Failed')}`)
            .join('\n')
        )
      }
      if (failed.length < results.length) toast.success(t('Notification sent'))
    },
  })
  const remove = useMutation({
    mutationFn: deleteRecords,
    onSuccess: (_, ids) => {
      setDeleteIds([])
      setSelected([])
      setDetailId(null)
      if (ids.length >= (query.data?.items.length ?? 0) && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }))
      }
      void client.invalidateQueries({ queryKey: notificationKeys.all })
      toast.success(t('Deleted successfully'))
    },
  })
  const updateFilter = (key: keyof RecordFilters, value: string | boolean) => {
    setFilters((current) => ({
      ...current,
      page: 1,
      [key]: value === '' ? undefined : value,
    }))
    setSelected([])
  }
  const retryable = useCallback(
    (record: NotificationRecord): boolean =>
      ['failed', 'partial'].includes(record.status) &&
      (record.is_test ? props.canTest : props.canSend),
    [props.canSend, props.canTest]
  )
  const selectableIds = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((record) => !['queued', 'sending'].includes(record.status))
        .map((record) => record.id),
    [query.data?.items]
  )
  const selectionIds = useMemo(
    () => selectableIds.slice(0, MAX_BATCH_SIZE),
    [selectableIds]
  )
  const retryableIds = useMemo(
    () =>
      (query.data?.items ?? []).filter(retryable).map((record) => record.id),
    [query.data?.items, retryable]
  )
  const selectedRetryIds = useMemo(
    () => selected.filter((id) => retryableIds.includes(id)),
    [retryableIds, selected]
  )
  const channels = [
    { value: '', label: t('All channels') },
    { value: 'feishu', label: t('Feishu') },
    { value: 'dingtalk', label: t('DingTalk') },
    { value: 'email', label: t('Email') },
  ]
  const statuses = [
    { value: '', label: t('All statuses') },
    { value: 'queued', label: t('Queued') },
    { value: 'sending', label: t('Sending') },
    { value: 'success', label: t('Success') },
    { value: 'failed', label: t('Failed') },
    { value: 'partial', label: t('Partially delivered') },
    { value: 'unknown', label: t('Unknown') },
  ]

  const columns = useMemo<ColumnDef<NotificationRecord>[]>(
    () => [
      {
        id: 'select',
        size: 44,
        enableSorting: false,
        enableHiding: false,
        meta: { mobileHidden: true },
        header: () => (
          <Checkbox
            aria-label={t('Select all')}
            disabled={!selectionIds.length || query.isPlaceholderData}
            checked={
              selectionIds.length > 0 && selected.length === selectionIds.length
            }
            onCheckedChange={(checked) =>
              setSelected(checked ? selectionIds : [])
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`${t('Select')} ${row.original.title}`}
            checked={selected.includes(row.original.id)}
            disabled={
              !selectableIds.includes(row.original.id) ||
              (selected.length >= MAX_BATCH_SIZE &&
                !selected.includes(row.original.id)) ||
              query.isPlaceholderData
            }
            onCheckedChange={(checked) =>
              setSelected((current) =>
                checked
                  ? [...current, row.original.id]
                  : current.filter((id) => id !== row.original.id)
              )
            }
          />
        ),
      },
      {
        id: 'time',
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => notificationDate(row.original.created_at, locale),
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: t('Title'),
        size: 220,
        meta: { mobileTitle: true },
        cell: ({ row }) => (
          <Button
            variant='link'
            className='h-auto max-w-52 justify-start p-0 text-left whitespace-normal'
            onClick={() => setDetailId(row.original.id)}
          >
            {row.original.title}
          </Button>
        ),
      },
      {
        id: 'content',
        accessorKey: 'summary',
        header: t('Content'),
        size: 320,
        cell: ({ row }) => (
          <p className='text-muted-foreground line-clamp-2 max-w-72 text-xs whitespace-normal'>
            {row.original.summary || '-'}
          </p>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('Status'),
        meta: { mobileBadge: true },
        cell: ({ row }) => (
          <NotificationStatusBadge status={row.original.status} />
        ),
      },
      {
        id: 'channel',
        accessorKey: 'channel',
        header: t('Channel'),
        cell: ({ row }) => (
          <Badge variant='outline'>
            {t(CHANNEL_LABEL_KEYS[row.original.channel])}
          </Badge>
        ),
      },
      {
        id: 'type',
        accessorFn: (record) => (record.is_test ? 'test' : 'production'),
        header: t('Type'),
        cell: ({ row }) => (
          <Badge variant={row.original.is_test ? 'secondary' : 'outline'}>
            {row.original.is_test ? t('Test') : t('Production')}
          </Badge>
        ),
      },
      {
        id: 'sender',
        accessorKey: 'sender_name',
        header: t('Sender'),
        cell: ({ row }) => (
          <LogUserCell
            userId={row.original.user_id}
            username={row.original.sender_name}
            displayName={row.original.display_name}
            avatarUrl={row.original.avatar_url || undefined}
            openId={row.original.open_id || undefined}
            gender={row.original.gender}
            canFetchUserDetails={props.canSend}
            sensitiveVisible
          />
        ),
      },
      {
        id: 'actions',
        size: 44,
        enableSorting: false,
        enableHiding: false,
        header: () => <span className='sr-only'>{t('Actions')}</span>,
        cell: ({ row }) => {
          if (!selectableIds.includes(row.original.id)) return null
          const canRetry = retryable(row.original)
          return (
            <DataTableRowActionMenu
              ariaLabel={`${t('More actions')}: ${row.original.title}`}
            >
              {canRetry && (
                <DropdownMenuItem
                  onClick={() => setRetryIds([row.original.id])}
                >
                  {t('Retry')}
                  <DropdownMenuShortcut>
                    <RefreshCw className='size-4' />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
              {canRetry && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className='text-destructive focus:text-destructive'
                onClick={() => setDeleteIds([row.original.id])}
              >
                {t('Delete')}
                <DropdownMenuShortcut>
                  <Trash2 className='size-4' />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </DataTableRowActionMenu>
          )
        },
      },
    ],
    [
      locale,
      query.isPlaceholderData,
      retryable,
      selectableIds,
      selected,
      selectionIds,
      props.canSend,
      t,
    ]
  )
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination: {
      pageIndex: filters.page - 1,
      pageSize: filters.page_size,
    },
    onPaginationChange: (updater) => {
      setFilters((current) => {
        const currentPagination = {
          pageIndex: current.page - 1,
          pageSize: current.page_size,
        }
        const nextPagination =
          typeof updater === 'function' ? updater(currentPagination) : updater
        return {
          ...current,
          page: nextPagination.pageIndex + 1,
          page_size: nextPagination.pageSize,
        }
      })
      setSelected([])
    },
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    totalCount: query.data?.total ?? 0,
  })

  return (
    <div className='space-y-4'>
      {query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          emptyTitle={t('No notification history yet')}
          skeletonKeyPrefix='notification-history-skeleton'
          fixedHeight={false}
          paginationInFooter={false}
          compactPagination={isMobile}
          applyHeaderSize
          tableClassName='[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
          mobileProps={{ getRowKey: (row) => row.original.id }}
          toolbar={
            <div className='bg-card/50 rounded-lg border p-2.5 sm:p-3'>
              <div className='grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14.5rem,1.5fr)_minmax(10rem,1.7fr)_repeat(3,minmax(6.5rem,1fr))_2rem]'>
                <CompactDateTimeRangePicker
                  start={filters.from ? new Date(filters.from) : undefined}
                  end={filters.to ? new Date(filters.to) : undefined}
                  onChange={(range) => {
                    setFilters((current) => ({
                      ...current,
                      page: 1,
                      from: range.start?.toISOString(),
                      to: range.end?.toISOString(),
                    }))
                    setSelected([])
                  }}
                  className='h-8 min-w-0'
                />
                <div className='relative min-w-0'>
                  <Search className='text-muted-foreground pointer-events-none absolute top-2 left-2.5 size-4' />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder={t('Search messages')}
                    aria-label={t('Search messages')}
                    className='h-8 min-w-0 pl-8 text-sm'
                  />
                </div>
                {[
                  {
                    key: 'channel' as const,
                    label: t('Channel'),
                    items: channels,
                  },
                  {
                    key: 'status' as const,
                    label: t('Status'),
                    items: statuses,
                  },
                ].map((filter) => (
                  <Select
                    key={filter.key}
                    items={filter.items}
                    value={filters[filter.key] ?? ''}
                    onValueChange={(value) =>
                      updateFilter(filter.key, value ?? '')
                    }
                  >
                    <SelectTrigger
                      aria-label={filter.label}
                      className='h-8 w-full min-w-0 text-sm'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {filter.items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ))}
                <Input
                  value={filters.sender ?? ''}
                  onChange={(event) =>
                    updateFilter('sender', event.target.value)
                  }
                  placeholder={t('Sender')}
                  aria-label={t('Sender')}
                  className='h-8 min-w-0 text-sm'
                />
                <Button
                  variant='outline'
                  size='icon-sm'
                  aria-label={t('Search')}
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                >
                  <Search className='size-4' />
                </Button>
              </div>
              <div className='mt-2 flex flex-wrap items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <Switch
                    id='include-tests'
                    checked={filters.include_tests}
                    onCheckedChange={(value) =>
                      updateFilter('include_tests', value)
                    }
                  />
                  <Label htmlFor='include-tests'>{t('Include tests')}</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='secondary'
                    size='sm'
                    disabled={
                      !selectedRetryIds.length ||
                      retry.isPending ||
                      remove.isPending ||
                      query.isPlaceholderData
                    }
                    onClick={() => setRetryIds(selectedRetryIds)}
                  >
                    <RefreshCw className='size-3.5' />
                    {t('Retry')}
                    {selectedRetryIds.length > 0 && (
                      <Badge variant='outline'>
                        {formatNumber(selectedRetryIds.length, locale)}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    disabled={
                      !selected.length ||
                      retry.isPending ||
                      remove.isPending ||
                      query.isPlaceholderData
                    }
                    onClick={() => setDeleteIds(selected)}
                  >
                    <Trash2 className='size-3.5' />
                    {t('Delete')}
                    {selected.length > 0 && (
                      <Badge variant='outline'>
                        {formatNumber(selected.length, locale)}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          }
        />
      )}
      <RecordDetail
        id={detailId}
        onClose={() => setDetailId(null)}
        onClone={props.onClone}
        onRetry={(id) => setRetryIds([id])}
        retrying={retry.isPending}
        canSend={props.canSend}
        canTest={props.canTest}
      />
      <ConfirmDialog
        open={retryIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setRetryIds([])
        }}
        title={t('Retry failed recipients')}
        desc={t(
          'Only failed deliveries will be retried. Successful recipients will not receive this message again.'
        )}
        confirmText={t('Retry')}
        isLoading={retry.isPending}
        handleConfirm={() => retry.mutate(retryIds)}
      />
      <ConfirmDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeleteIds([])
        }}
        title={t('Delete')}
        desc={t(
          'Are you sure you want to delete {{count}} notification record(s)? This action cannot be undone.',
          { count: deleteIds.length }
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={remove.isPending}
        handleConfirm={() => remove.mutate(deleteIds)}
      />
    </div>
  )
}
