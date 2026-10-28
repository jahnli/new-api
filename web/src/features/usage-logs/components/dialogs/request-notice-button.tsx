import { useMutation, useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getVendors } from '@/features/models/api'
import type { Vendor } from '@/features/models/types'
import type { UserColumnRow } from '@/features/users/types'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import {
  notifyRequestMessageViolation,
  previewRequestMessageNotice,
} from '../../api'
import type {
  NotifyViolationRequest,
  RequestNotificationType,
} from '../../types'
import { LogUserIdentity } from '../log-user-identity'
import { RequestNoticePreviewCard } from './request-notice-preview'

interface RequestNoticeButtonProps {
  user: UserColumnRow
  requestId: string
  userId: number
  modelName: string
  createdAt: number
  client?: string
}

export function RequestNoticeButton(props: RequestNoticeButtonProps) {
  const { t, i18n } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notificationType, setNotificationType] =
    useState<RequestNotificationType>('non_work_content')
  const notificationTypeId = useId()
  const targetVendorInputId = useId()
  const [targetVendorId, setTargetVendorId] = useState('')
  const canNotify = props.userId > 0
  const isModelSwitch = notificationType === 'model_switch'
  const vendorsQuery = useQuery({
    queryKey: ['request-notice-vendors'],
    queryFn: async () => {
      const vendors: Vendor[] = []
      for (let page = 1; ; page++) {
        const response = requireServerSuccess(
          await getVendors({ p: page, page_size: 100 })
        )
        if (!response.data) throw createServerError(response)
        vendors.push(...response.data.items)
        if (
          !response.data.items.length ||
          vendors.length >= response.data.total
        ) {
          break
        }
      }
      return vendors.filter(
        (vendor) => vendor.status === 1 && (vendor.model_count ?? 0) > 0
      )
    },
    enabled: confirmOpen && isModelSwitch,
    meta: { errorToast: false },
  })
  const vendorOptions = (vendorsQuery.data ?? []).map((vendor) => ({
    value: String(vendor.id),
    label: t('{{vendor}} model series', { vendor: vendor.name }),
  }))
  const hasTargetVendor = vendorOptions.some(
    (option) => option.value === targetVendorId
  )
  const canPreview =
    !isModelSwitch || (vendorsQuery.isSuccess && hasTargetVendor)
  const notificationPayload: NotifyViolationRequest = {
    notification_type: notificationType,
    target_vendor_id: isModelSwitch ? Number(targetVendorId) : undefined,
    language: i18n.resolvedLanguage || i18n.language,
    client: props.client,
    request_id: props.requestId,
    user_id: props.userId,
    model_name: props.modelName,
    created_at: props.createdAt,
  }
  const previewQuery = useQuery({
    queryKey: ['request-notice-preview', notificationPayload],
    queryFn: ({ signal }) =>
      previewRequestMessageNotice(notificationPayload, signal),
    enabled: confirmOpen && canNotify && canPreview,
    placeholderData: undefined,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { errorToast: false },
  })
  const notifyMutation = useMutation({
    mutationFn: async (payload: NotifyViolationRequest) => {
      const res = await notifyRequestMessageViolation(payload)
      return requireServerSuccess(res)
    },
    onSuccess: () => {
      toast.success(t('Notification sent'))
      setConfirmOpen(false)
    },
    onError: (error) =>
      handleServerError(error, t('Failed to send notification')),
  })

  if (!canNotify) return null

  return (
    <>
      <Button
        variant='destructive'
        size='sm'
        className='h-8 shrink-0 gap-1.5'
        onClick={() => {
          setNotificationType('non_work_content')
          setTargetVendorId('')
          setConfirmOpen(true)
        }}
        disabled={notifyMutation.isPending}
      >
        <Bell className='size-3.5' />
        {t('Notification')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Confirm Notification')}
        confirmText={t('Send')}
        className='h-[75dvh] max-h-[90dvh] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] data-[size=default]:max-w-5xl data-[size=default]:sm:max-w-5xl'
        closeOnOutsideClick
        isLoading={notifyMutation.isPending}
        disabled={
          !canPreview || !previewQuery.isSuccess || previewQuery.isFetching
        }
        handleConfirm={() => {
          if (
            canPreview &&
            previewQuery.isSuccess &&
            !previewQuery.isFetching
          ) {
            notifyMutation.mutate(notificationPayload)
          }
        }}
      >
        <div className='grid min-h-0 grid-cols-1 gap-5 overflow-y-auto px-1 py-1 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]'>
          <div className='min-w-0 space-y-4 md:border-r md:pr-5'>
            <div className='bg-muted/40 space-y-2 rounded-lg border p-3'>
              <p className='text-muted-foreground text-xs'>{t('Recipient')}</p>
              <LogUserIdentity
                userId={props.user.id}
                username={props.user.username}
                displayName={props.user.display_name}
                avatarUrl={props.user.avatar_url}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor={notificationTypeId}>
                {t('Notification type')}
              </Label>
              <Select
                items={[
                  { value: 'non_work_content', label: t('Non-work content') },
                  { value: 'security_risk', label: t('Security risk') },
                  { value: 'model_switch', label: t('Switch model') },
                ]}
                value={notificationType}
                disabled={notifyMutation.isPending}
                onValueChange={(value) => {
                  if (
                    value === 'non_work_content' ||
                    value === 'security_risk' ||
                    value === 'model_switch'
                  ) {
                    setNotificationType(value)
                  }
                }}
              >
                <SelectTrigger id={notificationTypeId} className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align='start' alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value='non_work_content'>
                      {t('Non-work content')}
                    </SelectItem>
                    <SelectItem value='security_risk'>
                      {t('Security risk')}
                    </SelectItem>
                    <SelectItem value='model_switch'>
                      {t('Switch model')}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {isModelSwitch && (
              <div className='space-y-2'>
                <Label htmlFor={targetVendorInputId} required>
                  {t('Target model series')}
                </Label>
                <Combobox
                  id={targetVendorInputId}
                  value={targetVendorId}
                  options={vendorOptions}
                  onValueChange={(value) => setTargetVendorId(value ?? '')}
                  placeholder={t('Select a target model series')}
                  searchPlaceholder={t('Search vendors')}
                  emptyText={t('No vendors found')}
                  disabled={notifyMutation.isPending || !vendorsQuery.isSuccess}
                />
                {vendorsQuery.isPending && (
                  <LoadingState inline size='sm' message={t('Loading...')} />
                )}
                {vendorsQuery.isError && (
                  <ErrorState
                    className='min-h-32'
                    description={vendorsQuery.error.message}
                    onRetry={() => void vendorsQuery.refetch()}
                  />
                )}
                {vendorsQuery.isSuccess && vendorOptions.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    {t('No vendors with linked models')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div
            className='min-w-0'
            aria-live='polite'
            aria-busy={previewQuery.isFetching}
          >
            {!canPreview && (
              <EmptyState
                title={t('Select a target model series')}
                className='min-h-48'
              />
            )}
            {canPreview && previewQuery.isPending && (
              <LoadingState className='min-h-48' />
            )}
            {canPreview && previewQuery.isError && (
              <ErrorState
                className='min-h-48'
                description={previewQuery.error.message}
                onRetry={() => void previewQuery.refetch()}
              />
            )}
            {canPreview && previewQuery.isSuccess && (
              <RequestNoticePreviewCard preview={previewQuery.data} />
            )}
          </div>
        </div>
      </ConfirmDialog>
    </>
  )
}
