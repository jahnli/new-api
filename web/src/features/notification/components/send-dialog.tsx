import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { MultiSelect } from '@/components/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import {
  getNotificationAudience,
  notificationKeys,
  sendNotification,
} from '../api'
import {
  formatNotificationTitle,
  missingNotificationImages,
  splitRecipients,
} from '../lib/message'
import { NOTIFICATION_TITLE_THEME_CLASSES } from '../lib/title-theme'
import type { NotificationConfig, NotificationMessage } from '../types'
import { MessageContent } from './message-content'

const FEISHU_TEST_RECIPIENTS = [
  { name: '李佳衡', openId: 'ou_45d80e11120e18382da7bd7764f3b0ec' },
  { name: '李敬铮', openId: 'ou_0f257101142bfca0060c4989f76495e5' },
] as const

const FEISHU_TEST_RECIPIENT_OPTIONS = FEISHU_TEST_RECIPIENTS.map(
  (recipient) => ({
    label: recipient.name,
    value: recipient.openId,
    hint: recipient.openId,
  })
)

export function SendDialog(props: {
  message: NotificationMessage
  companies: NotificationConfig['companies']
  test: boolean
  onClose: () => void
  onSent: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const client = useQueryClient()
  const emailTest = props.test && props.message.channel === 'email'
  const editableTestRecipients = props.test && !emailTest
  const [testRecipients, setTestRecipients] = useState('')
  const testRecipientIDs = emailTest
    ? props.message.recipients
    : splitRecipients(testRecipients)
  const [recipientError, setRecipientError] = useState('')
  const companyAudience = !props.test && props.message.channel !== 'email'
  const audience = useQuery({
    queryKey: notificationKeys.audience(
      props.message.channel,
      props.message.company_ids ?? []
    ),
    queryFn: () =>
      getNotificationAudience(
        props.message.channel,
        props.message.company_ids ?? []
      ),
    enabled: companyAudience,
  })
  let testLabel = t('Feishu Open IDs')
  if (props.message.channel === 'dingtalk') testLabel = t('DingTalk User IDs')
  if (props.message.channel === 'email') testLabel = t('Email addresses')
  const channelLabels = {
    email: t('Email'),
    feishu: t('Feishu'),
    dingtalk: t('DingTalk'),
  }
  let confirmationDescription: string | undefined
  if (!props.test) {
    confirmationDescription = companyAudience
      ? t(
          'Only members of the selected companies receive official notifications. Each company uses its own application to send.'
        )
      : t(
          'Only the recipients listed below will receive this message. Check the content and recipients before continuing.'
        )
  }
  const missingImages = missingNotificationImages(props.message)
  const mutation = useMutation({
    retry: false,
    mutationFn: (recipients: string[]) => {
      if (missingImages.length) {
        throw new Error(
          `${t('Notification images')}: ${t('Content not found.')}`
        )
      }
      return sendNotification({ ...props.message, recipients }, props.test)
    },
    onSuccess: (results) => {
      void client.invalidateQueries({ queryKey: notificationKeys.records })
      const records = results.flatMap((result) =>
        result.record ? [result.record] : []
      )
      const incomplete = results.some(
        (result) => result.failed || !result.record
      )
      if (
        !incomplete &&
        records.length > 0 &&
        records.every((record) => record.status === 'success')
      ) {
        toast.success(
          props.test ? t('Test notification sent') : t('Notification sent')
        )
        props.onSent()
      } else {
        const summary = t(
          'Sent: {{sent}}; failed: {{failed}}; unconfirmed: {{unknown}}',
          {
            sent: formatNumber(
              records.reduce((sum, record) => sum + record.success_count, 0),
              locale
            ),
            failed: formatNumber(
              records.reduce((sum, record) => sum + record.failed_count, 0),
              locale
            ),
            unknown: formatNumber(
              records.reduce((sum, record) => sum + record.unknown_count, 0),
              locale
            ),
          }
        )
        const reason = records
          .flatMap((record) => record.deliveries ?? [])
          .find((delivery) => delivery.status === 'failed')?.error
        const title =
          incomplete || records.some((record) => record.unknown_count > 0)
            ? t(
                'Delivery could not be confirmed. Check recipients before resending.'
              )
            : t('Notification failed')
        toast.error(title, {
          description: [
            summary,
            reason,
            incomplete
              ? t(
                  'Some companies could not complete sending. Check notification history before retrying.'
                )
              : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
          duration: 10000,
        })
        props.onClose()
      }
    },
    onError: (error) => {
      void client.invalidateQueries({ queryKey: notificationKeys.records })
      handleServerError(
        error,
        t('Delivery could not be confirmed. Check recipients before resending.')
      )
      props.onClose()
    },
    meta: { errorToast: false },
  })
  return (
    <ConfirmDialog
      open
      closeOnOutsideClick={props.test}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
      title={
        props.test ? (
          <span className='flex flex-wrap items-center gap-3'>
            <span>{t('Test notification')}</span>
            {editableTestRecipients && (
              <Label
                htmlFor='notification-test-recipients'
                className='text-muted-foreground select-text'
              >
                {testLabel}
              </Label>
            )}
            {emailTest && (
              <Badge variant='secondary'>
                {channelLabels.email} ·{' '}
                {formatNumber(testRecipientIDs.length, locale)} /{' '}
                {formatNumber(20, locale)}
              </Badge>
            )}
          </span>
        ) : (
          t('Confirm official send')
        )
      }
      desc={confirmationDescription}
      confirmText={mutation.isPending ? t('Sending...') : t('Send')}
      disabled={
        missingImages.length > 0 ||
        (props.test &&
          (testRecipientIDs.length === 0 || testRecipientIDs.length > 20)) ||
        (companyAudience &&
          (audience.isFetching ||
            !audience.data ||
            audience.isError ||
            audience.data.recipient_count === 0 ||
            audience.data.companies?.some(
              (company) => company.recipient_count === 0
            )))
      }
      isLoading={mutation.isPending}
      handleConfirm={() => {
        const recipients = props.test
          ? testRecipientIDs
          : props.message.recipients
        if (!companyAudience && recipients.length === 0) {
          setRecipientError(t('Please enter at least one recipient'))
          return
        }
        if (props.test && recipients.length > 20) {
          setRecipientError(t('Test sends support up to 20 recipients.'))
          return
        }
        if (
          props.message.channel === 'email' &&
          recipients.some(
            (recipient) => !z.email().safeParse(recipient).success
          )
        ) {
          setRecipientError(t('Please enter valid email addresses'))
          return
        }
        if (
          props.message.channel !== 'email' &&
          recipients.some(
            (recipient) =>
              !/^[A-Za-z0-9_.:@=-]{1,320}$/.test(recipient) ||
              recipient.replace(/^@/, '').toLowerCase() === 'all' ||
              recipient === '0'
          )
        ) {
          setRecipientError(t('Invalid IDs'))
          return
        }
        setRecipientError('')
        mutation.mutate(companyAudience ? [] : recipients)
      }}
      className={
        props.test
          ? 'flex h-[80dvh] w-[75vw] flex-col overflow-hidden data-[size=default]:max-w-none data-[size=default]:sm:max-w-none [&>[data-slot=alert-dialog-footer]]:shrink-0 [&>[data-slot=alert-dialog-header]]:shrink-0'
          : 'flex h-[85dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden data-[size=default]:max-w-none data-[size=default]:sm:max-w-none md:w-[60vw] [&>[data-slot=alert-dialog-footer]]:shrink-0 [&>[data-slot=alert-dialog-header]]:shrink-0'
      }
    >
      <div
        className={cn(
          editableTestRecipients
            ? 'min-h-0 min-w-0 flex-1 space-y-4 overflow-auto overscroll-contain md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[minmax(0,1fr)] md:gap-4 md:space-y-0 md:overflow-hidden'
            : 'min-h-0 min-w-0 flex-1 space-y-4 overflow-auto overscroll-contain',
          emailTest && 'flex flex-col gap-4 space-y-0'
        )}
      >
        <div
          className={cn(
            props.test
              ? 'min-h-0 min-w-0 space-y-4 md:overflow-auto md:overscroll-contain'
              : 'space-y-4',
            emailTest && !recipientError && 'hidden'
          )}
        >
          {!props.test && (
            <div className='flex gap-2'>
              <Badge variant='outline'>
                {channelLabels[props.message.channel]}
              </Badge>
              {companyAudience && (
                <Badge variant='secondary'>{t('Selected companies')}</Badge>
              )}
              {!companyAudience && (
                <Badge variant='secondary'>
                  {t('Recipients')}:{' '}
                  {formatNumber(props.message.recipients.length, locale)}
                </Badge>
              )}
            </div>
          )}
          {props.message.channel !== 'email' && (
            <div className='flex flex-wrap gap-2'>
              {(props.message.company_ids ?? []).map((id) => (
                <Badge key={id} variant='outline'>
                  {props.companies.find((company) => company.id === id)?.name ??
                    String(id)}
                </Badge>
              ))}
              {props.test && (
                <p className='text-muted-foreground w-full text-xs'>
                  {t(
                    'Each selected company sends to the test recipients entered below.'
                  )}
                </p>
              )}
            </div>
          )}
          {editableTestRecipients && (
            <div className='border-primary/15 bg-primary/5 space-y-3 rounded-xl border p-4'>
              <div className='flex items-center justify-between gap-3'>
                {props.message.channel === 'feishu' && (
                  <div className='flex gap-2'>
                    {FEISHU_TEST_RECIPIENTS.map((recipient) => {
                      const selected = testRecipientIDs.includes(
                        recipient.openId
                      )
                      return (
                        <Button
                          key={recipient.openId}
                          type='button'
                          size='sm'
                          variant={selected ? 'secondary' : 'outline'}
                          aria-pressed={selected}
                          title={recipient.openId}
                          disabled={
                            mutation.isPending ||
                            (!selected && testRecipientIDs.length >= 20)
                          }
                          onClick={() => {
                            setTestRecipients((current) => {
                              const identifiers = splitRecipients(current)
                              if (identifiers.includes(recipient.openId)) {
                                return identifiers
                                  .filter((id) => id !== recipient.openId)
                                  .join('\n')
                              }
                              if (identifiers.length >= 20) return current
                              return [...identifiers, recipient.openId].join(
                                '\n'
                              )
                            })
                            setRecipientError('')
                          }}
                        >
                          {recipient.name}
                        </Button>
                      )
                    })}
                  </div>
                )}
                <Badge variant='secondary' className='ml-auto shrink-0'>
                  {formatNumber(testRecipientIDs.length, locale)} /{' '}
                  {formatNumber(20, locale)}
                </Badge>
              </div>
              {props.message.channel === 'feishu' && (
                <MultiSelect
                  id='notification-test-recipients'
                  options={FEISHU_TEST_RECIPIENT_OPTIONS}
                  selected={testRecipientIDs}
                  allowCreate
                  disabled={mutation.isPending}
                  placeholder={t('Feishu Open IDs')}
                  inputAriaLabel={testLabel}
                  className='bg-background min-h-12'
                  onChange={(values) => {
                    setTestRecipients(
                      splitRecipients(values.join('\n')).join('\n')
                    )
                    setRecipientError('')
                  }}
                />
              )}
              {props.message.channel !== 'feishu' &&
                props.message.channel !== 'email' && (
                  <Textarea
                    id='notification-test-recipients'
                    value={testRecipients}
                    onChange={(event) => {
                      setTestRecipients(event.target.value)
                      setRecipientError('')
                    }}
                    disabled={mutation.isPending}
                    aria-invalid={Boolean(recipientError)}
                    aria-describedby={
                      recipientError
                        ? 'notification-test-help notification-recipient-error'
                        : 'notification-test-help'
                    }
                    className='bg-background min-h-40 resize-y font-mono text-sm'
                    placeholder={t(
                      'Enter test recipients, separated by commas or new lines.'
                    )}
                  />
                )}
              <p
                id='notification-test-help'
                className='text-muted-foreground text-xs'
              >
                {t(
                  'Tests are sent only to the recipients entered here, up to 20. The official audience is never used.'
                )}
              </p>
              {testRecipientIDs.length > 20 && (
                <p role='alert' className='text-destructive text-xs'>
                  {t('Test sends support up to 20 recipients.')}
                </p>
              )}
            </div>
          )}
          {recipientError && (
            <p
              id='notification-recipient-error'
              role='alert'
              className='text-destructive text-sm'
            >
              {recipientError}
            </p>
          )}
          {companyAudience && (
            <div className='bg-muted/40 space-y-3 rounded-lg p-4 text-sm'>
              {audience.isPending && <Spinner />}
              {audience.isError && (
                <ErrorState onRetry={() => void audience.refetch()} />
              )}
              {audience.data && (
                <>
                  <p className='font-medium'>
                    {t('Recipients')}:{' '}
                    {formatNumber(audience.data.recipient_count, locale)}
                  </p>
                  <div className='space-y-1'>
                    {audience.data.companies?.map((company) => (
                      <p key={company.company_id}>
                        {props.companies.find(
                          (item) => item.id === company.company_id
                        )?.name ?? String(company.company_id)}
                        : {formatNumber(company.recipient_count, locale)}
                      </p>
                    ))}
                  </div>
                  <dl className='grid grid-cols-2 gap-3 text-xs sm:grid-cols-4'>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Total users')}
                      </dt>
                      <dd className='mt-1 font-medium'>
                        {formatNumber(audience.data.total_users, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Missing IDs')}
                      </dt>
                      <dd className='mt-1 font-medium'>
                        {formatNumber(audience.data.missing_ids, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Invalid IDs')}
                      </dt>
                      <dd className='mt-1 font-medium'>
                        {formatNumber(audience.data.invalid_ids, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Duplicate IDs')}
                      </dt>
                      <dd className='mt-1 font-medium'>
                        {formatNumber(audience.data.duplicate_ids, locale)}
                      </dd>
                    </div>
                  </dl>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Blank or invalid IDs are skipped. Duplicate IDs receive one message per company. The final audience is determined when you send.'
                    )}
                  </p>
                  {audience.data.companies?.some(
                    (company) => company.recipient_count === 0
                  ) && (
                    <p role='alert' className='text-destructive text-xs'>
                      {t(
                        'One or more selected companies have no valid recipients'
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {!props.test && !companyAudience && (
            <p className='bg-muted/40 rounded-lg p-3 font-mono text-xs break-all'>
              {props.message.recipients.join(', ')}
            </p>
          )}
        </div>
        <div
          className={cn(
            props.test
              ? 'min-w-0 rounded-lg border p-4 [overflow-wrap:anywhere] md:min-h-0 md:overflow-auto md:overscroll-contain [&_img]:max-w-full'
              : 'min-w-0 rounded-lg border p-4 [overflow-wrap:anywhere] [&_img]:max-w-full',
            emailTest && 'min-h-0 flex-1 overflow-auto overscroll-contain'
          )}
        >
          <h3
            className={cn(
              'mb-3 flex items-start gap-3 font-semibold',
              props.message.channel === 'feishu' && [
                '-mx-4 -mt-4 rounded-t-lg p-4',
                NOTIFICATION_TITLE_THEME_CLASSES[
                  props.message.title_theme ?? 'blue'
                ],
              ]
            )}
          >
            <span className='min-w-0'>
              {formatNotificationTitle(props.message)}
            </span>
            {props.test && props.message.channel === 'feishu' && (
              <Badge
                variant='outline'
                className='h-7 gap-1.5 rounded-md border-indigo-300 bg-indigo-100 px-2.5 font-semibold text-indigo-800 shadow-sm dark:border-indigo-400/50 dark:bg-indigo-950 dark:text-indigo-200'
              >
                <Tag aria-hidden='true' />
                Test
              </Badge>
            )}
          </h3>
          <MessageContent message={props.message} />
          {missingImages.length > 0 && (
            <p role='alert' className='text-destructive mt-3 text-sm'>
              {t('Notification images')}: {t('Content not found.')}
            </p>
          )}
        </div>
      </div>
    </ConfirmDialog>
  )
}
