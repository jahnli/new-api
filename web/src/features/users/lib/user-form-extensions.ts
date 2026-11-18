import { z } from 'zod'

import type { DeptTreeNode } from '@/features/data-overview/types'

import { USER_CUSTOMER_TYPE, USER_SETTLEMENT_MODE } from '../constants'
import { userCustomerTypeSchema, type User, type UserFormData } from '../types'

interface StoredCostCenter {
  department_id: string
  name: string
  company_id: number
}

export const userFormExtensionSchema = z.object({
  customer_type: userCustomerTypeSchema,
  settlement_mode: z.enum(['prepaid', 'postpaid']),
  sales_user_ids: z.array(z.number().int().positive()).optional(),
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
})

type ExtensionValues = z.infer<typeof userFormExtensionSchema>

export type CostCenterSelection = NonNullable<ExtensionValues['cost_center']>

export const userFormExtensionDefaults: ExtensionValues = {
  customer_type: 'unset',
  settlement_mode: 'prepaid',
  overview_dept_ids: [],
  cost_center: null,
}

export function getUserFormExtensionValues(user: User): ExtensionValues {
  return {
    customer_type: user.customer_type ?? 'unset',
    settlement_mode:
      user.settlement_mode === USER_SETTLEMENT_MODE.POSTPAID
        ? USER_SETTLEMENT_MODE.POSTPAID
        : USER_SETTLEMENT_MODE.PREPAID,
    sales_user_ids:
      user.sales_user_ids ?? (user.sales_user_id ? [user.sales_user_id] : []),
    overview_dept_ids: user.overview_dept_ids ?? [],
    cost_center: parseStoredCostCenter(user.cost_center),
  }
}

export function getUserFormExtensionPayload(
  data: ExtensionValues & Pick<UserFormData, 'role'>,
  userId: number | undefined,
  externalMode: boolean,
  salesChanged: boolean
) {
  const fields: Pick<UserFormData, keyof ExtensionValues | 'role'> = {
    overview_dept_ids: data.overview_dept_ids ?? [],
    cost_center: serializeCostCenter(data.cost_center),
  }
  if (userId !== undefined) fields.role = data.role
  if (externalMode) {
    fields.customer_type = data.customer_type
    fields.settlement_mode =
      data.customer_type === USER_CUSTOMER_TYPE.PAID
        ? data.settlement_mode
        : USER_SETTLEMENT_MODE.UNSET
    if (userId !== undefined && salesChanged) {
      fields.sales_user_ids = data.sales_user_ids ?? []
    }
  }
  return fields
}

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
