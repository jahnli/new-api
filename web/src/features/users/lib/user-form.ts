import { z } from 'zod'

import type { DeptTreeNode } from '@/features/data-overview/types'
import {
  type PermissionCatalog,
  type AdminPermissionMatrix,
  normalizeAdminPermissions,
} from '@/lib/admin-permissions'
import { quotaUnitsToDollars } from '@/lib/format'
import { ROLE } from '@/lib/roles'

import { DEFAULT_GROUP } from '../constants'
import type { UserFormData, User } from '../types'

export interface CostCenterSelection {
  value: string
  label: string
  department_id: string
  company_id: number
}

interface StoredCostCenter {
  department_id: string
  name: string
  company_id: number
}

// ============================================================================
// Form Schema
// ============================================================================

export const userFormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  display_name: z.string().optional(),
  password: z.string().optional(),
  role: z.number().optional(),
  sales_user_id: z.number().int().min(0).optional(),
  overview_dept_ids: z.array(z.string()).optional(),
  cost_center: z
    .object({
      value: z.string(),
      label: z.string(),
      department_id: z.string(),
      company_id: z.number(),
    })
    .nullable()
    .optional(),
  quota_dollars: z.number().min(0).optional(),
  group: z.string().optional(),
  remark: z.string().optional(),
  admin_permissions: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>

/**
 * Return the selected department's full path without the company root node.
 * Cost center names should remain meaningful across companies while matching
 * the department_name format used elsewhere in the user interface.
 */
export function getCostCenterDepartmentPath(
  treeData: DeptTreeNode[],
  selectedValue: string
): string {
  const findPath = (
    nodes: DeptTreeNode[],
    parentPath: DeptTreeNode[]
  ): DeptTreeNode[] | null => {
    for (const node of nodes) {
      const currentPath = [...parentPath, node]
      if (node.value === selectedValue) return currentPath

      const childPath = findPath(node.children, currentPath)
      if (childPath) return childPath
    }
    return null
  }

  const path = findPath(treeData, []) ?? []
  return path
    .filter((node) => node.node_type !== 'company')
    .map((node) => node.label)
    .join(' / ')
}

// ============================================================================
// Form Defaults
// ============================================================================

export const USER_FORM_DEFAULT_VALUES: UserFormValues = {
  username: '',
  display_name: '',
  password: '',
  role: 1, // Default to common user
  overview_dept_ids: [],
  cost_center: null,
  quota_dollars: 0,
  group: DEFAULT_GROUP,
  remark: '',
  admin_permissions: {},
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: UserFormValues,
  userId?: number,
  catalog?: PermissionCatalog
): UserFormData & { id?: number } {
  const payload: UserFormData & { id?: number } = {
    username: data.username,
    display_name: data.display_name || data.username,
    password: data.password || undefined,
  }

  const role = userId === undefined ? data.role || 1 : (data.role ?? 0)
  payload.overview_dept_ids = data.overview_dept_ids ?? []
  payload.cost_center = serializeCostCenter(data.cost_center)

  // Only send the permission matrix when the target is an admin and the catalog
  // is available; without the catalog we cannot build a full matrix, so we omit
  // the field (the backend then leaves existing permissions untouched).
  if (role >= ROLE.ADMIN && catalog) {
    payload.admin_permissions = normalizeAdminPermissions(
      data.admin_permissions as AdminPermissionMatrix | undefined,
      catalog
    )
  }

  // For create: only send required fields
  if (userId === undefined) {
    payload.role = role
  } else {
    payload.role = data.role
    payload.group = data.group
    payload.remark = data.remark || undefined
    payload.id = userId
  }

  return payload
}

/**
 * Transform user data to form defaults. The admin permission matrix is passed
 * through as-is (the backend already returns a full matrix); it is filled against
 * the catalog at render time in UsersMutateDrawer.
 */
export function transformUserToFormDefaults(user: User): UserFormValues {
  return {
    username: user.username,
    display_name: user.display_name,
    password: '',
    role: user.role,
    sales_user_id: user.sales_user_id ?? 0,
    overview_dept_ids: user.overview_dept_ids ?? [],
    cost_center: parseStoredCostCenter(user.cost_center),
    quota_dollars: quotaUnitsToDollars(user.quota),
    group: user.group || DEFAULT_GROUP,
    remark: user.remark || '',
    admin_permissions: user.admin_permissions ?? {},
  }
}

function serializeCostCenter(
  selection: CostCenterSelection | null | undefined
): string {
  if (!selection) return '[]'
  const storedValue: StoredCostCenter = {
    department_id: selection.department_id,
    name: selection.label,
    company_id: selection.company_id,
  }
  return JSON.stringify([storedValue])
}

function parseStoredCostCenter(rawValue?: string): CostCenterSelection | null {
  if (!rawValue) return null
  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const storedValue = parsed[0] as Partial<StoredCostCenter>
    if (
      typeof storedValue.department_id !== 'string' ||
      typeof storedValue.name !== 'string' ||
      typeof storedValue.company_id !== 'number'
    ) {
      return null
    }
    return {
      value: `dept:${storedValue.company_id}:${storedValue.department_id}`,
      label: storedValue.name,
      department_id: storedValue.department_id,
      company_id: storedValue.company_id,
    }
  } catch {
    return null
  }
}
