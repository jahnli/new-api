import { z } from 'zod'

import type { AdminPermissionMatrix } from '@/lib/admin-permissions'

// ============================================================================
// User Schema & Types
// ============================================================================

/** User status: 1 = enabled, 2 = disabled, 3+ = other states */
export const userStatusSchema = z.number()
export type UserStatus = z.infer<typeof userStatusSchema>

/** User role: 1 = common user, 2 = BP, 10 = admin, 100 = root */
export const userRoleSchema = z.number()
export type UserRole = z.infer<typeof userRoleSchema>

export interface SalesUser {
  id: number
  username: string
  display_name: string
}

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  display_name: z.string(),
  password: z.string().optional(),
  oidc_id: z.string().optional(),
  wechat_id: z.string().optional(),
  email: z.string().optional(),
  quota: z.number(),
  used_quota: z.number(),
  has_active_subscription: z.boolean().optional().default(false),
  sub_quota_used: z.number().optional().default(0),
  sub_quota_total: z.number().optional().default(0),
  monthly_total_amount_cny: z.number().optional().default(0),
  monthly_total_tokens: z.number().optional().default(0),
  monthly_total_requests: z.number().optional().default(0),
  monthly_common_model: z.string().optional(),
  request_count: z.number(),
  group: z.string(),
  status: userStatusSchema,
  role: userRoleSchema,
  sales_user_id: z.number().optional(),
  sales_user: z
    .object({
      id: z.number(),
      username: z.string(),
      display_name: z.string(),
      avatar_url: z.string().optional(),
      role: z.number(),
      email: z.string().optional(),
      mobile: z.string().optional(),
      job_number: z.string().optional(),
      description: z.string().optional(),
      background_image: z.string().optional(),
      company: z.string().optional(),
      gender: z.number().optional(),
      open_id: z.string().optional(),
    })
    .optional(),
  overview_dept_ids: z.array(z.string()).optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  last_login_at: z.number().optional(),
  DeletedAt: z.any().nullable().optional(),
  remark: z.string().optional(),
  avatar_url: z.string().optional(),
  department_name: z.string().optional(),
  job_title: z.string().optional(),
  job_number: z.string().optional(),
  mobile: z.string().optional(),
  open_id: z.string().optional(),
  gender: z.number().optional(),
  description: z.string().optional(),
  background_image: z.string().optional(),
  custom_field_values: z.string().optional(),
  join_date: z.string().optional(),
  company: z.string().optional(),
  cost_center: z.string().optional(),
  admin_permissions: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional(),
})
export type User = z.infer<typeof userSchema>

export const userListSchema = z.array(userSchema)

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Generic API response */
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export type UserSortBy =
  | 'id'
  | 'username'
  | 'quota'
  | 'group'
  | 'created_at'
  | 'last_login_at'
  | 'used_quota'
  | 'role'
  | 'status'
  | 'sub_quota_used'
  | 'monthly_total_amount_cny'
  | 'monthly_unit_price_per_100m_tokens'
  | 'monthly_total_tokens'
  | 'monthly_total_requests'

export type UserSortOrder = 'asc' | 'desc'

export interface GetUsersParams {
  p?: number
  page_size?: number
  sort_by?: UserSortBy
  sort_order?: UserSortOrder
}

export interface GetUsersResponse {
  success: boolean
  message?: string
  data?: {
    items: User[]
    total: number
    page: number
    page_size: number
    enabled_count: number
    disabled_count: number
  }
}

export interface SearchUsersParams {
  keyword?: string
  group?: string
  company?: string
  role?: string
  status?: string
  p?: number
  page_size?: number
  sort_by?: UserSortBy
  sort_order?: UserSortOrder
}

export interface UserFormData {
  sales_user_id?: number
  username: string
  display_name: string
  password?: string
  role?: number // Only used when creating user
  overview_dept_ids?: string[] // Explicitly configured visible department node values for BP users
  cost_center?: string // Canonical single-department JSON array for the user's cost center
  quota?: number // Only used when updating user
  group?: string // Only used when updating user
  remark?: string // Only used when updating user
  admin_permissions?: AdminPermissionMatrix
}

export type ManageUserAction =
  | 'promote'
  | 'demote'
  | 'enable'
  | 'disable'
  | 'add_quota'

export type QuotaAdjustMode = 'add' | 'subtract' | 'override'

export interface ManageUserQuotaPayload {
  id: number
  action: 'add_quota'
  mode: QuotaAdjustMode
  value: number
}

// ============================================================================
// Dialog Types
// ============================================================================

export type UsersDialogType = 'create' | 'update'

// ============================================================================
// Shared Column Row Interface
// ============================================================================

export interface UserColumnRow {
  id: number
  username: string
  display_name: string
  email?: string
  avatar_url?: string
  remark?: string
  quota: number
  used_quota: number
  has_active_subscription?: boolean
  sub_quota_used: number
  sub_quota_total: number
  request_count: number
  group: string
  status: number
  role: number
  created_at?: number
  last_login_at?: number
  DeletedAt?: unknown | null
  department_name?: string
  custom_field_values?: string
  join_date?: string
  job_number?: string
  job_title?: string
  description?: string
  background_image?: string
  mobile?: string
  open_id?: string
  gender?: number
  company?: string
  cost_center?: string
}

// ============================================================================
// Custom Field Helpers
// ============================================================================

export type UserProfile = Pick<
  UserColumnRow,
  | 'id'
  | 'username'
  | 'display_name'
  | 'role'
  | 'email'
  | 'avatar_url'
  | 'remark'
  | 'department_name'
  | 'custom_field_values'
  | 'join_date'
  | 'job_number'
  | 'job_title'
  | 'description'
  | 'background_image'
  | 'mobile'
  | 'open_id'
  | 'gender'
  | 'company'
>

export const CUSTOM_FIELD_KEYS = {
  JOB_LEVEL: 'C-7434714811573665793',
  JOB_DESCRIPTION: 'C-7439269744984244227',
  BIRTHDAY: 'C-7613945054108945361',
  HOMETOWN: 'C-7439630416690561028',
  ETHNICITY: 'C-7439269636549230620',
} as const

export function parseCustomFields(
  raw?: string
): Record<string, string> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string>
    }
  } catch {
    // ignore
  }
  return undefined
}
