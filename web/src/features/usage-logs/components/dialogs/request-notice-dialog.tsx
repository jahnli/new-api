import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'

import type { RequestNoticePreview } from '../../types'
import { RequestNoticePreviewCard } from './request-notice-preview'

interface RequestNoticeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isSending: boolean
  canPreview: boolean
  previewQuery: UseQueryResult<RequestNoticePreview, Error>
  recipient: ReactNode
  children?: ReactNode
  emptyPreview?: ReactNode
}

export function RequestNoticeDialog(props: RequestNoticeDialogProps) {
  const { t } = useTranslation()
  const canSend =
    props.canPreview &&
    props.previewQuery.isSuccess &&
    !props.previewQuery.isFetching

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Confirm Notification')}
      confirmText={t('Send')}
      className='h-[90dvh] max-h-[90dvh] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] data-[size=default]:max-w-6xl data-[size=default]:sm:max-w-6xl'
      closeOnOutsideClick
      isLoading={props.isSending}
      disabled={!canSend}
      handleConfirm={() => {
        if (canSend && !props.isSending) props.onConfirm()
      }}
    >
      <div className='grid min-h-0 grid-cols-1 gap-5 overflow-y-auto px-1 py-1 md:grid-cols-[clamp(13rem,25%,17rem)_minmax(0,1fr)]'>
        <div className='bg-muted/60 flex min-w-0 flex-col gap-4 self-start rounded-xl p-3'>
          <div className='border-foreground/10 flex flex-col gap-2.5 border-b px-2 pt-1 pb-4'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('Recipient')}
            </p>
            {props.recipient}
          </div>
          {props.children}
        </div>
        <div
          className='flex min-w-0 flex-col'
          aria-live='polite'
          aria-busy={props.previewQuery.isFetching}
        >
          {!props.canPreview && props.emptyPreview}
          {props.canPreview && props.previewQuery.isPending && (
            <LoadingState className='min-h-48 flex-1' />
          )}
          {props.canPreview && props.previewQuery.isError && (
            <ErrorState
              className='min-h-48'
              description={props.previewQuery.error.message}
              onRetry={() => void props.previewQuery.refetch()}
            />
          )}
          {props.canPreview && props.previewQuery.isSuccess && (
            <RequestNoticePreviewCard preview={props.previewQuery.data} />
          )}
        </div>
      </div>
    </ConfirmDialog>
  )
}
