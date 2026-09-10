import { api } from '@/lib/api'

import {
  splitNotificationRecipients,
  type CompanyNotificationFormValues,
} from './lib/notification-form'

export type CompanyNotificationFailure = {
  channel: 'platform' | 'email'
  reason: string
  count: number
}

export type CompanyNotificationResult = {
  total: number
  success: number
  failed: number
  skipped: number
  failures: CompanyNotificationFailure[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function sendCompanyNotification(
  values: CompanyNotificationFormValues,
  images: File[]
): Promise<ApiResponse<CompanyNotificationResult>> {
  const formData = new FormData()
  formData.set('company_id', values.company_id)
  formData.set('title', values.title.trim())
  formData.set('content', values.content.trim())
  formData.set('send_platform', String(values.send_platform))
  formData.set('send_email', String(values.send_email))
  formData.set('test_mode', String(values.test_mode))
  formData.set(
    'test_platform_ids',
    JSON.stringify(splitNotificationRecipients(values.test_platform_ids))
  )
  formData.set(
    'test_emails',
    JSON.stringify(splitNotificationRecipients(values.test_emails))
  )
  for (const image of images) {
    formData.append('images', image, image.name)
  }

  const response = await api.post<ApiResponse<CompanyNotificationResult>>(
    '/api/company/notifications/send',
    formData
  )
  return response.data
}
