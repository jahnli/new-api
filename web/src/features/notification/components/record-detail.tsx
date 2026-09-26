import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getRecord, notificationKeys } from '../api'
import { notificationDate } from '../lib/message'
import type { NotificationMessage, NotificationRecord } from '../types'
import { MessageContent } from './message-content'
import { NotificationStatusBadge } from './status-badge'

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
      contentClassName='sm:max-w-4xl'
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
          <StaticDataTable
            data={record.deliveries ?? []}
            getRowKey={(delivery) => delivery.id}
            emptyContent={t('Delivery results will appear here.')}
            columns={[
              {
                id: 'recipient',
                header: t('Recipient'),
                cell: (delivery) => (
                  <span className='font-mono text-xs'>
                    {delivery.recipient}
                  </span>
                ),
              },
              {
                id: 'status',
                header: t('Status'),
                cell: (delivery) => (
                  <NotificationStatusBadge status={delivery.status} />
                ),
              },
              {
                id: 'error',
                header: t('Error'),
                cell: (delivery) => (
                  <p className='max-w-64 text-xs whitespace-normal'>
                    {delivery.error || '—'}
                  </p>
                ),
              },
              {
                id: 'message_id',
                header: t('Message ID'),
                cell: (delivery) => delivery.message_id || '—',
              },
              {
                id: 'attempts',
                header: t('Attempts'),
                cell: (delivery) => formatNumber(delivery.attempts, locale),
              },
            ]}
          />
        </div>
      )}
    </Dialog>
  )
}
