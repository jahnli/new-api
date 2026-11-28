import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Bell,
  Check,
  Gauge,
  MessageSquareWarning,
  MonitorCheck,
  ShieldAlert,
} from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { RequestNoticeDialog } from './request-notice-dialog'

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
      <RequestNoticeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isSending={notifyMutation.isPending}
        canPreview={canPreview}
        previewQuery={previewQuery}
        onConfirm={() => notifyMutation.mutate(notificationPayload)}
        recipient={
          <LogUserIdentity
            userId={props.user.id}
            username={props.user.username}
            displayName={props.user.display_name}
            avatarUrl={props.user.avatar_url}
            nameClassName='min-w-0 max-w-full shrink'
          />
        }
        emptyPreview={
          <EmptyState
            title={t('Select a target model series')}
            className='min-h-48'
          />
        }
      >
        <FieldSet>
          <FieldLegend
            id={notificationTypeId}
            variant='label'
            className='text-muted-foreground mb-2 px-2 data-[variant=label]:text-xs'
          >
            {t('Notification type')}
          </FieldLegend>
          <RadioGroup
            aria-labelledby={notificationTypeId}
            className='gap-1'
            value={notificationType}
            disabled={notifyMutation.isPending}
            onValueChange={(value) => {
              if (
                value === 'non_work_content' ||
                value === 'security_risk' ||
                value === 'frequent_requests' ||
                value === 'model_switch' ||
                value === 'client_model_mismatch'
              ) {
                setNotificationType(value)
              }
            }}
          >
            {[
              {
                value: 'non_work_content',
                label: t('Non-work content'),
                icon: MessageSquareWarning,
              },
              {
                value: 'security_risk',
                label: t('Security risk'),
                icon: ShieldAlert,
              },
              {
                value: 'frequent_requests',
                label: t('Frequent requests'),
                icon: Gauge,
              },
              {
                value: 'model_switch',
                label: t('Switch model'),
                icon: ArrowLeftRight,
              },
              {
                value: 'client_model_mismatch',
                label: t('Client and model matching'),
                icon: MonitorCheck,
              },
            ].map((option) => (
              <div key={option.value} className='min-w-0'>
                <Label
                  htmlFor={`${notificationTypeId}-${option.value}`}
                  className='text-muted-foreground hover:bg-muted hover:text-foreground has-data-checked:bg-primary/10 has-data-checked:text-primary has-focus-visible:ring-ring flex min-h-11 cursor-pointer gap-3 rounded-lg px-3 py-2 transition-colors has-focus-visible:ring-2 has-disabled:cursor-not-allowed has-disabled:opacity-50'
                >
                  <option.icon className='size-4 shrink-0' aria-hidden='true' />
                  <span className='min-w-0 flex-1 leading-snug'>
                    {option.label}
                  </span>
                  <RadioGroupItem
                    id={`${notificationTypeId}-${option.value}`}
                    value={option.value}
                    className='sr-only'
                  />
                  <Check
                    aria-hidden='true'
                    className='size-4 shrink-0 opacity-0 peer-data-checked:opacity-100'
                    strokeWidth={2.5}
                  />
                </Label>
                {option.value === 'model_switch' && isModelSwitch && (
                  <div className='border-primary/20 my-2 ms-5 flex min-w-0 flex-col gap-2 border-s ps-4 pe-2'>
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
                      popupClassName='[&_[data-slot=combobox-list]]:max-h-[min(24rem,calc(var(--available-height)-0.5rem))]'
                      disabled={
                        notifyMutation.isPending || !vendorsQuery.isSuccess
                      }
                    />
                    {vendorsQuery.isPending && (
                      <LoadingState
                        inline
                        size='sm'
                        message={t('Loading...')}
                      />
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
            ))}
          </RadioGroup>
        </FieldSet>
      </RequestNoticeDialog>
    </>
  )
}
