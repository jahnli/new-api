import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getSMTPAudit, type SMTPAudit } from './api'
import { useSMTPLabels } from './labels'

const eventsSchema = z.array(
  z.object({
    stage: z.string(),
    duration_ms: z.number(),
    status: z.string(),
    smtp_code: z.number().optional(),
    error: z.string().optional(),
  })
)

function SMTPAuditDetails(props: { record: SMTPAudit }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { statuses, purposes, stageLabel, diagnosticLabel } = useSMTPLabels()
  const record = props.record
  let events: (z.infer<typeof eventsSchema>[number] & { key: string })[] = []
  let invalidEvents = false
  try {
    const parsed = eventsSchema.safeParse(JSON.parse(record.events || '[]'))
    if (parsed.success) {
      const occurrences = new Map<string, number>()
      events = parsed.data.map((event) => {
        const occurrence = (occurrences.get(event.stage) ?? 0) + 1
        occurrences.set(event.stage, occurrence)
        return { ...event, key: `${event.stage}:${occurrence}` }
      })
    } else invalidEvents = true
  } catch {
    invalidEvents = true
  }
  const rows: { label: string; value: string | number; copy?: boolean }[] = [
    { label: t('ID'), value: record.id },
    { label: t('Status'), value: statuses[record.status] ?? record.status },
    { label: t('Purpose'), value: purposes[record.purpose] ?? record.purpose },
    { label: t('Subject'), value: record.subject },
    {
      label: t('Recipient'),
      value: record.recipient.split(';').join('\n'),
      copy: true,
    },
    { label: t('Sender'), value: record.sender, copy: true },
    { label: t('Start Time'), value: formatTimestampToDate(record.started_at) },
    { label: t('End Time'), value: formatTimestampToDate(record.finished_at) },
    {
      label: t('Sending deadline'),
      value: formatTimestampToDate(record.deadline_at),
    },
    { label: t('Duration (ms)'), value: record.duration_ms },
    {
      label: t('User ID'),
      value: record.user_id === 0 ? t('Not recorded') : record.user_id,
    },
    {
      label: t('Actor ID'),
      value:
        record.actor_id === 0
          ? t('System or unauthenticated')
          : record.actor_id,
    },
    { label: t('Request ID'), value: record.request_id, copy: true },
    { label: t('SMTP attempt ID'), value: record.attempt_id, copy: true },
    { label: t('Attempt'), value: record.attempt },
    { label: t('Notification ID'), value: record.notification_id },
    { label: t('Delivery ID'), value: record.delivery_id },
    { label: t('Test email'), value: record.is_test ? t('Yes') : t('No') },
    { label: t('SMTP Server'), value: record.server },
    { label: t('Port'), value: String(record.port) },
    { label: t('TLS mode'), value: record.tls_mode },
    { label: t('TLS version'), value: record.tls_version },
    { label: t('TLS cipher'), value: record.tls_cipher },
    {
      label: t('Skip TLS certificate verification'),
      value: record.insecure_skip_verify ? t('Yes') : t('No'),
    },
    {
      label: t('SMTP authentication'),
      value: record.auth_enabled ? t('Enabled') : t('Disabled'),
    },
    { label: t('Stage'), value: stageLabel(record.stage) },
    {
      label: t('SMTP code'),
      value: record.smtp_code ? String(record.smtp_code) : '-',
    },
    { label: t('Error'), value: diagnosticLabel(record.error) },
    { label: t('Warning'), value: diagnosticLabel(record.warning) },
    { label: t('Message ID'), value: record.message_id, copy: true },
    { label: t('Message size (bytes)'), value: record.message_bytes },
    { label: t('Attachment count'), value: record.attachment_count },
    { label: t('Attachment size (bytes)'), value: record.attachment_bytes },
    { label: t('Instance ID'), value: record.instance_id, copy: true },
  ]
  return (
    <div className='space-y-5'>
      <Alert>
        <AlertDescription>
          {t(
            'Accepted means the SMTP server accepted the message, not that it reached the recipient inbox.'
          )}
        </AlertDescription>
      </Alert>
      <dl className='divide-y text-sm'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='grid grid-cols-1 gap-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4'
          >
            <dt className='text-muted-foreground'>{row.label}</dt>
            <dd className='flex min-w-0 items-start gap-2'>
              <span className='min-w-0 flex-1 break-all whitespace-pre-wrap'>
                {typeof row.value === 'number'
                  ? formatNumber(row.value, locale)
                  : row.value || '-'}
              </span>
              {row.copy && !!row.value && (
                <CopyButton value={String(row.value)} className='size-6' />
              )}
            </dd>
          </div>
        ))}
      </dl>
      {record.notification_id > 0 && (
        <Link
          to='/notification'
          className='text-primary text-sm underline underline-offset-4'
        >
          {t('Open notifications')}
        </Link>
      )}
      <section aria-label={t('SMTP stage timeline')} className='space-y-3'>
        <h3 className='text-sm font-semibold'>{t('SMTP stage timeline')}</h3>
        {invalidEvents && (
          <p role='status' className='text-destructive text-sm'>
            {t('SMTP stage data is unavailable')}
          </p>
        )}
        {!invalidEvents && events.length === 0 && (
          <p className='text-muted-foreground text-sm'>{t('No records')}</p>
        )}
        <ol className='ml-2 space-y-4 border-l pl-4'>
          {events.map((event) => (
            <li key={event.key} className='relative space-y-1 text-sm'>
              <span
                aria-hidden='true'
                className='bg-primary absolute top-1.5 -left-[1.3rem] size-2 rounded-full'
              />
              <div className='flex flex-wrap justify-between gap-2'>
                <span>{stageLabel(event.stage)}</span>
                <span>{formatNumber(event.duration_ms, locale)} ms</span>
              </div>
              <p className='text-muted-foreground'>
                {event.status === 'success'
                  ? t('Success')
                  : (statuses[event.status] ?? event.status)}
                {event.smtp_code ? ` · SMTP ${event.smtp_code}` : ''}
              </p>
              {event.error && (
                <p className='text-destructive break-all'>
                  {diagnosticLabel(event.error)}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export function SMTPDetailsDialog(props: { id: number; onClose: () => void }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const allowed = !!user && user.role >= ROLE.SUPER_ADMIN
  const query = useQuery({
    queryKey: ['smtp-audit', user?.id, 'detail', props.id],
    queryFn: ({ signal }) => getSMTPAudit(props.id, signal),
    enabled: allowed,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.status !== 'error' && query.state.data?.status === 'sending'
        ? 5000
        : false,
    refetchIntervalInBackground: false,
  })
  return (
    <Dialog
      open={allowed}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('SMTP audit details')}
      contentClassName='sm:max-w-3xl'
    >
      {query.isPending && <LoadingState />}
      {query.isError && (
        <ErrorState
          title={t('Failed to load SMTP audit records')}
          onRetry={() => void query.refetch()}
        />
      )}
      {!query.isError && query.data && <SMTPAuditDetails record={query.data} />}
    </Dialog>
  )
}
