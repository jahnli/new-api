import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Pencil, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getRecord, notificationKeys } from '../api'
import { notificationDate } from '../lib/message'
import type {
  NotificationChannel,
  NotificationMessage,
  NotificationRecord,
} from '../types'
import { DeliveryTable } from './delivery-table'
import { MessageContent } from './message-content'
import { NotificationStatusBadge } from './status-badge'

const CHANNEL_LABEL_KEYS: Record<NotificationChannel, string> = {
  feishu: 'Feishu',
  dingtalk: 'DingTalk',
  email: 'Email',
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
      bodyContainerClassName='flex-1 overflow-hidden'
      bodyClassName='h-full'
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
        <Tabs
          key={record.id}
          defaultValue={record.message ? 'message' : 'recipients'}
          className='h-full min-h-0 gap-3'
        >
          <TabsList className='shrink-0'>
            {record.message && (
              <TabsTrigger value='message' className='px-4'>
                {t('Message')}
              </TabsTrigger>
            )}
            <TabsTrigger value='recipients' className='px-4'>
              {t('Recipients')}
              <Badge variant='secondary' className='tabular-nums'>
                {formatNumber(record.total, locale)}
              </Badge>
            </TabsTrigger>
          </TabsList>
          {record.message && (
            <TabsContent
              value='message'
              className='min-h-0 overflow-y-auto overscroll-contain'
            >
              <div className='rounded-lg border p-4 sm:p-5'>
                <MessageContent message={record.message} />
              </div>
            </TabsContent>
          )}
          <TabsContent value='recipients' className='min-h-0 overflow-hidden'>
            <DeliveryTable
              key={record.id}
              recordId={record.id}
              active={record.status === 'queued' || record.status === 'sending'}
            />
          </TabsContent>
        </Tabs>
      )}
    </Dialog>
  )
}
