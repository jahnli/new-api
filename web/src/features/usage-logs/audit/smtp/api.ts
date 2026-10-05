import { t } from 'i18next'

import type { ApiResponse } from '@/features/profile/types'
import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

export interface SMTPAudit {
  id: number
  attempt_id: string
  started_at: number
  finished_at: number
  deadline_at: number
  duration_ms: number
  status: 'sending' | 'accepted' | 'failed' | 'unknown'
  purpose: string
  subject: string
  recipient: string
  sender: string
  user_id: number
  actor_id: number
  request_id: string
  notification_id: number
  delivery_id: number
  attempt: number
  is_test: boolean
  server: string
  port: number
  tls_mode: string
  tls_version: string
  tls_cipher: string
  insecure_skip_verify: boolean
  auth_enabled: boolean
  stage: string
  smtp_code: number
  error: string
  warning: string
  message_id: string
  message_bytes: number
  attachment_count: number
  attachment_bytes: number
  instance_id: string
  events?: string
}

export interface SMTPAuditFilters {
  status?: string
  purpose?: string
  recipient?: string
  user_id?: string
  request_id?: string
  start_timestamp?: number
  end_timestamp?: number
  is_test?: string
}

export async function getSMTPAudits(
  params: SMTPAuditFilters & { p: number; page_size: number },
  signal: AbortSignal
): Promise<{
  items: SMTPAudit[]
  total: number
  p: number
  page_size: number
}> {
  const response = await api.get<
    ApiResponse<{
      items: SMTPAudit[]
      total: number
      p: number
      page_size: number
    }>
  >('/api/smtp_audit', {
    params,
    signal,
    // React Query owns deduplication and cancellation. The global GET cache
    // could otherwise reuse an aborted request when this panel remounts.
    disableDuplicate: true,
  })
  if (!response.data.success || !response.data.data) {
    throw createServerError(
      response.data,
      t('Failed to load SMTP audit records')
    )
  }
  return response.data.data
}

export async function getSMTPAudit(
  id: number,
  signal: AbortSignal
): Promise<SMTPAudit> {
  const response = await api.get<ApiResponse<SMTPAudit>>(
    `/api/smtp_audit/${id}`,
    { signal, disableDuplicate: true }
  )
  if (!response.data.success || !response.data.data) {
    throw createServerError(
      response.data,
      t('Failed to load SMTP audit records')
    )
  }
  return response.data.data
}
