import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  TruncatedCell,
  useDataTable,
} from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getSMTPAudits, type SMTPAudit, type SMTPAuditFilters } from './api'
import { SMTPDetailsDialog } from './details-dialog'
import { SMTPFilterBar } from './filter-bar'
import { useSMTPLabels } from './labels'

const EMPTY_RECORDS: SMTPAudit[] = []

function getDefaultSMTPAuditFilters(): SMTPAuditFilters {
  const now = dayjs()
  return {
    start_timestamp: now.startOf('month').unix(),
    end_timestamp: now.endOf('month').unix(),
  }
}

export default function SMTPAuditPanel() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { statuses, purposes, stageLabel, diagnosticLabel } = useSMTPLabels()
  const user = useAuthStore((state) => state.auth.user)
  const allowed = !!user && user.role >= ROLE.SUPER_ADMIN
  const [draft, setDraft] = useState<SMTPAuditFilters>(
    getDefaultSMTPAuditFilters
  )
  const [filters, setFilters] = useState<SMTPAuditFilters>(draft)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const invalidRange =
    draft.start_timestamp !== undefined &&
    draft.end_timestamp !== undefined &&
    draft.start_timestamp > draft.end_timestamp
  const invalidUser =
    !!draft.user_id &&
    (!/^\d+$/.test(draft.user_id) ||
      !Number.isSafeInteger(Number(draft.user_id)))
  const query = useQuery({
    queryKey: ['smtp-audit', user?.id, 'list', filters, pagination],
    queryFn: ({ signal }) =>
      getSMTPAudits(
        {
          ...filters,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        },
        signal
      ),
    enabled: allowed,
    retry: false,
    gcTime: 0,
    refetchInterval: (query) =>
      query.state.status !== 'error' &&
      query.state.data?.items.some((record) => record.status === 'sending')
        ? 5000
        : false,
    refetchIntervalInBackground: false,
  })
  const columns: ColumnDef<SMTPAudit>[] = [
    {
      accessorKey: 'started_at',
      header: t('Start Time'),
      cell: ({ row }) => formatTimestampToDate(row.original.started_at),
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === 'failed' ? 'destructive' : 'outline'}
        >
          {statuses[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'purpose',
      header: t('Purpose'),
      cell: ({ row }) => purposes[row.original.purpose] ?? row.original.purpose,
    },
    {
      accessorKey: 'recipient',
      header: t('Recipient'),
      cell: ({ row }) => (
        <TruncatedCell className='max-w-56'>
          {row.original.recipient}
        </TruncatedCell>
      ),
    },
    {
      accessorKey: 'subject',
      header: t('Subject'),
      cell: ({ row }) => (
        <TruncatedCell className='max-w-56'>
          {row.original.subject}
        </TruncatedCell>
      ),
    },
    {
      accessorKey: 'user_id',
      header: t('User ID'),
      cell: ({ row }) =>
        row.original.user_id === 0
          ? t('Not recorded')
          : formatNumber(row.original.user_id, locale),
    },
    {
      accessorKey: 'actor_id',
      header: t('Actor ID'),
      cell: ({ row }) =>
        row.original.actor_id === 0
          ? t('System or unauthenticated')
          : formatNumber(row.original.actor_id, locale),
    },
    {
      accessorKey: 'duration_ms',
      header: t('Duration (ms)'),
      cell: ({ row }) => formatNumber(row.original.duration_ms, locale),
    },
    {
      accessorKey: 'stage',
      header: t('Stage'),
      cell: ({ row }) => (
        <TruncatedCell className='max-w-56'>
          {stageLabel(row.original.stage)}
        </TruncatedCell>
      ),
    },
    {
      accessorKey: 'error',
      header: t('Error'),
      cell: ({ row }) => (
        <TruncatedCell className='max-w-64'>
          {diagnosticLabel(row.original.error)}
        </TruncatedCell>
      ),
    },
    {
      accessorKey: 'is_test',
      header: t('Test email'),
      cell: ({ row }) => (row.original.is_test ? t('Yes') : t('No')),
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setSelectedId(row.original.id)}
        >
          {t('Details')}
        </Button>
      ),
    },
  ]
  const { table } = useDataTable({
    columns,
    data:
      allowed && !query.isError
        ? (query.data?.items ?? EMPTY_RECORDS)
        : EMPTY_RECORDS,
    totalCount: query.isError ? 0 : (query.data?.total ?? 0),
    getRowId: (record) => String(record.id),
    pagination,
    onPaginationChange: (updater) => {
      if (query.isFetching || query.isError) return
      setPagination((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater
        return next.pageSize === previous.pageSize
          ? next
          : { ...next, pageIndex: 0 }
      })
    },
    enableRowSelection: false,
    enableSorting: false,
    manualFiltering: true,
    manualPagination: true,
  })
  const search = () => {
    if (invalidRange || invalidUser) return
    const next = {
      ...draft,
      recipient: draft.recipient?.trim() || undefined,
      request_id: draft.request_id?.trim() || undefined,
    }
    if (
      JSON.stringify(next) === JSON.stringify(filters) &&
      pagination.pageIndex === 0
    ) {
      void query.refetch()
    } else {
      setFilters(next)
      setPagination((previous) => ({ ...previous, pageIndex: 0 }))
    }
  }
  if (!allowed) return null
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <p className='text-muted-foreground shrink-0 text-xs'>
        {t(
          'Accepted means the SMTP server accepted the message, not that it reached the recipient inbox.'
        )}{' '}
        {t(
          'Addresses are masked in the list. Open details to view full addresses.'
        )}
      </p>
      <DataTablePage
        table={table}
        columns={columns}
        className='h-auto min-h-0 flex-1'
        paginationInFooter
        isLoading={query.isPending}
        isFetching={query.isFetching}
        emptyTitle={
          query.isError
            ? t('Failed to load SMTP audit records')
            : t('No records')
        }
        emptyDescription={
          query.isError ? getServerErrorMessage(query.error) : undefined
        }
        emptyAction={
          query.isError ? (
            <Button
              size='sm'
              variant='outline'
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('Retry')}
            </Button>
          ) : undefined
        }
        toolbar={
          <div className='space-y-2'>
            <SMTPFilterBar
              table={table}
              filters={draft}
              onChange={setDraft}
              isFetching={query.isFetching}
              onSearch={search}
              onReset={() => {
                const defaults = getDefaultSMTPAuditFilters()
                setDraft(defaults)
                setFilters(defaults)
                setPagination((previous) => ({ ...previous, pageIndex: 0 }))
              }}
            />
            {(invalidRange || invalidUser) && (
              <Alert variant='destructive'>
                <AlertDescription>
                  {invalidRange
                    ? t('End time must be after start time')
                    : t('Enter a valid user ID')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        }
      />
      {selectedId !== null && (
        <SMTPDetailsDialog
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
