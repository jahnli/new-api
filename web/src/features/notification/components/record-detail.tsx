import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getRecord, notificationKeys } from '../api'
import { notificationDate } from '../lib/message'
import type {
  NotificationDelivery,
  NotificationMessage,
  NotificationRecord,
} from '../types'
import { MessageContent } from './message-content'
import { NotificationStatusBadge } from './status-badge'

function DeliveryTable(props: { deliveries: NotificationDelivery[] }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const columns = useMemo<ColumnDef<NotificationDelivery>[]>(
    () => [
      {
        accessorKey: 'recipient',
        header: t('Recipient'),
        cell: ({ row }) => (
          <span className='font-mono text-xs [overflow-wrap:anywhere] whitespace-normal'>
            {row.original.recipient}
          </span>
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
        accessorKey: 'message_id',
        header: t('Message ID'),
        cell: ({ row }) => (
          <span className='font-mono text-xs [overflow-wrap:anywhere] whitespace-normal'>
            {row.original.message_id || '—'}
          </span>
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
    data: props.deliveries,
    columns,
    initialPagination: { pageIndex: 0, pageSize: 10 },
    getRowId: (delivery) => String(delivery.id),
    enableSorting: false,
    enableRowSelection: false,
  })

  return (
    <div className='space-y-3'>
      <DataTableView
        table={table}
        emptyContent={t('Delivery results will appear here.')}
      />
      <DataTablePagination table={table} />
    </div>
  )
}

export function RecordDetail(props: {
  id: number | null
  onClose: () => void
  onClone: (message: NotificationMessage) => void
  onRetry: (id: number) => void
  retrying: boolean
  canSend: boolean
  canTest: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: notificationKeys.detail(props.id ?? 0),
    queryFn: async () => {
      const id = props.id ?? 0
      const cached = client.getQueryData<NotificationRecord>(
        notificationKeys.detail(id)
      )
      const record = await getRecord(id, !cached?.message)
      return { ...record, message: cached?.message ?? record.message }
    },
    enabled: props.id !== null,
    refetchInterval: (state) =>
      ['queued', 'sending'].includes(state.state.data?.status ?? '')
        ? 2000
        : false,
  })
  const record = query.data
  const canRetry =
    record &&
    (record.status === 'failed' || record.status === 'partial') &&
    (record.is_test ? props.canTest : props.canSend)
  return (
    <Dialog
      open={props.id !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={record?.title || t('Delivery details')}
      description={
        record
          ? `${record.channel} · ${record.sender_name} · ${notificationDate(record.created_at, locale)}`
          : undefined
      }
      contentClassName='w-[calc(100vw-2rem)] sm:max-w-7xl'
      footer={
        <>
          {record?.message && (
            <Button
              variant='outline'
              onClick={() => {
                if (record.message) props.onClone(record.message)
                props.onClose()
              }}
            >
              <Pencil className='size-4' />
              {t('Edit and resend')}
            </Button>
          )}
          {canRetry && (
            <Button
              disabled={props.retrying}
              onClick={() => props.onRetry(record.id)}
            >
              <RefreshCw className='size-4' />
              {t('Retry failed recipients')}
            </Button>
          )}
        </>
      }
    >
      {query.isPending && (
        <div className='flex justify-center p-12'>
          <Spinner />
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {record && (
        <div className='space-y-5'>
          <div className='flex gap-2'>
            <NotificationStatusBadge status={record.status} />
            {record.is_test && (
              <Badge variant='secondary'>{t('Test send')}</Badge>
            )}
          </div>
          {record.message && (
            <div className='bg-muted/20 rounded-xl border p-5'>
              <MessageContent message={record.message} />
            </div>
          )}
          <DeliveryTable key={record.id} deliveries={record.deliveries ?? []} />
        </div>
      )}
    </Dialog>
  )
}
