import { AxiosError } from 'axios'
import i18next from 'i18next'
import { toast } from 'sonner'

import {
  getServerErrorMessage,
  getServerErrorMessageKey,
} from '@/lib/server-error-message'

export function handleServerError(
  error: unknown,
  fallbackMessage?: string
): void {
  // eslint-disable-next-line no-console
  console.log(error)

  let errMsg = getServerErrorMessage(
    error,
    fallbackMessage ?? i18next.t('Something went wrong!')
  )

  const messageKey = getServerErrorMessageKey(error)
  if (messageKey) {
    toast.error(i18next.t(messageKey))
    return
  }

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = i18next.t('Content not found.')
  }

  if (error instanceof AxiosError) {
    errMsg = getServerErrorMessage(error, errMsg)
  }

  toast.error(errMsg)
}
