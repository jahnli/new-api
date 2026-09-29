import type { DepartmentQueryParams, DeptTreeNode } from '../types'

// A node is non-selectable when the backend marks it disabled (e.g. a
// directory-platform company root for BP/department-leader roles), when it
// carries an error, or when it lacks company metadata. The backend sets
// `disabled` per role (`userRole < RoleRootUser`), so admins can select
// directory-platform company roots while BP/leaders cannot. None-platform
// companies stay selectable for all roles because they are leaf data scopes.
export function isDepartmentNodeDisabled(node: DeptTreeNode): boolean {
  return (
    node.disabled ||
    Boolean(node.error) ||
    (node.node_type !== 'overview' && !node.company_id)
  )
}

export function findDepartmentNodeByValue(
  nodes: DeptTreeNode[],
  value: string
): DeptTreeNode | null {
  for (const node of nodes) {
    if (node.value === value) return node
    const child = findDepartmentNodeByValue(node.children, value)
    if (child) return child
  }
  return null
}

export function findFirstSelectableNode(
  nodes: DeptTreeNode[]
): DeptTreeNode | null {
  for (const node of nodes) {
    if (!isDepartmentNodeDisabled(node)) return node
    const child = findFirstSelectableNode(node.children)
    if (child) return child
  }
  return null
}

export function createDepartmentQueryParams(
  node: DeptTreeNode,
  startTimestamp: number,
  endTimestamp: number
): DepartmentQueryParams {
  if (node.node_type === 'overview') {
    return {
      company_id: 0,
      department_id: node.value,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
    }
  }
  if (!node.company_id) {
    throw new Error('Company department node is missing company_id')
  }
  return {
    company_id: node.company_id,
    department_id: node.value,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
  }
}

export function getDepartmentNodeErrorText(
  node: DeptTreeNode,
  translate: (key: string, options: { error: string }) => string
): string | undefined {
  if (!node.error) return undefined
  return translate('Company data unavailable: {{error}}', {
    error: node.error,
  })
}
