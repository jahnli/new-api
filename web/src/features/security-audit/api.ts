import type { RequestNoticePreview } from '@/features/usage-logs/types'
import { api } from '@/lib/api'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import type {
  GetImageAuditParams,
  GetImageAuditResponse,
  GetOffHoursUsageParams,
  GetOffHoursUsageResponse,
  GetSecurityAuditSettingResponse,
  NotifyOffHoursViolationRequest,
  NotifyOffHoursViolationResponse,
} from './types'

export async function getSecurityAuditSetting(): Promise<GetSecurityAuditSettingResponse> {
  const res = await api.get('/api/security_audit/setting')
  return res.data
}

export async function getOffHoursUsage(
  params: GetOffHoursUsageParams
): Promise<GetOffHoursUsageResponse> {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })
  const res = await api.get(`/api/security_audit/off_hours?${queryParams}`)
  return res.data
}

export async function notifyOffHoursViolation(
  payload: NotifyOffHoursViolationRequest
): Promise<NotifyOffHoursViolationResponse> {
  const res = await api.post(
    '/api/security_audit/off_hours/notify-violation',
    payload
  )
  return res.data
}

export async function previewOffHoursViolationNotice(
  payload: NotifyOffHoursViolationRequest,
  signal?: AbortSignal
): Promise<RequestNoticePreview> {
  const res = await api.post<{
    success: boolean
    message?: string
    data?: RequestNoticePreview
  }>('/api/security_audit/off_hours/notice-preview', payload, { signal })
  const response = requireServerSuccess(res.data)
  if (!response.data) throw createServerError(response)
  return response.data
}

export async function getImageAudit(
  params: GetImageAuditParams
): Promise<GetImageAuditResponse> {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })
  const res = await api.get(`/api/security_audit/image_studio?${queryParams}`)
  return res.data
}

export async function deleteImageAudit(id: string): Promise<void> {
  const res = await api.delete(
    `/api/security_audit/image_studio/${encodeURIComponent(id)}`
  )
  requireServerSuccess(res.data)
}
