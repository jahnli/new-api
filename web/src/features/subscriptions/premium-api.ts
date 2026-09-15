import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export interface PremiumPolicy {
  enabled: boolean
  default_percent: number
  model_names: string[]
  version: number
  first_enabled_at: number
}

export interface UserPremiumPolicy {
  percent_override: number | null
  default_percent: number
  effective_percent: number
}

export interface PremiumQuota {
  enabled: boolean
  effective_percent: number
  percent_source: 'user' | 'default'
  premium_amount_used: string
  premium_limit: string
  premium_available: string
  over_limit_quota: string
  tracked_since: number
}

export interface PremiumModelOption {
  name: string
  aliases: string[]
}

const base = '/api/subscription/admin'

export async function getPremiumPolicy(): Promise<PremiumPolicy> {
  const response = await api.get(`${base}/premium-policy`)
  return requireServerSuccess(response.data).data
}

export async function getPremiumModels(): Promise<PremiumModelOption[]> {
  const response = await api.get(`${base}/premium-model-options`)
  return requireServerSuccess(response.data).data
}

export async function savePremiumPolicy(
  policy: PremiumPolicy
): Promise<PremiumPolicy> {
  const response = await api.put(`${base}/premium-policy`, {
    enabled: policy.enabled,
    default_percent: policy.default_percent,
    model_names: policy.model_names,
    expected_version: policy.version,
  })
  return requireServerSuccess(response.data).data
}

export async function getUserPremiumPolicy(
  userId: number
): Promise<UserPremiumPolicy> {
  const response = await api.get(`${base}/users/${userId}/premium-policy`)
  return requireServerSuccess(response.data).data
}

export async function saveUserPremiumPolicy(
  userId: number,
  value: number | null,
  expected: number | null
): Promise<UserPremiumPolicy> {
  const response = await api.put(`${base}/users/${userId}/premium-policy`, {
    percent_override: value,
    expected_percent_override: expected,
  })
  return requireServerSuccess(response.data).data
}
