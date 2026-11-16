import { useMutation, useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { RequestNoticeDialog } from '@/features/usage-logs/components/dialogs/request-notice-dialog'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { notifyOffHoursViolation, previewOffHoursViolationNotice } from '../api'
import type {
  NotifyOffHoursViolationRequest,
  OffHoursDetailTarget,
} from '../types'

export function OffHoursViolationNoticeButton(props: {
  target: OffHoursDetailTarget
}) {
  const { t, i18n } = useTranslation()
  const demoMode = useDemoMode()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const canNotify = props.target.userId > 0
  const notificationPayload: NotifyOffHoursViolationRequest = {
    user_id: props.target.userId,
    start_time: props.target.requestStart,
    end_time: props.target.requestEnd,
    request_count: props.target.requestCount,
    language: i18n.resolvedLanguage || i18n.language,
  }
  const previewQuery = useQuery({
    queryKey: ['off-hours-notice-preview', notificationPayload],
    queryFn: ({ signal }) =>
      previewOffHoursViolationNotice(notificationPayload, signal),
    enabled: confirmOpen && canNotify,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { errorToast: false },
  })
  const notifyViolationMutation = useMutation({
    mutationFn: async (payload: NotifyOffHoursViolationRequest) =>
      requireServerSuccess(await notifyOffHoursViolation(payload)),
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
        onClick={() => setConfirmOpen(true)}
        disabled={notifyViolationMutation.isPending}
      >
        <Bell className='size-3.5' />
        {t('Notification')}
      </Button>
      <RequestNoticeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isSending={notifyViolationMutation.isPending}
        canPreview={canNotify}
        previewQuery={previewQuery}
        onConfirm={() => notifyViolationMutation.mutate(notificationPayload)}
        recipient={
          <LogUserIdentity
            userId={props.target.userId}
            username={demoMode ? '' : props.target.username}
            displayName={getDemoModeUsername(
              props.target.displayName,
              demoMode
            )}
            avatarUrl={demoMode ? undefined : props.target.avatarUrl}
            canFetchDetails={!demoMode}
          />
        }
      >
        <div className='space-y-2'>
          <p className='text-muted-foreground text-xs'>
            {t('Notification type')}
          </p>
          <p className='text-sm font-medium'>{t('Off-hours audit')}</p>
        </div>
      </RequestNoticeDialog>
    </>
  )
}
