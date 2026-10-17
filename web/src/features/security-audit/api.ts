import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

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
