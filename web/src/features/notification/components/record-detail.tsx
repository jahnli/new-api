import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Clock3, Pencil, RefreshCw } from 'lucide-react'
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
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getRecord, notificationKeys } from '../api'
import { notificationDate } from '../lib/message'
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationMessage,
  NotificationRecord,
} from '../types'
import { MessageContent } from './message-content'
import { NotificationStatusBadge } from './status-badge'

const CHANNEL_LABEL_KEYS: Record<NotificationChannel, string> = {
  feishu: 'Feishu',
  dingtalk: 'DingTalk',
  email: 'Email',
}

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
      headerClassName='gap-4'
      titleClassName='pr-8 text-lg leading-snug [overflow-wrap:anywhere]'
      headerTrailing={
        record && (
          <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-lg px-4 py-3'>
            <LogUserIdentity
              className='min-w-0 basis-64'
              size='sm'
              avatarClassName='size-8'
              fetchOnMount
              nameClassName='min-w-0'
              key={record.user_id}
              userId={record.user_id}
              username={record.sender_name}
              displayName={record.display_name}
              avatarUrl={record.avatar_url}
              openId={record.open_id}
              gender={record.gender}
              canFetchDetails={props.canSend}
            >
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
                <Badge variant='outline'>
                  {t(CHANNEL_LABEL_KEYS[record.channel])}
                </Badge>
                <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
                  <Clock3 className='size-3.5 shrink-0' aria-hidden='true' />
                  {notificationDate(record.created_at, locale)}
                </span>
              </div>
            </LogUserIdentity>
            <div className='flex flex-wrap items-center gap-4 max-sm:w-full max-sm:border-t max-sm:pt-3'>
              <div className='flex flex-col items-start gap-1.5'>
                <NotificationStatusBadge status={record.status} />
                {record.is_test && (
                  <Badge variant='secondary'>{t('Test send')}</Badge>
                )}
              </div>
              {record.status === 'partial' && (
                <dl className='grid grid-cols-2 gap-5 border-l pl-4'>
                  <div className='flex flex-col gap-1'>
                    <dt className='text-muted-foreground text-xs'>
                      {t('Delivered')}
                    </dt>
                    <dd className='text-lg leading-none font-semibold text-emerald-500 tabular-nums'>
                      {formatNumber(record.success_count, locale)}
                    </dd>
                  </div>
                  <div className='flex flex-col gap-1'>
                    <dt className='text-muted-foreground text-xs'>
                      {t('Undelivered')}
                    </dt>
                    <dd className='text-lg leading-none font-semibold text-amber-500 tabular-nums'>
                      {formatNumber(
                        Math.max(0, record.total - record.success_count),
                        locale
                      )}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        )
      }
      contentClassName='h-[92dvh] w-[calc(100vw-2rem)] overflow-hidden sm:max-w-7xl'
      bodyContainerClassName='flex-1'
      bodyClassName='grid min-h-full'
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
        <div className='flex h-full min-h-64 items-center justify-center p-12'>
          <Spinner />
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {record && (
        <div className='space-y-6'>
          {record.message && (
            <section className='space-y-3'>
              <h3 className='text-sm font-medium'>{t('Message')}</h3>
              <div className='rounded-lg border p-4 sm:p-5'>
                <MessageContent message={record.message} />
              </div>
            </section>
          )}
          <section className='space-y-3'>
            <h3 className='flex items-center gap-2 text-sm font-medium'>
              {t('Recipients')}
              <Badge variant='secondary' className='tabular-nums'>
                {formatNumber(record.total, locale)}
              </Badge>
            </h3>
            <DeliveryTable
              key={record.id}
              deliveries={record.deliveries ?? []}
            />
          </section>
        </div>
      )}
    </Dialog>
  )
}
